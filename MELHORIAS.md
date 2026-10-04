# MELHORIAS — observa-stack

> **Gerado por análise de código em 2026-10-02** · Stack: OTel Collector + Loki + Grafana (compose) + `src/instrumentar.js` (SDK de instrumentação)
> Branch `main` · 51 LOC de código próprio (o resto é config de stack) · 1 teste · **sem Dockerfile** (usa imagens upstream)
>
> **Este arquivo é um plano de execução.** Cada item tem ID, `arquivo:linha`, mudança exata,
> critério de aceite e comando de verificação.

---

## 0. Como usar este documento

1. Execute na ordem **P0 → P1 → P2 → P3**, respeitando as ondas da §8.
2. Ao terminar um item: marque `- [x]`, rode o **Verificação**, comite `fix(<ID>): descrição`.
3. **O SDK de instrumentação está bem desenhado** (buffer, envelope OTLP, fallback para stdout que
   nunca quebra o app — `instrumentar.js:37-42`). Não reescreva; os itens são de exposição do compose
   e robustez do buffer.
4. **As versões de imagem não são pinadas** (`latest` em todas as três) — isso éSupply chain
   (`SEC-03`), não "atualizar para a mais nova".
5. **Idioma:** português; commits em inglês com `fix:`/`feat:`/`docs:`.

---

## 1. Diagnóstico executivo

Stack de observabilidade: collector OTel recebe OTLP, Loki guarda logs, Grafana exibe com dashboards
provisionados. O `src/instrumentar.js` é o SDK que os outros projetos importam para enviar logs.

**O que está bem (não reaça):**

| Item | Evidência |
|---|---|
| Fallback explícito: sem collector, log vai para stdout e **não quebra o app** | `instrumentar.js:37-42` |
| Envelope OTLP **real** (um envio com todos os `logRecords`) | `instrumentar.js:22-30` (comentário confirma fidelidade ao protocolo) |
| Buffer com flush em lote (10) | `instrumentar.js:4,13` — não faz 1 request por log |
| `resource.service.name` enviado | `instrumentar.js:24` |
| Provisioning do Grafana por volume **read-only** | `docker-compose.yml` (`./grafana/provisioning:/etc/grafana/provisioning:ro`) |
| `GF_USERS_ALLOW_SIGN_UP: "false"` | `docker-compose.yml` (não permite self-signup) |
| `restart: unless-stopped` em todos os serviços | `docker-compose.yml` |
| Volume nomeado para dados do Grafana (persistência) | `docker-compose.yml` (`dados_grafana:`) |

**O que está quebrado:**

1. **Senha do Grafana é `admin` por padrão** (`GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}`).
2. **OTLP exposto sem autenticação** (`4317:4317`, `4318:4318` no host) — qualquer um injeta telemetria
   (e o collector **não** tem limite de taxa).
3. **Imagens `latest` sem pin** (`otel-collector-contrib:latest`, `loki:latest`, `grafana:latest`) —
   supply chain e não-reprodutibilidade.

---

## 2. Tabela de prioridades

