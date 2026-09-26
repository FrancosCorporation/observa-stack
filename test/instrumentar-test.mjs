// Testes do instrumentar (observa-stack M1): OTLP JSON + fallback determinístico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { instrumentar } from '../src/instrumentar.js';

test('instrumentar: OTLP JSON válido enviado ao collector', async () => {
  const recebidos = [];
  const collector = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => { recebidos.push(JSON.parse(corpo)); res.writeHead(200); res.end(); });
  });
  await new Promise((r) => collector.listen(0, r));
  const porta = collector.address().port;
  const logger = instrumentar('kanbanex', { url: `http://localhost:${porta}/v1/logs` });

  await logger.info('app subiu', { porta: 3000 });
  await logger.erro('falha de conexão', { destino: 'mongo' });
  await logger.flush();

  assert.equal(recebidos.length, 1);
  const registro = recebidos[0].resourceLogs[0];
  assert.equal(registro.resource.attributes[0].value.stringValue, 'kanbanex');
  const logs = registro.scopeLogs[0].logRecords;
  assert.equal(logs.length, 2);
  assert.equal(logs[0].severityText, 'INFO');
  assert.equal(logs[1].severityText, 'ERROR');
  assert.equal(logs[0].body.stringValue, 'app subiu');
  collector.close();
});

test('instrumentar: flush automático no 10º log (lote)', async () => {
  let lotes = 0;
  const collector = createServer((req, res) => { lotes++; res.writeHead(200); res.end(); });
  await new Promise((r) => collector.listen(0, r));
  const logger = instrumentar('x', { url: `http://localhost:${collector.address().port}/v1/logs` });
  for (let i = 0; i < 10; i++) await logger.info(`log ${i}`);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(lotes, 1, '10 logs => 1 lote flushado');
  collector.close();
});

test('instrumentar: FALLBACK sem collector — log no stdout, app não quebra', async () => {
  const logger = instrumentar('offline-app', { url: 'http://localhost:1/v1/logs' }); // porta inválida
  const saida = [];
  const orig = console.log;
  console.log = (m) => saida.push(m);
  await logger.warn('sem collector, seguindo de pé');
  await logger.flush();
  console.log = orig;
  assert.ok(saida[0].includes('[WARN]'), 'fallback imprime no stdout');
  assert.ok(saida[0].includes('sem collector'), 'mensagem preservada');
});
