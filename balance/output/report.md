# Relatório do modelo de valor em gold — Underpants Hero

Gerado por `balance/value_model.py`. Fonte dos itens: `balance/data/snapshot/item_config.csv` (93 itens ativos, seção `[Stackable Items]`).

## Como ler

- **Valor do modelo** = soma de (quantidade de cada atributo × gold por unidade). Penalidades subtraem.
- **Ratio** = valor do modelo ÷ preço atual na loja. Perto de 1,00 está coerente com o Brotato.
  - Ratio **abaixo de 0.75**: o item custa mais do que seus stats valem (preço alto).
  - Ratio **acima de 1.33**: o item custa menos do que seus stats valem (preço baixo, tende a ser escolhido sempre).
- **Preço sugerido** é o valor do modelo arredondado para múltiplos de 5 (mínimo 5; vazio se o valor líquido for zero ou negativo). É um ponto de partida, não uma ordem.
- **Cuidado com penalidades grandes**: o modelo subtrai uma penalidade pelo mesmo valor que soma o bônus. No Brotato o desconto de penalidade costuma ser menor (Mastery, Cog e Goat Skull são outliers por isso), então itens como Behemoth Foam Fists e Wizard Hat saem baratos demais aqui.
- Itens com **máximo 1** ou **hook** têm efeito que a soma de stats planos não enxerga; trate o valor como piso.
- Atributos só do nosso jogo (pulo, coleta, ricochete...) usam **premissas manuais**: veja `balance/data/attribute_map.csv`. Itens que dependem muito delas recebem o aviso 'depende de premissa'.

## Qualidade do ajuste

| Medida | Valor |
|---|---|
| Itens do Brotato na base | 157 |
| Itens 'limpos' (só stats planos conhecidos) | 87 |
| Itens usados no ajuste final (sem outliers) | 75 |
| R² (itens do ajuste final) | 0.803 |
| R² (todos os itens limpos, incluindo outliers) | 0.509 |
| Erro % absoluto mediano (no ajuste) | 15.3% |
| Erro % absoluto médio (no ajuste) | 18.9% |
| Erro % absoluto mediano deixando um item de fora (validação) | 23.3% |

Outliers (erro maior que 50%) retirados do ajuste. Preço no Brotato x valor segundo o modelo:

| Item Brotato | Tier | Preço | Valor do modelo | Ratio |
|---|---|---|---|---|
| Book | 1 | 15 | 26.0 | 1.74 |
| Cog | 2 | 35 | 10.1 | 0.29 |
| Diploma | 4 | 90 | 151.1 | 1.68 |
| Energy Bracelet | 2 | 55 | 29.3 | 0.53 |
| Gambling Token | 2 | 50 | 16.9 | 0.34 |
| Gnome | 4 | 100 | 165.2 | 1.65 |
| Goat Skull | 1 | 25 | 7.1 | 0.28 |
| Lens | 1 | 20 | 5.9 | 0.29 |
| Mastery | 2 | 55 | 3.1 | 0.06 |
| Potato | 4 | 95 | 174.4 | 1.84 |
| Small Magazine | 2 | 60 | 22.0 | 0.37 |
| Toolbox | 3 | 55 | 20.7 | 0.38 |

Pacotes com muitos stats pequenos (como o Potato) saem com valor bem acima do preço no próprio Brotato: o jogo original vende esses pacotes com desconto. O mesmo vale para o nosso Cauldron Family Casserole.

Leitura honesta: o Brotato não precifica por uma fórmula; os preços são arredondados à mão e variam por tier. O modelo captura a ordem de grandeza, não o preço exato. Use ratios entre 0.75 e 1.33 como 'ok'.

## Valor por stat do Brotato (gold por unidade)

| Stat | Gold por unidade | Itens no ajuste | Confiança |
|---|---|---|---|
| Max HP | 7.08 | 18 | boa |
| HP Regeneration | 9.48 | 15 | boa |
| % Life Steal | 15.53 | 12 | boa |
| % Damage | 5.53 | 16 | boa |
| Melee Damage | 6.52 | 16 | boa |
| Ranged Damage | 12.01 | 13 | boa |
| Elemental Damage | 14.17 | 10 | boa |
| % Attack Speed | 3.12 | 10 | boa |
| % Crit Chance | 6.24 | 13 | boa |
| Engineering | 7.61 | 7 | média |
| Range | 1.22 | 13 | boa |
| Armor | 23.81 | 11 | boa |
| % Dodge | 5.09 | 11 | boa |
| % Speed | 6.55 | 12 | boa |
| Luck | 3.34 | 12 | boa |
| Harvesting | 3.03 | 8 | boa |
| Knockback | 1.81 | 8 | boa |
| % XP Gain | 1.92 | 4 | média |
| % Pickup Range | 0.86 | 2 | baixa (n<4) |
| HP de consumível | 20.09 | 2 | baixa (n<4) |