| ID | Título | Sev | Arquivo | Depende de |
|---|---|---|---|---|
| SEC-01 | Senha do Grafana padrão `admin` | **P0** | `docker-compose.yml:26` | — |
| SEC-02 | OTLP (4317/4318) exposto sem autenticação | **P1** | `docker-compose.yml:13-16` | — |
| SEC-03 | Imagens `latest` sem pin (supply chain) | **P1** | `docker-compose.yml:9,17,21` | — |
| SEC-04 | Loki exposto sem autenticação (3100) | **P1** | `docker-compose.yml:20` | — |
| SEC-05 | Sem `limits`/rate limit no collector | **P2** | `otel/config.yaml` | — |
| BUG-01 | `flush()` sem `await` (buffer pode perder log no exit) | **P2** | `instrumentar.js:13` | — |
| BUG-02 | Buffer cresce sem limite se collector lento | **P2** | `instrumentar.js:4,13` | — |
| BUG-03 | Sem timeout no `fetch` do collector | **P2** | `instrumentar.js:32` | — |
| IMP-01 | Dicionário de atributos de log sem limite | **P3** | `instrumentar.js:11` | — |
| IMP-02 | Sem nível mínimo (envia tudo por padrão) | **P3** | `instrumentar.js:6-15` | — |
| TEST-01 | Sem teste do envelope/fallback | **P2** | `test/instrumentar-test.mjs` | — |
| DEVOPS-01 | Sem `.env.example` (senha required) | **P1** | *(ausente)* | SEC-01 |
| DEVOPS-02 | Sem CI | **P2** | *(ausente)* | — |
| DEVOPS-03 | Sem `.gitignore` (dados do grafana) | **P3** | *(ausente)* | — |
| DOC-01 | README não documenta portas expostas e senha | **P2** | `README.md` | SEC-01 |
| DOC-02 | Falta `SECURITY.md` | **P3** | *(ausente)* | — |

**Placar: 1 P0 · 5 P1 · 4 P2 · 3 P3 = 13 itens.**

---

## 3. Segurança
### SEC-01 · Senha do Grafana padrão `admin` · [P0]

- **Arquivo:** `docker-compose.yml:26`
- **Evidência:**
  ```yaml
  GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
  ```
  O default **`admin`** é a senha padrão da própria Grafana — o valor mais previsível possível. Sem
  `GRAFANA_PASSWORD` no ambiente (não há `.env.example`), o compose sobe com ela.
- **Impacto:** acesso administrativo ao Grafana por qualquer pessoa na rede — quem entra vê **todos
  os logs** da stack (que podem conter dado de aplicação, tokens em log, etc.) e pode alterar
  datasource/configuração. Combinado com a porta `3800:3000` publicada no host, é acesso direto.
- **Mudança:** (1) **remover o default**: `${GRAFANA_PASSWORD:?defina GRAFANA_PASSWORD}` — o compose
  **falha** se não estiver definido (fail-fast, padrão do `SEC-03` do `api_authentication`); (2)
  documentar como gerar (`openssl rand -base64 24`); (3) `.env.example` com `GRAFANA_PASSWORD=`
  (item `DEVOPS-01`); (4) opcionalmente, `GF_USERS_ALLOW_SIGN_UP: "false"` já está correto — manter.
- **Aceite:** `docker compose up` sem `GRAFANA_PASSWORD` falha com mensagem; com a variável sobe.
- **Verificação:**
  ```bash
  docker compose config 2>&1 | grep -i 'GRAFANA_PASSWORD'   # deve exigir a variavel
  unset GRAFANA_PASSWORD; docker compose config -q 2>&1 | grep -qi 'required' && echo OK || echo FALHA
  ```

### SEC-02 · OTLP (4317/4318) exposto sem autenticação · [P1]

- **Arquivo:** `docker-compose.yml:13-16`
- **Evidência:**
  ```yaml
  ports:
    - "4317:4317"   # OTLP gRPC
    - "4318:4318"   # OTLP HTTP
  ```
  Publicados no host, e o `otel-collector` **não tem** `receivers` com autenticação/token no
  `otel/config.yaml`.
- **Impacto:** (a) qualquer pessoa na rede **injeta telemetria falsa** no collector (polui Loki, pode
  disparar alerta/regra, polui o dashboard); (b) pode usar a栈 como **amplificador** (injetar volume
  alto) — o collector não tem `limits` (ver `SEC-05`); (c) o dado injetado pode conter conteúdo
  enganoso para quem lê o dashboard. Não é leitura direta de segredo, é **integridade do dado de
  observabilidade**.
- **Mudança:** (1) se o app é local, trocar `ports:` por `expose:` (só `app_network`); (2) se precisa
  acesso externo, configurar **auth no receiver** (extensão `bearertokenauth` do collector) e/or
  limitar por firewall; (3) `limits` no collector (ver `SEC-05`).
