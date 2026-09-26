# Observa Stack — Observability as Code

![Status](https://img.shields.io/badge/status-em%20constru%C3%A7%C3%A3o-orange)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)
![OTel](https://img.shields.io/badge/OpenTelemetry-traces%20%2B%20metrics-425CC7)
![License](https://img.shields.io/badge/license-MIT-green)

Observability as code: docker-compose with otel-collector + Loki + Grafana with
provisioned dashboards (JSON), an instrumented demo app (traces + metrics + logs),
alerts via webhook and documented SLOs.

> 🇧🇷 Observabilidade como código: compose com otel-collector + Loki + Grafana com
> dashboards provisionados, app demo instrumentado, alertas via webhook e SLOs documentados.

## Features (roadmap)

- [ ] **M1a** — Compose: otel-collector + loki + grafana + dashboards-as-code
- [ ] **M1b** — Demo app instrumented (kanbanex as the target!)
- [ ] **M2** — Alerts (webhook → Telegram), SLOs, versioned dashboards

## Built with

- Docker/infra patterns from my 74-repo workspace (grafana already in my local stack)
- References: [grafana/loki](https://github.com/grafana/loki) (24k⭐),
  [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)

## License

MIT — Rodolfo Franco ([FrancosCorporation](https://github.com/FrancosCorporation))