Engineering foi ajustado com os itens do Brotato, mas **não existe no nosso jogo** (não entra no cálculo).

## Valor por atributo do Underpants Hero (já com as premissas)

| Atributo | Gold por unidade nossa | Ajuste do jogo | Origem | Gold por 1 UP (estudo anterior) |
|---|---|---|---|---|
| max_hp | 7.077 | 1.00 | ajuste Brotato | 21.2 |
| hp_regeneration | 9.478 | 1.00 | ajuste Brotato | 9.5 |
| life_steal_chance | 1553.263 | 1.00 | ajuste Brotato | 15.5 |
| base_damage | 552.744 | 1.00 | ajuste Brotato | 27.6 |
| melee_damage | 6.519 | 1.00 | ajuste Brotato | 13.0 |
| ranged_damage | 12.012 | 1.00 | ajuste Brotato | 12.0 |
| elemental_damage | 14.173 | 1.00 | ajuste Brotato | 14.2 |
| bonus_attack_speed | 311.655 | 1.00 | ajuste Brotato | 15.6 |
| crit_damage_chance | 624.402 | 1.00 | ajuste Brotato | 18.7 |
| player_range | 1.224 | 1.00 | ajuste Brotato | 18.4 |
| defense_ratio | 2381.135 | 1.00 | ajuste Brotato | 23.8 |
| dodge_chance | 509.355 | 1.00 | ajuste Brotato | 15.3 |
| movement_speed_multiplier | 786.326 | 1.20 | ajuste + premissa | 23.6 |
| luck | 3.342 | 1.00 | ajuste Brotato | 16.7 |
| hustle | 3.028 | 1.00 | ajuste Brotato |  |
| knockback_force | 1.813 | 1.00 | ajuste + premissa |  |
| xp_gain | 192.446 | 1.00 | ajuste Brotato |  |
| consumable_heal | 20.094 | 1.00 | ajuste Brotato |  |
| pickup_range | 1.434 | 1.00 | ajuste + premissa |  |
| jump_force | 0.786 | 1.20 | ajuste + premissa |  |
| max_jumps | 47.180 | 1.20 | ajuste + premissa |  |
| items_price | -300.000 | 1.00 | premissa manual |  |
| bonus_store_reroll | 30.000 | 1.00 | premissa manual |  |
| auto_magnet_on_drop_chance | 30.000 | 1.00 | premissa manual |  |
| victim_additional_health_drop_chance | 400.000 | 1.00 | premissa manual |  |
| projectile_bounces | 30.000 | 1.00 | premissa manual |  |
| piercing | 25.000 | 1.00 | premissa manual |  |
| pierce_damage_falloff | 0.000 | 1.00 | premissa manual |  |
| explosion_damage | 0.000 | 1.00 | premissa manual |  |
| explosion_scale | 0.000 | 1.00 | premissa manual |  |
| gold_gain | 0.000 | 1.00 | premissa manual |  |
| drop_collection_damage_chance | 0.000 | 1.00 | premissa manual |  |
| drop_collection_damage_amount | 0.000 | 1.00 | premissa manual |  |
| enemy_quantity | 0.000 | 1.00 | premissa manual |  |
| enemy_movement_speed | 0.000 | 1.00 | premissa manual |  |
| enemy_max_hp | 0.000 | 1.00 | premissa manual |  |

A última coluna reaproveita a tabela 'T1 reference' da aba `item_budget` do estudo anterior (quantos pontos de atributo valem 1 UP de level-up Tier 1). Se o estudo anterior estivesse perfeitamente alinhado ao Brotato, essa coluna seria constante; a variação mostra onde as duas visões divergem.

## Faixas de preço por tier (Brotato)

| Tier | Itens | Preço mín. | Mediana | Preço máx. |
|---|---|---|---|---|
| 1 | 46 | 8 | 20 | 30 |
| 2 | 43 | 25 | 45 | 65 |
| 3 | 40 | 50 | 72.5 | 90 |
| 4 | 28 | 90 | 100 | 130 |

