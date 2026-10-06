# Modelo de valor dos itens (balance)

Este modelo responde a uma pergunta: **quanto, em gold, vale cada item do jogo?** Depois compara esse valor com o preço que está na loja, para mostrar quais itens estão caros ou baratos demais.

Você não precisa programar para usar o resultado. Abra [`output/report.md`](output/report.md) aqui no GitHub e leia.

## Como o modelo funciona

1. **Referência do Brotato.** O arquivo [`data/brotato_items.csv`](data/brotato_items.csv) lista itens do Brotato com tier, preço e stats. Os itens mais úteis são os que só dão stats simples (ex.: +3 Max HP, -1 Regen), porque o preço deles reflete só esses stats.
2. **Valor de cada stat.** O script descobre quanto o Brotato "cobra" por cada ponto de cada stat (por exemplo, quantos gold vale +1 Armor). É uma regressão de mínimos quadrados sem valores negativos, que erra o mínimo possível em porcentagem do preço. Penalidades subtraem.
3. **Tradução para o nosso jogo.** O arquivo [`data/attribute_map.csv`](data/attribute_map.csv) diz qual stat do Brotato corresponde a cada atributo nosso e como converter a unidade (ex.: `life_steal_chance` 0.02 = 2%).
4. **Valor do item.** Soma de (valor do atributo × quantidade) para todos os atributos do item. O **ratio** é esse valor dividido pelo preço atual.
5. **Sugestões.** Preço sugerido = valor arredondado de 5 em 5. Tier sugerido = faixa de preço do Brotato em que esse preço cairia.

## Como ler os resultados

- `output/report.md`: relatório em português com a qualidade do ajuste, o valor de cada stat, os 15 itens mais caros e mais baratos em relação ao valor, e uma análise de itens específicos.
- `output/item_values.csv`: uma linha por item, para abrir em planilha. Colunas: `id`, `name`, `tier`, `price`, `model_value`, `ratio`, `suggested_price`, `suggested_tier`, `flags`, `breakdown` (quanto cada atributo contribuiu) e `assumption_share` (parte do valor que vem de premissas manuais).
- **Ratio entre 0.75 e 1.33** é considerado ok. Abaixo de 0.75 o item está caro para o que entrega. Acima de 1.33 está barato.
- Itens com **máximo 1** ou com **hook** têm um efeito que a soma de stats não enxerga; o valor deles é um piso.

## Quais números você pode mexer

Em [`data/attribute_map.csv`](data/attribute_map.csv):

| Coluna | Para que serve |
|---|---|
| `scale` | Converte a unidade do nosso jogo para a do Brotato (ex.: 100 para porcentagens). |
| `manual_gold_per_unit` | Se preenchido, ignora o Brotato e usa esse valor em gold por unidade nossa. |
| `game_adjust` | Multiplicador do nosso jogo. Padrão 1.0; Speed e pulo estão em 1.2 (platformer) e Elemental em 0.5 (só a Green Laser usa). |
| `kind` | `fit` = vem do ajuste; `assumption` = ajuste mais uma premissa; `manual` = valor escolhido à mão. |

As linhas marcadas como `PREMISSA` na coluna `notes` são palpites explicados, não dados. Mude à vontade e rode de novo.

## Como rodar

Precisa só de Python 3 (nenhuma biblioteca extra). O script **não usa a internet**: lê os itens de um arquivo `item_config.csv` numa pasta.

```
python3 balance/value_model.py --configs balance/data/snapshot
```

- `--configs <pasta>`: pasta com o `item_config.csv` (o formato da exportação CSV da planilha Test). Se omitir, procura `../underpants-hero-lab-v2/configs` e, por último, `balance/data/snapshot`.
- `--out <pasta>`: onde gravar os resultados (padrão `balance/output`).

`balance/data/snapshot/item_config.csv` é a cópia da planilha Test baixada em 06/10/2026. Para atualizar, exporte a aba `item_config` da planilha Test como CSV e substitua o arquivo. Só entram itens da seção `[Stackable Items]`, acima do marcador `[Archive]`.

O resultado é sempre o mesmo para os mesmos arquivos de entrada.

## Limites que você precisa conhecer

- A base do Brotato foi extraída da wiki (brotato.wiki.spellsandguns.com) por leitura automática e cobre os itens de Acid até Tyler em ordem alfabética. Há chance de erros de transcrição em itens isolados; vale conferir os que parecerem estranhos.
- O Brotato não calcula o preço por fórmula. O modelo tem erro típico de 15 a 25% por item.
- Atributos que só existem no nosso jogo (pulo, coleta, ricochete) têm valores combinados à mão. Quando um desses domina o valor do item, o relatório avisa.
- Itens com efeito especial (hooks, pets, torres) não são bem avaliados por soma de stats.

## Como a telemetria vai entrar

Hoje o modelo usa só o preço do Brotato. Quando o jogo enviar telemetria, ela vai corrigir os pesos com o que os jogadores realmente fazem. Este é o plano; **nada disso está implementado ainda**.

1. **Taxa de escolha quando oferecido.** Para cada item, contar quantas vezes foi comprado dividido pelas vezes em que apareceu na loja (por tier e por onda). Um item comprado muito mais do que o valor do modelo prevê indica que o stat dele vale mais para os jogadores; um item ignorado indica o contrário.
2. **Resultado das partidas com o item.** Comparar a onda alcançada e a taxa de vitória de quem tinha o item com quem não tinha, controlando por onda de compra e por quantidade de outros itens. Isso mede o efeito real no jogo.
3. **Ajuste dos pesos por stat.** Os dois sinais viram um fator de correção por stat (ex.: Dodge vale 1.2× o valor do Brotato). Os fatores entram na coluna `game_adjust` de `attribute_map.csv`, com limite de variação por rodada e com mínimo de amostras antes de qualquer mudança.
4. **Nova leitura do relatório.** O mesmo script roda de novo e mostra a diferença entre o valor inicial (Brotato) e o valor ajustado pela telemetria.
