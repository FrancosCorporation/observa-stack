// App demo instrumentado (M1b): o padrão de instrumentação OTel para os projetos.
// Uso: instrumentar o kanbanex/qualquer app Node com OTLP HTTP (4318).
export function instrumentar(nomeServico, { url = 'http://localhost:4318/v1/logs' } = {}) {
  let buffer = [];

  function log(nivel, mensagem, extra = {}) {
    buffer.push({
      timeUnixNano: String(Date.now() * 1e6),
      severityText: nivel,
      body: { stringValue: mensagem },
      attributes: Object.entries(extra).map(([key, value]) => ({ key, value: { stringValue: String(value) } }))
    });
    if (buffer.length >= 10) return flush();
    return Promise.resolve();
  }

  async function flush() {
    if (!buffer.length) return;
    const registros = buffer;
    buffer = [];
    // UM envelope OTLP único com TODOS os logRecords (fiel ao protocolo OTLP HTTP real)
    const envelope = {
      resourceLogs: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: nomeServico } }] },
        scopeLogs: [{
          scope: { name: 'observa-stack' },
          logRecords: registros
        }]
      }]
    };
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      });
    } catch {
      // fallback explícito (padrão unificado): sem collector, log só no stdout — nunca quebra o app
      for (const r of registros) {
        console.log(`[${r.severityText}] ${r.body.stringValue}`);
      }
    }
  }

  return {
    info: (m, e) => log('INFO', m, e),
    warn: (m, e) => log('WARN', m, e),
    erro: (m, e) => log('ERROR', m, e),
    flush
  };
}
