# Modelo de valor dos itens (balance)

Este modelo responde a uma pergunta: **quanto, em gold, vale cada item do jogo?** Depois compara esse valor com o preço que está na loja, para mostrar quais itens estão caros ou baratos demais.

Você não precisa programar para usar o resultado. Abra [`output/report.md`](output/report.md) aqui no GitHub e leia.

## Como o modelo funciona

1. **Referência do Brotato.** O arquivo [`data/brotato_items.csv`](data/brotato_items.csv) lista os 247 itens do Brotato (jogo base e DLC) com tier, preço e stats. Os dados vêm do repositório [mojimoon/brotato](https://github.com/mojimoon/brotato), que é gerado a partir dos arquivos decompilados do próprio jogo. As colunas `source` e `verified` dizem de onde veio cada linha e se ela foi conferida contra a wiki. Os itens mais úteis para calibrar são os que só dão stats simples (ex.: +3 Max HP, -1 Regen), porque o preço deles reflete só esses stats. A conversão do JSON para CSV está em [`tools/build_brotato_dataset.py`](tools/build_brotato_dataset.py).
2. **Valor de cada stat.** O script descobre quanto o Brotato "cobra" por cada ponto de cada stat (por exemplo, quantos gold vale +1 Armor). É uma regressão de mínimos quadrados sem valores negativos, que erra o mínimo possível em porcentagem do preço. Penalidades subtraem, mas valem só **metade** do bônus equivalente (veja `--penalty-weight` abaixo).
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
| `game_adjust` | Multiplicador do nosso jogo. Padrão 1.0; Speed e pulo estão em 1.2 (platformer). Elemental está em 1.0 por decisão do Gallen. |
| `kind` | `fit` = vem do ajuste; `assumption` = ajuste mais uma premissa; `manual` = valor escolhido à mão. |

As linhas marcadas como `PREMISSA` na coluna `notes` são palpites explicados, não dados. Mude à vontade e rode de novo.

## Como rodar

Precisa só de Python 3 (nenhuma biblioteca extra). O script **não usa a internet**: lê os itens de um arquivo `item_config.csv` numa pasta.

```
python3 balance/value_model.py --configs balance/data/snapshot
```

- `--configs <pasta>`: pasta com o `item_config.csv` (o formato da exportação CSV da planilha Test). Se omitir, procura `../underpants-hero-lab-v2/configs` e, por último, `balance/data/snapshot`.
- `--out <pasta>`: onde gravar os resultados (padrão `balance/output`).
- `--penalty-weight <número>`: quanto vale cada stat negativo em relação ao positivo, **tanto no ajuste com o Brotato quanto na avaliação dos nossos itens** (padrão `0.5`). Com 0.5, `-2 Armor` custa metade do que `+2 Armor` vale; com 1.0 as penalidades têm o mesmo peso dos bônus. Motivo: no Brotato, penalidades baratearam menos o item do que seus bônus o encareceram, e com peso 1.0 itens como Wizard Hat e Behemoth Foam Fists saíam baratos demais.

`balance/data/snapshot/item_config.csv` é a cópia da planilha Test baixada em 06/10/2026. Para atualizar, exporte a aba `item_config` da planilha Test como CSV e substitua o arquivo. Só entram itens da seção `[Stackable Items]`, acima do marcador `[Archive]`.

O resultado é sempre o mesmo para os mesmos arquivos de entrada.

## Limites que você precisa conhecer

- A base do Brotato vem de dados extraídos do jogo e foi conferida contra a wiki (brotato.wiki.spellsandguns.com): 168 dos 247 itens têm `verified = yes` (os demais são sobretudo itens de DLC ou sem página na wiki). Nas conferências não houve nenhuma divergência.
- Itens vendidos por 1 gold (itens quebrados e torres do Builder) não entram nas contas.
- O Brotato não calcula o preço por fórmula. O modelo tem erro típico de 15 a 25% por item.
- Atributos que só existem no nosso jogo (pulo, coleta, ricochete) têm valores combinados à mão. Quando um desses domina o valor do item, o relatório avisa.
- Itens com efeito especial (hooks, pets, torres) não são bem avaliados por soma de stats.

## Como a telemetria vai entrar

Hoje o modelo usa só o preço do Brotato. Quando o jogo enviar telemetria, ela vai corrigir os pesos com o que os jogadores realmente fazem. Este é o plano; **nada disso está implementado ainda**.

1. **Taxa de escolha quando oferecido.** Para cada item, contar quantas vezes foi comprado dividido pelas vezes em que apareceu na loja (por tier e por onda). Um item comprado muito mais do que o valor do modelo prevê indica que o stat dele vale mais para os jogadores; um item ignorado indica o contrário.
2. **Resultado das partidas com o item.** Comparar a onda alcançada e a taxa de vitória de quem tinha o item com quem não tinha, controlando por onda de compra e por quantidade de outros itens. Isso mede o efeito real no jogo.
3. **Ajuste dos pesos por stat.** Os dois sinais viram um fator de correção por stat (ex.: Dodge vale 1.2× o valor do Brotato). Os fatores entram na coluna `game_adjust` de `attribute_map.csv`, com limite de variação por rodada e com mínimo de amostras antes de qualquer mudança.
4. **Nova leitura do relatório.** O mesmo script roda de novo e mostra a diferença entre o valor inicial (Brotato) e o valor ajustado pela telemetria.

## Regras de design (decididas pelo Gallen)

- **Nem tudo deve ficar equilibrado.** Alguns itens precisam ser fortes de propósito, para o jogador sentir o impacto e ficar feliz quando encontra. O modelo aponta desvios; ele não decide.
- **Toda decisão de balanceamento é discutida com o Gallen antes de ir para a planilha.**
- Pulo e velocidade valem mais aqui (x1.2), por ser um jogo de plataforma.
- Dano elemental vale o mesmo que no Brotato: vão entrar armas elementais novas.
- Explosão vale 0 só por enquanto; revisar quando entrarem armas que explodem.
- **O preço segue a economia da wave** (o ouro que o jogador junta por wave). Item que vale menos que o preço ganha atributos melhores; o preço não cai. A sugestão do modelo deve ser lida como "quanto de atributo falta", não como preço novo.
