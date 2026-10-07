# Underpants Hero — Telemetria e Balanceamento

Repositório de apoio ao balanceamento do Underpants Hero. O jogo em si fica em outro repositório; aqui ficam os modelos e as ferramentas de análise.

## O que tem aqui hoje

- [`server/`](server/): servidor de telemetria (Cloudflare Worker + D1). Veja a seção abaixo.
- [`balance/`](balance/README.md): modelo que estima o valor em gold de cada item (calibrado com itens do Brotato) e compara com o preço da loja. O relatório pronto está em [`balance/output/report.md`](balance/output/report.md).

## O que vem depois

- `dashboard/`: painel para ler esses dados e ajustar o modelo de `balance/` (ainda não existe).

## Servidor de telemetria (`server/`)

Cloudflare Worker + banco D1 que recebe o que o jogo envia (`addons/uh_telemetry`) e mostra agregados. Não guarda IP nem user agent, e não registra o corpo das requisições.

| Rota | Auth | O que faz |
|---|---|---|
| `POST /v1/runs` | `Authorization: Bearer <INGEST_KEY>` | Recebe a run (gzip ou JSON). Aceita o resumo `uh-run-summary/1` e os envelopes antigos `uh-transport/0.1`. Idempotente; limite de 1 MiB descomprimido e 200 runs novos por `grant_id` por dia. |
| `POST /v1/feedback` | idem | Nota 1-5, comentário (até 1000 caracteres) e tags. Aceita o formato atual do cliente (`uh-feedback/0.1`) e `{run_id, grant_id, rating, comment, tags}`. |
| `GET /v1/stats?key=<DASH_KEY>` | `DASH_KEY` | JSON com os agregados. Filtros: `build`, `difficulty`, `from`, `to` (AAAA-MM-DD). |
| `GET /dashboard?key=<DASH_KEY>` | `DASH_KEY` | Painel HTML em português. Sem `DASH_KEY` configurada, `/v1/stats` e `/dashboard` dão 404. |
| `GET /v1/health` | nenhuma | `{"ok":true}`. |

### Configuração única (dono do repositório)

1. **Cloudflare, token de API:** Dashboard > My Profile > API Tokens > Create Token > Custom token, com as permissões `Account > Workers Scripts > Edit` e `Account > D1 > Edit`, escopo na sua conta. Copie o token.
2. **Cloudflare, ids e subdomínio:** copie o *Account ID* (Workers & Pages, coluna da direita). Se a conta nunca publicou um Worker, abra Workers & Pages uma vez para registrar o subdomínio `workers.dev`.
3. **GitHub > Settings > Secrets and variables > Actions**, crie quatro secrets:
   - `CLOUDFLARE_API_TOKEN`: o token do passo 1.
   - `CLOUDFLARE_ACCOUNT_ID`: o Account ID do passo 2.
   - `UH_INGEST_KEY`: uma string aleatória (por exemplo `openssl rand -hex 24`). É a chave que o jogo leva (`write_token` em `user://telemetry_remote.cfg`).
   - `UH_DASH_KEY`: outra string aleatória, só sua, para abrir o painel.
4. Rode **Actions > Deploy do servidor de telemetria > Run workflow** (ou dê push em `main` mexendo em `server/`). O workflow testa, cria o banco `uh-telemetry` se faltar, aplica as migrações, publica e imprime a URL.
5. Painel: `https://<url-impressa>/dashboard?key=<UH_DASH_KEY>`. No jogo, `endpoint` = a URL impressa (sem barra no fim) e `write_token` = `UH_INGEST_KEY`.

Desenvolvimento local: `cd server && npm install && npm test`.