Limiares ajustados (preço mínimo de cada tier, acerto de 93% dos itens do Brotato): **Tier 2 a partir de 35, Tier 3 a partir de 65, Tier 4 a partir de 90**. Os tiers 2 e 3 se sobrepõem muito no Brotato, então a sugestão de tier é aproximada.

## 15 itens com preço mais alto que o valor (ratio mais baixo)

| ID | Nome | Tier | Preço | Valor | Ratio | Sugerido | Premissa? |
|---|---|---|---|---|---|---|---|
| item_103 | Lucky Coin | 4 | 105 | -41.4 | -0.39 |  |  |
| item_45 | Behemoth Foam Fists | 2 | 55 | 3.1 | 0.06 | 5 |  |
| keep_out_tape | Keep-Out Tape | 1 | 20 | 2.5 | 0.13 | 5 | sim |
| item_83 | Bedspring | 3 | 70 | 10.9 | 0.16 | 10 | sim |
| item_13 | Dumbbell | 1 | 25 | 7.1 | 0.28 | 5 |  |
| item_76 | Slushie Cup | 2 | 50 | 14.2 | 0.28 | 15 |  |
| item_5 | Anger | 1 | 20 | 5.7 | 0.28 | 5 |  |
| item_60 | Lens | 1 | 20 | 5.9 | 0.29 | 5 |  |
| item_32 | Black Bandana | 2 | 50 | 16.9 | 0.34 | 15 |  |
| item_38 | Sunglasses | 2 | 60 | 22.0 | 0.37 | 20 |  |
| fast_hands | Kleptomania | 1 | 18 | 7.5 | 0.42 | 10 | sim |
| item_1 | Brass Knuckles | 1 | 18 | 8.3 | 0.46 | 10 |  |
| item_35 | Heartbound Necklace | 2 | 40 | 20.0 | 0.50 | 20 | sim |
| item_18 | Clover | 1 | 25 | 12.6 | 0.50 | 15 |  |
| item_14 | Heroes Magazine | 1 | 30 | 15.6 | 0.52 | 15 |  |

## 15 itens com preço mais baixo que o valor (ratio mais alto)

| ID | Nome | Tier | Preço | Valor | Ratio | Sugerido | Premissa? |
|---|---|---|---|---|---|---|---|
| item_10 | Glasses | 1 | 18 | 35.4 | 1.96 | 35 |  |
| gnome | Tunnel Vision | 4 | 100 | 189.7 | 1.90 | 190 |  |
| item_108 | Cauldron Family Casserole | 4 | 95 | 178.3 | 1.88 | 180 |  |
| item_37 | Clean Socks | 2 | 30 | 48.8 | 1.63 | 50 | sim |
| cap | Cap | 1 | 20 | 31.5 | 1.57 | 30 | sim |
| item_84 | Running Shoes | 3 | 65 | 98.5 | 1.52 | 100 | sim |
| item_25 | Water Jug | 2 | 35 | 50.1 | 1.43 | 50 |  |
| item_40 | Handwraps | 2 | 40 | 56.7 | 1.42 | 55 |  |
| item_107 | Lucky Teddy | 4 | 100 | 140.8 | 1.41 | 140 |  |
| item_59 | Lemonade | 1 | 15 | 20.1 | 1.34 | 20 |  |
| expired_health_potion | Hamburguer | 1 | 15 | 20.1 | 1.34 | 20 |  |
| item_44 | Radioactive Soap | 2 | 45 | 57.0 | 1.27 | 55 |  |
| item_53 | Vampire Comic | 1 | 20 | 25.0 | 1.25 | 25 |  |
| item_106 | Regenerative Patch | 4 | 105 | 129.0 | 1.23 | 130 |  |
| item_16 | Experimental Injection | 1 | 20 | 24.5 | 1.23 | 25 |  |

'Premissa?' = mais da metade do valor vem de atributos com premissa manual; confirme esses antes de mexer no preço.

## Itens pedidos

### cape — Survival Instincts

- Tier 1, preço 110, máximo INF.
- Valor do modelo: **114.1**; ratio: **1.04**; sugestão: preço 115, tier 4.
- Composição: life_steal_chance +0.05 = +77.7; dodge_chance +0.2 = +101.9; melee_damage -2 = -13.0; ranged_damage -2 = -24.0; elemental_damage -2 = -28.3.
- Avisos: tier 1 na planilha, mas preco 110 cai na faixa do tier 4.
- Nota: Equivale ao Cape do Brotato (Tier 4, 110 gold). Se a coluna Tier mostrar 1, o desencontro é de Tier, não de preço.

### item_72 — Participation Medal

