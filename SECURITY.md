# Segurança

## Reportar vulnerabilidades

Envie detalhes em privado pelo canal de contato dos mantenedores em
[FrancosCorporation no GitHub](https://github.com/FrancosCorporation). Inclua passos para reproduzir,
impacto e versões afetadas. Não publique logs reais, senhas ou dados de aplicações em issues públicas.

## Limites da stack

- OTLP e Loki não devem ser publicados em interfaces de rede externas. Nesta configuração, OTLP fica
  acessível apenas no loopback do host e Loki somente na rede Docker.
- A porta do Grafana também fica no loopback. Para acesso remoto, use proxy reverso com TLS e
  autenticação, e mantenha `GRAFANA_PASSWORD` forte e fora do Git.
- O Collector limita mensagens OTLP a 8 MiB e usa `memory_limiter` antes dos demais processadores.
- Os volumes `dados_loki` e `dados_grafana` contêm logs e configuração operacional; restrinja acesso
  ao daemon Docker e faça backup conforme a política de retenção do ambiente.