- **Aceite:** sem token/bearer, o receiver recusa; de fora da rede, a porta não responde.
- **Verificação:**
  ```bash
  ss -lntp | grep -E '4317|4318'   # esperado: so na rede docker (ou 127.0.0.1)
  ```

### SEC-03 · Imagens `latest` sem pin (supply chain) · [P1]

- **Arquivo:** `docker-compose.yml:9,17,21` · `otel/config.yaml`
- **Evidência:** `otel/opentelemetry-collector-contrib:latest`, `grafana/loki:latest`,
  `grafana/grafana:latest` — todas `latest`, sem digest.
- **Impacto:** (a) **não-reprodutibilidade**: `docker compose up` em dois momentos traz versões
  diferentes, e um update pode **quebrar** o stack ou a config sem mudança no repo; (b) **supply
  chain**: se um tag for movido (ou a conta upstream comprometida), o próximo `pull` executa código
  novo — num stack que processa todos os logs.
- **Mudança:** (1) pinar por **tag de versão** (ex.: `grafana/grafana:11.3.0`) ou, ideal, por
  **digest** (`@sha256:...`); (2) documentar o procedimento de update (ver `DOC-01`); (3) atualizar
  `GRAFANA_PASSWORD` na mesma mudança (o pin pode vir com default diferente).
- **Aceite:** nenhuma imagem usa `latest`; `docker compose config` mostra digest/tag fixo.
- **Verificação:**
  ```bash
  grep -n 'latest' docker-compose.yml && echo 'FALHA: ainda latest' || echo OK
  ```

### SEC-04 · Loki exposto sem autenticação (3100) · [P1]

- **Arquivo:** `docker-compose.yml:18-20`
- **Evidência:** `ports: - "3100:3100"` com `grafana/loki:latest` e command `-config.file=/etc/loki/local-config.yaml`
  (config **default** da imagem, que não tem auth).
- **Impacto:** o Loki expõe a **API de query** (e métricas) sem autenticação — qualquer pessoa lê
  **todos os logs** diretamente (bypass total do Grafana, mesmo com a senha corrigida em `SEC-01`).
  Log costuma ter dado sensível (erros com token, request id de usuário).
- **Mudança:** (1) `ports:` → `expose:` (acesso só via Grafana na `app_network`); (2) se o Loki
  **precisa** ser consultado de fora, configurar auth no `local-config.yaml` (não usar o default).
- **Aceite:** `3100` não responde de fora da rede docker.
- **Verificação:**
  ```bash
  ss -lntp | grep 3100   # esperado ausente (ou so 127.0.0.1)
  ```

### SEC-05 · Sem `limits`/rate limit no collector · [P2]

- **Arquivo:** `otel/config.yaml`
- **Evidência:** o config do collector não define `service.telemetry` nem `limits`/`memory_limiter`.
- **Impacto:** junto do `SEC-02` (receiver aberto), injeção de telemetria em volume pode fazer o
  collector crescer sem limite (memória/disco no Loki) — DoS do stack de observabilidade.
- **Mudança:** adicionar `memory_limiter` receiver processor e `service.pipelines` com limite; e/ou
  `limits` de taxa no receiver.
- **Aceite:** collector rejeita/descarta acima do limite, sem OOM.
- **Verificação:**
  ```bash
  grep -n 'memory_limiter\|limits' otel/config.yaml   # deve existir
  ```
---

## 4. Bugs e defeitos funcionais

### BUG-01 · `flush()` sem `await` (perde log no exit) · [P2]

- **Arquivo:** `src/instrumentar.js:13`
- **Evidência:** `if (buffer.length >= 10) return flush();` — `log()` retorna a promise, mas quem
  chama `log()` normalmente **não** faz `await` (`info: (m, e) => log('INFO', m, e)`, linha 46). E o
  `flush` só roda por lote ou explicitamente.
