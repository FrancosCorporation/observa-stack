// SDK leve para enviar logs em OTLP HTTP sem fazer o app depender do collector.
const NIVEIS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
const loggersAtivos = new Set();
let hookBeforeExitInstalado = false;

function normalizarNivel(valor) {
  const nome = String(valor || 'INFO').toUpperCase();
  return Object.hasOwn(NIVEIS, nome) ? nome : 'INFO';
}

async function flushTodos() {
  await Promise.allSettled([...loggersAtivos].map((logger) => logger.flush()));
}

function instalarHookBeforeExit() {
  if (hookBeforeExitInstalado) return;
  hookBeforeExitInstalado = true;
  process.once('beforeExit', async () => {
    hookBeforeExitInstalado = false;
    await flushTodos();
  });
}

function valorAtributo(valor, limite) {
  let texto;
  try { texto = String(valor); } catch { texto = '[valor não serializável]'; }
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}

export function instrumentar(nomeServico, {
  url = 'http://localhost:4318/v1/logs',
  nivel = process.env.OBSERVA_LOG_LEVEL || 'INFO',
  tamanhoLote = 10,
  limiteBuffer = 1_000,
  limiteAtributos = 32,
  timeoutMs = 2_000
} = {}) {
  const servico = valorAtributo(nomeServico || 'app', 128);
  const nivelMinimo = normalizarNivel(nivel);
  const lote = Math.max(1, Math.min(Number(tamanhoLote) || 10, 1_000));
  const maximoBuffer = Math.max(lote, Math.min(Number(limiteBuffer) || 1_000, 10_000));
  const maximoAtributos = Math.max(0, Math.min(Number(limiteAtributos) || 0, 128));
  const timeout = Math.max(100, Math.min(Number(timeoutMs) || 2_000, 30_000));
  let buffer = [];
  let envioAtivo = null;
  let descartados = 0;
  let fechado = false;

  function fallback(registros) {
    for (const registro of registros) {
      try { console.log(`[${registro.severityText}] ${registro.body.stringValue}`); } catch { /* logging never breaks the app */ }
    }
  }

  async function enviar(registros) {
    const envelope = {
      resourceLogs: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: servico } }] },
        scopeLogs: [{
          scope: { name: 'observa-stack' },
          logRecords: registros
        }]
      }]
    };

    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeout);
    try {
      const resposta = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: controlador.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      });
      if (!resposta.ok) {
        await resposta.body?.cancel();
        throw new Error(`collector respondeu HTTP ${resposta.status}`);
      }
      await resposta.body?.cancel();
    } catch {
      fallback(registros);
    } finally {
      clearTimeout(timer);
    }
  }

  function flush() {
    if (envioAtivo) return envioAtivo.then(() => buffer.length ? flush() : undefined);
    if (!buffer.length) return Promise.resolve();

    const registros = buffer;
    buffer = [];
    envioAtivo = enviar(registros).finally(() => { envioAtivo = null; });
    return envioAtivo.then(() => buffer.length ? flush() : undefined);
  }

  function log(severidade, mensagem, extra = {}) {
    if (NIVEIS[severidade] < NIVEIS[nivelMinimo]) return Promise.resolve();
    let texto;
    try { texto = valorAtributo(mensagem, 8_192); }
    catch { texto = '[mensagem não serializável]'; }

    const atributos = [];
    try {
      for (const [chave, valor] of Object.entries(extra && typeof extra === 'object' ? extra : {}).slice(0, maximoAtributos)) {
        atributos.push({ key: valorAtributo(chave, 128), value: { stringValue: valorAtributo(valor, 2_048) } });
      }
    } catch {
      atributos.push({ key: 'observa.attributes_error', value: { stringValue: 'atributos inválidos' } });
    }

    const registro = {
      timeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
      severityText: severidade,
      body: { stringValue: texto },
      attributes: atributos
    };

    if (fechado) {
      fallback([registro]);
      return Promise.resolve();
    }
    buffer.push(registro);
    if (buffer.length > maximoBuffer) {
      buffer.splice(0, buffer.length - maximoBuffer);
      descartados += 1;
    }
    return buffer.length >= lote ? flush() : Promise.resolve();
  }

  const logger = {
    debug: (mensagem, extra) => log('DEBUG', mensagem, extra),
    info: (mensagem, extra) => log('INFO', mensagem, extra),
    warn: (mensagem, extra) => log('WARN', mensagem, extra),
    erro: (mensagem, extra) => log('ERROR', mensagem, extra),
    flush,
    async shutdown() {
      fechado = true;
      await flush();
      loggersAtivos.delete(logger);
    },
    metricas() {
      return { bufferizados: buffer.length, descartados };
    }
  };

  loggersAtivos.add(logger);
  instalarHookBeforeExit();
  return logger;
}
