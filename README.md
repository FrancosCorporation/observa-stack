# Observa Stack

Stack local de observabilidade com OpenTelemetry Collector, Loki e Grafana. O Collector recebe OTLP,
envia logs ao Loki e usa limites de memória e tamanho de requisição. O Grafana carrega datasource e
dashboard do repositório; Loki e Grafana guardam dados em volumes Docker nomeados.

## Iniciar

Requer Docker Compose e Node.js 18 ou superior para usar o SDK.

```bash
cp .env.example .env
```

Gere uma senha para o administrador do Grafana e preencha `GRAFANA_PASSWORD` em `.env`:

```bash
openssl rand -base64 24
```

Depois suba a stack:

```bash
docker compose up -d
```

O Grafana fica em `http://127.0.0.1:3800` (usuário `admin`, senha definida em `.env`). O Collector
aceita aplicações no próprio host em `127.0.0.1:4317` (gRPC) e `127.0.0.1:4318` (HTTP). O Loki não
publica porta no host; Grafana e Collector o acessam pela rede Docker. As portas do host estão
limitadas ao loopback.

| Porta no host | Serviço | Acesso |
|---|---|---|
| `127.0.0.1:4317` | OTLP gRPC | Aplicações locais no host |
| `127.0.0.1:4318` | OTLP HTTP | Aplicações locais no host |
| `3100` | Loki | Interno à rede Docker; sem publicação no host |
| `127.0.0.1:3800` | Grafana | Navegador local; proxy remoto deve adicionar TLS e autenticação |

Os dados persistem nos volumes `dados_grafana` e `dados_loki`. Remover esses volumes apaga dashboards
salvos no Grafana e logs armazenados no Loki.

Se você já usava esta stack, trocar `GRAFANA_PASSWORD` pode não atualizar a senha gravada no volume
existente. Troque-a também pela interface administrativa do Grafana antes de liberar acesso remoto;
não remova o volume para redefinir a senha, pois isso apagaria os dados persistidos.

## Usar o SDK de logs

```js
import { instrumentar } from './src/instrumentar.js';

const logger = instrumentar('meu-app');
logger.info('app iniciou', { porta: 3000 });
logger.warn('tentativa novamente', { tentativa: 2 });
await logger.flush();
```

O SDK envia lotes OTLP JSON, espera no máximo 2 segundos por envio e imprime no stdout quando o
Collector está indisponível. Por padrão, registra `INFO` ou acima, limita o buffer a 1.000 registros,
o lote a 10 e os atributos por linha a 32. Ajuste o nível com `OBSERVA_LOG_LEVEL=DEBUG|INFO|WARN|ERROR`.

O logger expõe `shutdown()` para drenar o buffer na rotina de encerramento gracioso do aplicativo; o
processo também tenta drenar os loggers ativos antes de sair naturalmente (`beforeExit`).

Para uma aplicação dentro da mesma rede Docker, passe o endpoint interno ao SDK:

```js
const logger = instrumentar('meu-app', { url: 'http://otel-collector:4318/v1/logs' });
```

## Segurança e manutenção

- A senha do Grafana é obrigatória; não há senha padrão no Compose. Mantenha `.env` fora do Git.
- OTLP não tem autenticação própria nesta stack local; as portas publicadas aceitam conexões apenas
  do host. Não publique `4317`/`4318` em interfaces externas sem adicionar autenticação e firewall.
- Loki não tem camada própria de autenticação e não publica porta do host. Não o exponha diretamente.
- A porta `3800` também fica no loopback. Para acesso remoto, use proxy reverso com TLS e autenticação.
- As imagens têm versões explícitas. Atualize os pins depois de revisar os changelogs e validar a
  configuração do Collector para a versão escolhida.

## Desenvolvimento

```bash
npm run check
npm test
```

O workflow executa a suíte existente, verifica a sintaxe do SDK e valida a configuração do Compose.

## Licença

MIT — Rodolfo Franco ([FrancosCorporation](https://github.com/FrancosCorporation)).