- **Impacto:** no `exit`/SIGTERM, o buffer com <10 registros **nunca é enviado** (perde até 9 logs por
  processo). Como a action/serviço é curta-lived (restart, deploy), a perda é frequente.
- **Mudança:** (1) `log()` não deveria depender de o chamador aguardar: disparar `flush()` com
  `.catch` e internally tracking; (2) **hook de `exit`/`SIGTERM`** que faz `await flush()` (com
  timeout curto); (3) decisão explícita: buffer em lote **ou** garantir drain no shutdown.
- **Aceite:** matar o processo com 3 logs no buffer → os 3 chegam ao collector (testar com collector
  de teste).
- **Verificação:**
  ```bash
  # com collector mock: 3 logs + exit imediato -> chegam 3
  ```

### BUG-02 · Buffer cresce sem limite se collector lento · [P2]

- **Arquivo:** `src/instrumentar.js:4,13,19`
- **Evidência:** `buffer.push(...)` sempre; se `flush()` está em voo (fetch lento), **novos** logs
  continuam entrando no buffer (que já foi esvaziado, linha 19, então cresce de novo) sem teto.
- **Impacto:** collector lento/fora → buffer cresce sem limite na memória do app (que é quem
  **não pode** cair, por desenho do próprio SDK — linha 38). Memória cresce até OOM do app.
- **Mudança:** teto de buffer (ex.: 1000 registros); ao estourar, descartar os **mais antigos** (ou
  os de menor severidade) e incrementar um contador de descartados (visível no log).
- **Aceite:** collector parado → memória do app estabiliza (buffer no teto, não cresce).
- **Verificação:**
  ```bash
  # collector apontando para porta morta: 10k logs -> RSS estavel
  ps -o rss= -p <pid>
  ```

### BUG-03 · Sem timeout no `fetch` do collector · [P2]

- **Arquivo:** `src/instrumentar.js:32`
- **Evidência:** `await fetch(url, {method, headers, body})` — sem `signal`/timeout.
- **Impacto:** collector lento aceita e não responde → `flush()` trava; combinado com `BUG-01`
  (sem drain), log se perde; combinado com `BUG-02`, o buffer cresce. É a mesma classe do
  `webhook-relay` `SEC-04`.
- **Mudança:** `AbortSignal.timeout(2000)` no fetch.
- **Aceite:** collector que não responde não trava o app além do timeout.
- **Verificação:**
  ```bash
  # collector apontado para porta que aceita e nao responde: app continua respondendo
  ```

---

## 5. Qualidade: testes

### TEST-01 · Sem teste do envelope/fallback do SDK · [P2]

- **Arquivo:** `test/instrumentar-test.mjs`
- **Evidência:** existe 1 teste; presumo que cubra o caminho feliz. Não cobre: (a) envelope tem o
  formato OTLP esperado (assert de estrutura), (b) **fallback para stdout** quando o collector falha,
  (c) flush no buffer cheio.
- **Impacto:** o fallback "nunca quebra o app" (`instrumentar.js:37-42`) é a **propriedade mais
  importante** do SDK (é o que permite adopting em qualquer projeto) — e não está travado por teste.
- **Mudança:** (1) teste de estrutura do envelope (`resourceLogs[0].resource.attributes` com
  `service.name`); (2) teste do fallback: `fetch` que lança → `console.log` chamado, sem `throw`;
  (3) teste do flush em lote (10 logs → 1 request).
- **Aceite:** os 3 casos no `npm test`.
- **Verificação:**
  ```bash
  npm test 2>&1 | tail -3
  ```

---

## 6. DevOps / Infra

### DEVOPS-01 · Sem `.env.example` (senha required) · [P1]

- **Arquivo:** *(ausente)* `.env.example`
- **Evidência:** o compose usa `${GRAFANA_PASSWORD:-admin}`; não há exemplo.
- **Impacto:** ver `SEC-01` — sem exemplo, ninguém sabe que precisa definir a senha; o default
  `admin` "funciona" e ninguém percebe.
