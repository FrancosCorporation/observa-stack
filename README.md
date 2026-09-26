# Observa Stack — Observability as Code

![Status](https://img.shields.io/badge/M1-funcionando%20(3%2F3%20testes)-brightgreen)
![CI](https://img.shields.io/badge/CI-test%20%2B%20config%20%2B%20license-blue)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)
![OTel](https://img.shields.io/badge/OpenTelemetry-traces%20%2B%20metrics-425CC7)
![License](https://img.shields.io/badge/license-MIT-green)

Observability as code: docker-compose with otel-collector + Loki + Grafana with
provisioned dashboards (JSON), an instrumented demo app (traces + metrics + logs),
alerts via webhook and documented SLOs.

> 🇧🇷 Observabilidade como código: compose com otel-collector + Loki + Grafana com
> dashboards provisionados, app demo instrumentado, alertas via webhook e SLOs documentados.

## Features

- [x] **M1a** — Compose: otel-collector (OTLP gRPC+HTTP) + Loki + Grafana com **dashboards provisionados** (JSON as code)
- [x] **M1b** — Instrumentação enxuta zero-dep (`src/instrumentar.js`): OTLP HTTP fiel (envelope único + múltiplos logRecords) + flush em lote + **fallback sem collector** (nunca quebra o app) — 3/3 testes
- [ ] **M2** — Alerts (webhook → Telegram), SLOs, traces completos (span hierarchy)

## Quick start

```bash
docker compose up   # Grafana em http://localhost:3800 (admin/admin)
```

## Instrumentar seu app (zero deps)

```js
import { instrumentar } from './src/instrumentar.js';
const logger = instrumentar('meu-app'); // OTLP → http://localhost:4318
logger.info('app subiu', { porta: 3000 });
await logger.flush();
```

Sem collector rodando? O fallback imprime no stdout — o app **nunca quebra**.

## Built with

- Docker/infra patterns from my 74-repo workspace (grafana already in my local stack)
- References: [grafana/loki](https://github.com/grafana/loki) (24k⭐),
  [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)

## License

MIT — Rodolfo Franco ([FrancosCorporation](https://github.com/FrancosCorporation))