- Tier 2, preço 55, máximo INF.
- Valor do modelo: **60.2**; ratio: **1.10**; sugestão: preço 60, tier 2.
- Composição: max_hp +3 = +21.2; base_damage +0.03 = +16.6; defense_ratio +0.01 = +23.8; movement_speed_multiplier +0.03 = +23.6; crit_damage_chance -0.04 = -25.0.
- Nota: Pacote misto de cinco stats pequenos, como o Medal do Brotato (Tier 2, 55 gold). A soma de stats planos é a avaliação mais confiável aqui.

### item_108 — Cauldron Family Casserole

- Tier 4, preço 95, máximo INF.
- Valor do modelo: **178.3**; ratio: **1.88**; sugestão: preço 180, tier 4.
- Composição: max_hp +3 = +21.2; hp_regeneration +2 = +19.0; life_steal_chance +0.01 = +15.5; base_damage +0.05 = +27.6; bonus_attack_speed +0.05 = +15.6; movement_speed_multiplier +0.03 = +23.6; dodge_chance +0.03 = +15.3; defense_ratio +0.01 = +23.8; luck +5 = +16.7.
- Avisos: PRECO BAIXO vs valor (ratio>1.33).
- Nota: Equivale ao Potato do Brotato (Tier 4, 95 gold), nove stats pequenos. No próprio Brotato esse pacote sai com valor muito acima do preço (ver outliers): o ratio alto é, em parte, o desconto de pacote do original, não necessariamente erro de preço.

### item_109 — Pocket Teleporter

- Tier 4, preço 100, máximo 1.
- Valor do modelo: **101.4**; ratio: **1.01**; sugestão: preço 100, tier 4.
- Composição: defense_ratio +0.03 = +71.4; auto_magnet_on_drop_chance +1 = +30.0.
- Avisos: UNICO/HOOK: stats planos subestimam o item.
- Nota: Máximo 1 e atração automática de drops: o valor de coleta é uma premissa manual (ver attribute_map.csv). Stats planos subestimam o item.

### item_103 — Lucky Coin

- Tier 4, preço 105, máximo 1.
- Valor do modelo: **-41.4**; ratio: **-0.39**; sugestão: preço , tier .
- Composição: crit_damage_chance +0.01 = +6.2; defense_ratio -0.02 = -47.6.
- Avisos: UNICO/HOOK: stats planos subestimam o item; PRECO ALTO vs valor (ratio<0.75); valor liquido <= 0.
- Nota: Máximo 1. No Brotato, o Lucky Coin dá +2 Luck por 1% de Crit Chance e -2 Armor; o efeito principal é essa conversão, que só existe como hook. Sem o hook, sobram os stats planos, que somam pouco ou negativo.

### vampire_fang — Vampire Teeth

- Tier 1, preço 25, máximo INF.
- Valor do modelo: **21.6**; ratio: **0.86**; sugestão: preço 20, tier 1.
- Composição: life_steal_chance +0.02 = +31.1; hp_regeneration -1 = -9.5.
- Nota: Âncora simples de Life Steal: Fresh Meat (+2% Life Steal, -1 HP Regen, 25 gold) e Bat (+2%, -2 Harvesting, 20 gold) no Brotato.

### heavy_bullets — High Caliber

- Tier 4, preço 100, máximo INF.
- Valor do modelo: **80.8**; ratio: **0.81**; sugestão: preço 80, tier 3.
- Composição: ranged_damage +5 = +60.1; base_damage +0.1 = +55.3; player_range +10 = +12.2; bonus_attack_speed -0.05 = -15.6; crit_damage_chance -0.05 = -31.2.
- Nota: Equivale ao Heavy Bullets do Brotato (Tier 4, 100 gold, com +10 Range). Bom teste de calibração: se o ratio ficar longe de 1, suspeite do valor de % Damage, Range e Attack Speed.

## Lacunas de dados

- A base do Brotato foi coletada da wiki em 157 itens, de Acid até Tyler (ordem alfabética); itens de Ugly Tooth em diante não foram coletados.
- Itens do Brotato sem stats planos (pets, torres, efeitos de wave) ficam fora do ajuste; eles aparecem na base apenas com notas.
- O Brotato muda preços por wave e por dificuldade; usamos o preço base da wiki.
- Stats com poucos itens (Knockback, XP Gain, Pickup Range, HP de consumível) têm valor pouco confiável.
- Atributos só do nosso jogo dependem de premissas manuais; nenhum dado de partida (telemetria) entrou ainda.