- **Mudança:** `.env.example` com `GRAFANA_PASSWORD=` (+ comentário de geração). Após o `SEC-01`, é
  a única variável obrigatória.
- **Aceite:** `.env.example` existe e o compose usa.
- **Verificação:** `ls .env.example && grep -q GRAFANA_PASSWORD .env.example && echo OK`.

### DEVOPS-02 · Sem CI · [P2]

- **Arquivo:** *(ausente)* `.github/workflows/`
- **Evidência:** nenhum workflow; `otel/config.yaml` e `docker-compose.yml` não são validados
  automaticamente.
- **Impacto:** um YAML quebrado (ou um `${VAR:?}` mal posto) só falha na hora do `docker compose up`.
- **Mudança:** `ci.yml`: `npm ci && npm test`, `docker compose config -q`, e `docker run ... caddy
  validate` equivalente (para Loki/otel, validar que o config é aceito pelo container).
- **Aceite:** PR com YAML quebrado é bloqueado.
- **Verificação:**
  ```bash
  docker compose config -q && npm test
  ```

### DEVOPS-03 · Sem `.gitignore` · [P3]

- **Arquivo:** *(ausente)* `.gitignore`
- **Evidência:** sem `.gitignore` no repo.
- **Impacto:** dados do Grafana (`dados_grafana` é volume nomeado, então não vai para o repo — ok), mas
  se alguém rodar local sem volume, `.gitignore` evita versionar config local.
- **Mudança:** `.gitignore` com `.env`, `node_modules/`, `*.log`.
- **Aceite:** `.gitignore` existe e cobre `.env`.
- **Verificação:** `git check-ignore -q .env && echo OK`.

---

## 7. Documentação

### DOC-01 · README não documenta portas expostas e senha · [P2]

- **Arquivo:** `README.md`
- **Evidência:** o README explica a stack; não avisa quais portas ficam no host (4317/4318/3100/3800)
  nem que `GRAFANA_PASSWORD` é obrigatória (nem que hoje é `admin`).
- **Impacto:** quem expõe o compose em servidor público não sabe que abriu OTLP, Loki e Grafana —
  o mesmo problema do `francos-commerce` (painel sem auth). Após `SEC-01`, documentar também como
  trocar a senha.
- **Mudança:** seção "Portas e segurança": tabela de porta/serviço/exposição recomendada; aviso de
  que OTLP/Loki devem ficar internos; como gerar/rotacionar `GRAFANA_PASSWORD`.
- **Aceite:** README tem a tabela de portas e a instrução de senha.
- **Verificação:** `grep -ni 'porta\|4318\|GRAFANA_PASSWORD' README.md`.

### DOC-02 · Falta `SECURITY.md` · [P3]

- **Arquivo:** *(ausente)* `SECURITY.md`
- **Evidência:** tem LICENSE/README, sem guia de reporte.
- **Impacto:** quem encontra exposição de OTLP/Loki não tem canal.
- **Mudança:** criar com canal + a regra "OTLP e Loki não devem ser expostos fora da rede docker".
- **Aceite:** arquivo existe.
- **Verificação:** `ls SECURITY.md`.

---

## 8. Ordem de execução (waves)

### Wave 1 — Fechar exposição (P0)
1. **`SEC-01`** — senha do Grafana obrigatória (fail-fast, sem default `admin`).
2. **`DEVOPS-01`** — `.env.example` com a senha (para o passo 1 ser usável).

> Depois da Wave 1, o Grafana não sobe com `admin`.

### Wave 2 — Fechar portas e supply chain (P1)
3. **`SEC-02`** — OTLP interno (ou com auth).
4. **`SEC-04`** — Loki interno.
5. **`SEC-03`** — pinar imagens (sem `latest`).

### Wave 3 — Robustez do SDK (P2)
6. **`BUG-01`** — drain no shutdown + flush aguardado.
7. **`BUG-03`** — timeout no fetch do collector.
8. **`BUG-02`** — teto de buffer.
9. **`SEC-05`** — `limits`/`memory_limiter` no collector.
10. **`TEST-01`** — teste do envelope/fallback.
11. **`DEVOPS-02`** — CI validando compose + config.

