# Underpants Hero — Telemetria e Balanceamento

Repositório de apoio ao balanceamento do Underpants Hero. O jogo em si fica em outro repositório; aqui ficam os modelos e as ferramentas de análise.

## O que tem aqui hoje

- [`balance/`](balance/README.md): modelo que estima o valor em gold de cada item (calibrado com itens do Brotato) e compara com o preço da loja. O relatório pronto está em [`balance/output/report.md`](balance/output/report.md).

## O que vem depois

- `server/`: receberá os eventos de telemetria enviados pelo jogo (ainda não existe).
- `dashboard/`: painel para ler esses dados e ajustar o modelo de `balance/` (ainda não existe).
