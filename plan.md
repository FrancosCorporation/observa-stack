# Plan — observa-stack

## 1. Visão geral

- **Nome:** observa-stack — Observability as Code
- **Descrição:** stack pronta de observabilidade (OpenTelemetry Collector + Loki + Grafana provisionado) com helper de instrumentação enxuta com fallback; dashboards provisionados; validação dos configs na própria CI (compose + imagem OTel pinada por digest).
- **Estado atual:** SEC-01..05, BUG-01..03, IMP-01/02, DEVOPS-01..03 e DOC-01/02 concluídos em 2026-10-11; CI modernizada nesta sessão.

## 2. Arquitetura e tecnologias

- Node ≥ 22.12 (elevado nesta sessão), ESM; `src/instrumentar.js` sem dependências pesadas.
- Docker Compose (Grafana/Loki/OTel) validado em CI com senha descartável explícita.
- CI: sintaxe + suíte + `docker compose config -q` + `otelcol validate` + licenças; **modernizada nesta sessão**.

## 3. Funcionalidades existentes

- [x] Instrumentação com fallback e payouts mínimos — implementado.
- [x] Provisionamento declarativo de dashboards/datasources — implementado.
- [x] Config OTel validada em CI pela imagem oficial (digest pinado) — implementado.
- [x] CI — **modernizada nesta sessão** (Ubuntu 24.04, Actions v7, Node 22/24, `npm ci`, gate audit, lockfile versionado).

## 4. Objetivos futuros

- **OBJ-01 (P2, concluído nesta sessão):** CI previsível com gates.
- **OBJ-02 (P3, recomendação):** exemplos de alertas (rules) para Loki/Grafana.
- **OBJ-03 (P3, recomendação):** guia de instrumentação de um app Express de exemplo em `docs/`.

## 5–7. Melhorias / Roadmap / Backlog

- Fases 1–3 concluídas; backlog: OBJ-02, OBJ-03 (ambos P3).

## 8. Riscos e pendências

- Imagens de terceiros (grafana/loki/otel) exigem revisão periódica de digest; validação comportamental da stack (subir e gerar traces) segue fora da esteira (TEST-01).

## 9. Ideias adicionais

- Publicar como template reutilizável (GitHub template repository) se o dono quiser.

---
*(Gerado em 2026-10-14 pelo agente orquestrador)*