### Wave 4 — Polimento (P2/P3)
12. **`DEVOPS-03`**, **`DOC-01`**, **`DOC-02`**, **`IMP-01`**, **`IMP-02`**.

**Dependências que não podem ser invertidas:**
`SEC-01` junto com `DEVOPS-01` (fail-fast sem exemplo é pior) · `SEC-02`/`SEC-04` antes de `SEC-05`
(fechar a porta antes de limitar) · `BUG-03` antes de `BUG-02` (timeout antes do teto) ·
`BUG-01` junto com `TEST-01` (drain precisa de prova).

---

## 9. Fora de escopo / riscos

| Item | Decisão | Motivo |
|---|---|---|
| Assinar/organizar dashboards existentes | **Não** | O provider.yaml já provisiona; alterar é além do plano. |
| Trocar Loki por Tempo/Elastic | **Não** | Loki + Grafana é adequado ao volume; o problema é exposição, não escolha. |
| OTLP com TLS no collector | **Não, ainda** | Se o receiver ficar interno (SEC-02), TLS é desnecessário; reintroduzir só se expuser. |
| Alertas/regras no Grafana | **Não** | Feature nova. |
| Migrar o SDK para OpenTelemetry JS oficial | **Não, ainda** | O SDK atual é leve e tem o fallback que o oficial não garante; é uma troca grande sem ganho de segurança. |

**Riscos desta execução:**

- **`SEC-01` (fail-fast) quebra `docker compose up` de quem não definiu a senha.** É intencional
  (fail-fast > default inseguro), mas comunique — e o `.env.example` (`DEVOPS-01`) precisa existir
  **na mesma mudança**.
- **`SEC-02`/`SEC-04` (ports→expose) podem quebrar acesso externo legítimo** (ex.: Grafana accessed de
  outra máquina, ou collector em outro host). Se houver, manter a publicação **com auth** (não voltar
  ao aberto) e documentar.
- **`SEC-03` (pin de imagem) exige escolher versão compatível** com o `otel/config.yaml` e os
  dashboards provisionados — testar `docker compose up` antes de comitar.
- **`BUG-01` (drain no shutdown) pode delaying boot** se o collector estiver lento — usar timeout
  curto no drain.

---

## 10. Definição de pronto (DoD)

**Segurança**
- [ ] `SEC-01` — sem `GRAFANA_PASSWORD` o compose falha; senha nunca `admin`
- [ ] `SEC-02` — OTLP interno (ou com bearer); `4317/4318` não expostas
- [ ] `SEC-03` — nenhuma imagem `latest`
- [ ] `SEC-04` — Loki interno; `3100` não exposta
- [ ] `SEC-05` — `limits`/`memory_limiter` no collector

**Funcional**
- [ ] `BUG-01` — log no buffer é enviado no shutdown
- [ ] `BUG-02` — collector parado → memória do app estabiliza
- [ ] `BUG-03` — collector sem resposta não trava o app

**Testes e qualidade**
- [ ] `TEST-01` — envelope + fallback + flush em lote no `npm test`
- [ ] `IMP-01`, **`IMP-02`** — limite de atributos e nível mínimo (P3)

**Infra e documentação**
- [ ] `DEVOPS-01` — `.env.example` com `GRAFANA_PASSWORD`
- [ ] `DEVOPS-02` — CI validando compose + config
- [ ] `DEVOPS-03` — `.gitignore`
- [ ] `DOC-01` — README com tabela de portas
- [ ] `DOC-02` — `SECURITY.md`

**Validação final:**
```bash
docker compose config -q && npm test
grep -c 'latest' docker-compose.yml   # 0
```

---

*Fim do plano. Gerado por leitura direta do código em 2026-10-02. Nenhum item já estava corrigido*
*— todos apontam para defeitos ainda presentes.*
