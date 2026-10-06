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
| Itens do Brotato na base | 241 |
| Itens 'limpos' (só stats planos conhecidos) | 93 |
| Itens usados no ajuste final (sem outliers) | 87 |
| R² (itens do ajuste final) | 0.762 |
| R² (todos os itens limpos, incluindo outliers) | 0.717 |
| Erro % absoluto mediano (no ajuste) | 16.9% |
| Erro % absoluto médio (no ajuste) | 19.0% |
| Erro % absoluto mediano deixando um item de fora (validação) | 23.7% |

Outliers (erro maior que 50%) retirados do ajuste. Preço no Brotato x valor segundo o modelo:

| Item Brotato | Tier | Preço | Valor do modelo | Ratio |
|---|---|---|---|---|
| Alien Worm | 1 | 15 | 27.4 | 1.82 |
| Boiling Water | 1 | 30 | 12.6 | 0.42 |
| Energy Bracelet | 2 | 55 | 22.4 | 0.41 |
| Gambling Token | 2 | 50 | 19.7 | 0.39 |
| Lens | 1 | 20 | 10.1 | 0.50 |
| Mastery | 2 | 55 | 16.3 | 0.30 |

Penalidades pesam 0.5 vezes o bônus equivalente (parâmetro `--penalty-weight`), no ajuste e na avaliação.

Leitura honesta: o Brotato não precifica por uma fórmula; os preços são arredondados à mão e variam por tier. O modelo captura a ordem de grandeza, não o preço exato. Use ratios entre 0.75 e 1.33 como 'ok'.

## Valor por stat do Brotato (gold por unidade)

| Stat | Gold por unidade | Itens no ajuste | Confiança |
|---|---|---|---|
| Max HP | 6.29 | 19 | boa |
| HP Regeneration | 7.45 | 14 | boa |
| % Life Steal | 12.59 | 14 | boa |
| % Damage | 4.24 | 19 | boa |
| Melee Damage | 5.86 | 19 | boa |
| Ranged Damage | 12.56 | 15 | boa |
| Elemental Damage | 7.86 | 13 | boa |
| % Attack Speed | 2.61 | 13 | boa |
| % Crit Chance | 4.82 | 14 | boa |
| Engineering | 6.92 | 12 | boa |
| Range | 1.00 | 15 | boa |
| Armor | 18.65 | 14 | boa |
| % Dodge | 3.63 | 13 | boa |
| % Speed | 5.20 | 14 | boa |
| Luck | 2.75 | 15 | boa |
| Harvesting | 2.52 | 10 | boa |
| Knockback | 2.45 | 10 | boa |
| % XP Gain | 1.37 | 5 | média |
| % Pickup Range | 0.82 | 3 | baixa (n<4) |
| HP de consumível | 12.79 | 2 | baixa (n<4) |

Engineering foi ajustado com os itens do Brotato, mas **não existe no nosso jogo** (não entra no cálculo).

## Valor por atributo do Underpants Hero (já com as premissas)

| Atributo | Gold por unidade nossa | Ajuste do jogo | Origem | Gold por 1 UP (estudo anterior) |
|---|---|---|---|---|
| max_hp | 6.285 | 1.00 | ajuste Brotato | 18.9 |
| hp_regeneration | 7.455 | 1.00 | ajuste Brotato | 7.5 |
| life_steal_chance | 1259.001 | 1.00 | ajuste Brotato | 12.6 |
| base_damage | 423.802 | 1.00 | ajuste Brotato | 21.2 |
| melee_damage | 5.857 | 1.00 | ajuste Brotato | 11.7 |
| ranged_damage | 12.557 | 1.00 | ajuste Brotato | 12.6 |
| elemental_damage | 7.858 | 1.00 | ajuste Brotato | 7.9 |
| bonus_attack_speed | 260.708 | 1.00 | ajuste Brotato | 13.0 |
| crit_damage_chance | 482.216 | 1.00 | ajuste Brotato | 14.5 |
| player_range | 0.995 | 1.00 | ajuste Brotato | 14.9 |
| defense_ratio | 1864.579 | 1.00 | ajuste Brotato | 18.6 |
| dodge_chance | 362.737 | 1.00 | ajuste Brotato | 10.9 |
| movement_speed_multiplier | 623.492 | 1.20 | ajuste + premissa | 18.7 |
| luck | 2.752 | 1.00 | ajuste Brotato | 13.8 |
| hustle | 2.519 | 1.00 | ajuste Brotato |  |
| knockback_force | 3.600 | 1.00 | premissa manual |  |
| xp_gain | 136.542 | 1.00 | ajuste Brotato |  |
| consumable_heal | 12.794 | 1.00 | ajuste Brotato |  |
| pickup_range | 1.375 | 1.00 | ajuste + premissa |  |
| jump_force | 0.623 | 1.20 | ajuste + premissa |  |
| max_jumps | 37.410 | 1.20 | ajuste + premissa |  |
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
| 1 | 62 | 8 | 20 | 30 |
| 2 | 71 | 25 | 45 | 75 |
| 3 | 68 | 23 | 70 | 100 |
| 4 | 40 | 80 | 100 | 130 |

Limiares ajustados (preço mínimo de cada tier, acerto de 88% dos itens do Brotato): **Tier 2 a partir de 30, Tier 3 a partir de 60, Tier 4 a partir de 90**. Os tiers 2 e 3 se sobrepõem muito no Brotato, então a sugestão de tier é aproximada.

## 15 itens com preço mais alto que o valor (ratio mais baixo)

| ID | Nome | Tier | Preço | Valor | Ratio | Sugerido | Premissa? |
|---|---|---|---|---|---|---|---|
| item_103 | Lucky Coin | 4 | 105 | -13.8 | -0.13 |  |  |
| item_76 | Slushie Cup | 2 | 50 | 7.9 | 0.16 | 10 |  |
| item_45 | Behemoth Foam Fists | 2 | 55 | 16.3 | 0.30 | 15 |  |
| item_83 | Bedspring | 3 | 70 | 21.6 | 0.31 | 20 | sim |
| item_5 | Anger | 1 | 20 | 7.5 | 0.38 | 10 |  |
| item_32 | Black Bandana | 2 | 50 | 19.7 | 0.39 | 20 |  |
| fast_hands | Kleptomania | 1 | 18 | 7.5 | 0.42 | 10 | sim |
| fire_potion | Dirty Underwear | 1 | 30 | 12.6 | 0.42 | 15 |  |
| item_31 | Wizard Hat | 2 | 45 | 22.2 | 0.49 | 20 |  |
| item_35 | Heartbound Necklace | 2 | 40 | 20.0 | 0.50 | 20 | sim |
| item_60 | Lens | 1 | 20 | 10.1 | 0.50 | 10 |  |
| item_13 | Dumbbell | 1 | 25 | 12.7 | 0.51 | 15 |  |
| item_1 | Brass Knuckles | 1 | 18 | 9.5 | 0.53 | 10 |  |
| item_30 | Welder's Mask | 2 | 55 | 32.1 | 0.58 | 30 |  |
| item_20 | Photon Core Bullets | 1 | 25 | 15.0 | 0.60 | 15 |  |

## 15 itens com preço mais baixo que o valor (ratio mais alto)

| ID | Nome | Tier | Preço | Valor | Ratio | Sugerido | Premissa? |
|---|---|---|---|---|---|---|---|
| item_10 | Glasses | 1 | 18 | 39.3 | 2.18 | 40 |  |
| expired_health_potion | Hamburguer | 1 | 15 | 27.4 | 1.82 | 25 |  |
| item_108 | Cauldron Family Casserole | 4 | 95 | 142.6 | 1.50 | 145 |  |
| item_37 | Clean Socks | 2 | 30 | 43.6 | 1.45 | 45 | sim |
| item_84 | Running Shoes | 3 | 65 | 89.1 | 1.37 | 90 | sim |
| big_arms | Nuclear Proteins | 4 | 105 | 143.2 | 1.36 | 145 |  |
| item_107 | Lucky Teddy | 4 | 100 | 133.6 | 1.34 | 135 |  |
| item_104 | Weighted Gauntlets | 4 | 110 | 146.1 | 1.33 | 145 |  |
| gnome | Tunnel Vision | 4 | 100 | 128.9 | 1.29 | 130 |  |
| item_106 | Regenerative Patch | 4 | 105 | 131.2 | 1.25 | 130 |  |
| cap | Cap | 1 | 20 | 24.9 | 1.25 | 25 | sim |
| item_51 | Fire Escape Map | 1 | 15 | 18.1 | 1.20 | 20 | sim |
| item_92 | Overtime Contract | 3 | 70 | 83.8 | 1.20 | 85 |  |
| item_16 | Experimental Injection | 1 | 20 | 23.4 | 1.17 | 25 |  |
| item_56 | Fertilizer | 1 | 15 | 17.2 | 1.15 | 15 |  |

'Premissa?' = mais da metade do valor vem de atributos com premissa manual; confirme esses antes de mexer no preço.

## Itens pedidos

### cape — Survival Instincts

- Tier 4, preço 110, máximo INF.
- Valor do modelo: **109.2**; ratio: **0.99**; sugestão: preço 110, tier 4.
- Composição: life_steal_chance +0.05 = +63.0; dodge_chance +0.2 = +72.5; melee_damage -2 = -5.9; ranged_damage -2 = -12.6; elemental_damage -2 = -7.9.
- Nota: Equivale ao Cape do Brotato (Tier 4, 110 gold). Se a coluna Tier mostrar 1, o desencontro é de Tier, não de preço.

### item_72 — Participation Medal

- Tier 2, preço 55, máximo INF.
- Valor do modelo: **59.3**; ratio: **1.08**; sugestão: preço 60, tier 3.
- Composição: max_hp +3 = +18.9; base_damage +0.03 = +12.7; defense_ratio +0.01 = +18.6; movement_speed_multiplier +0.03 = +18.7; crit_damage_chance -0.04 = -9.6.
- Nota: Pacote misto de cinco stats pequenos, como o Medal do Brotato (Tier 2, 55 gold). A soma de stats planos é a avaliação mais confiável aqui.

### item_108 — Cauldron Family Casserole

- Tier 4, preço 95, máximo INF.
- Valor do modelo: **142.6**; ratio: **1.50**; sugestão: preço 145, tier 4.
- Composição: max_hp +3 = +18.9; hp_regeneration +2 = +14.9; life_steal_chance +0.01 = +12.6; base_damage +0.05 = +21.2; bonus_attack_speed +0.05 = +13.0; movement_speed_multiplier +0.03 = +18.7; dodge_chance +0.03 = +10.9; defense_ratio +0.01 = +18.6; luck +5 = +13.8.
- Avisos: PRECO BAIXO vs valor (ratio>1.33).
- Nota: Equivale ao Potato do Brotato (Tier 4, 95 gold), nove stats pequenos. No próprio Brotato o Potato sai com ratio igual ao nosso (ver a checagem de cópias): o ratio alto é, em parte, o desconto de pacote do original, não necessariamente erro de preço.

### item_109 — Pocket Teleporter

- Tier 4, preço 100, máximo 1.
- Valor do modelo: **85.9**; ratio: **0.86**; sugestão: preço 85, tier 3.
- Composição: defense_ratio +0.03 = +55.9; auto_magnet_on_drop_chance +1 = +30.0.
- Avisos: UNICO/HOOK: stats planos subestimam o item.
- Nota: Máximo 1 e atração automática de drops: o valor de coleta é uma premissa manual (ver attribute_map.csv). Stats planos subestimam o item.

### item_103 — Lucky Coin

- Tier 4, preço 105, máximo 1.
- Valor do modelo: **-13.8**; ratio: **-0.13**; sugestão: preço -, tier -.
- Composição: crit_damage_chance +0.01 = +4.8; defense_ratio -0.02 = -18.6.
- Avisos: UNICO/HOOK: stats planos subestimam o item; PRECO ALTO vs valor (ratio<0.75); valor liquido <= 0.
- Nota: Máximo 1. No Brotato, o Lucky Coin dá +2 Luck por 1% de Crit Chance e -2 Armor; o efeito principal é essa conversão, que só existe como hook. Sem o hook, sobram os stats planos, que somam pouco ou negativo.

### vampire_fang — Vampire Teeth

- Tier 1, preço 25, máximo INF.
- Valor do modelo: **21.5**; ratio: **0.86**; sugestão: preço 20, tier 1.
- Composição: life_steal_chance +0.02 = +25.2; hp_regeneration -1 = -3.7.
- Nota: Âncora simples de Life Steal: Fresh Meat (+2% Life Steal, -1 HP Regen, 25 gold) e Bat (+2%, -2 Harvesting, 20 gold) no Brotato.

### heavy_bullets — High Caliber

- Tier 4, preço 100, máximo INF.
- Valor do modelo: **96.5**; ratio: **0.97**; sugestão: preço 95, tier 4.
- Composição: ranged_damage +5 = +62.8; base_damage +0.1 = +42.4; player_range +10 = +10.0; bonus_attack_speed -0.05 = -6.5; crit_damage_chance -0.05 = -12.1.
- Nota: Equivale ao Heavy Bullets do Brotato (Tier 4, 100 gold, com +10 Range). Bom teste de calibração: se o ratio ficar longe de 1, suspeite do valor de % Damage, Range e Attack Speed.

## Checagem: cópias exatas de itens do Brotato

Itens nossos com o mesmo pacote de stats de um item do Brotato (depois de converter as unidades). Se o modelo estiver bem calibrado, o ratio deles fica perto de 1.0, desde que o preço também seja o do Brotato.

| Nosso item | Item do Brotato | Preço Brotato | Nosso preço | Valor do modelo | Ratio (valor/preço nosso) | Valor/preço Brotato |
|---|---|---|---|---|---|---|
| expired_health_potion Hamburguer | Alien Worm | 15 | 15 | 27.4 | 1.82 | 1.82 |
| vampire_fang Vampire Teeth | Fresh Meat | 25 | 25 | 21.5 | 0.86 | 0.86 |
| fire_potion Dirty Underwear | Boiling Water | 30 | 30 | 12.6 | 0.42 | 0.42 |
| heavy_bullets High Caliber | Heavy Bullets | 100 | 100 | 96.5 | 0.97 | 0.97 |
| cape Survival Instincts | Cape | 110 | 110 | 109.2 | 0.99 | 0.99 |
| item_2 Scars | Broken Mouth | 25 | 25 | 27.7 | 1.11 | 1.11 |
| straw Straw | Butterfly | 30 | 30 | 21.3 | 0.71 | 0.71 |
| item_4 Elbow Pads | Cake | 15 | 15 | 16.7 | 1.12 | 1.12 |
| item_6 Coffee | Coffee | 20 | 20 | 21.8 | 1.09 | 1.09 |
| item_9 Knight Helmet | Defective Steroids | 20 | 20 | 20.4 | 1.02 | 1.02 |
| item_13 Dumbbell | Goat Skull | 25 | 25 | 12.7 | 0.51 | 0.51 |
| item_14 Heroes Magazine | Hedgehog | 30 | 30 | 20.5 | 0.68 | 0.68 |
| item_15 Iron Boots | Helmet | 15 | 15 | 12.4 | 0.83 | 0.83 |
| item_16 Experimental Injection | Injection | 20 | 20 | 23.4 | 1.17 | 1.17 |
| item_17 Weak Spots | Insanity | 20 | 20 | 22.6 | 1.13 | 1.13 |
| item_18 Clover | Lost Duck | 25 | 25 | 18.1 | 0.72 | 0.72 |
| item_19 Tea | Mushroom | 25 | 25 | 19.6 | 0.78 | 0.78 |
| item_21 Vitamins | Plant | 15 | 15 | 16.1 | 1.07 | 1.07 |
| item_22 Rabbit Foot | Propeller Hat | 28 | 28 | 23.3 | 0.83 | 0.83 |
| item_24 Reactor Fragment | Toxic Sludge | 20 | 20 | 12.1 | 0.60 | 0.60 |
| item_31 Wizard Hat | Fuel Tank | 45 | 45 | 22.2 | 0.49 | 0.49 |
| item_32 Black Bandana | Gambling Token | 50 | 50 | 19.7 | 0.39 | 0.39 |
| item_38 Sunglasses | Small Magazine | 60 | 60 | 38.5 | 0.64 | 0.64 |
| item_39 Leather Jacket | Sunglasses | 50 | 50 | 38.9 | 0.78 | 0.78 |
| item_41 Tainted Bloodstone | Alien Magic | 85 | 85 | 61.6 | 0.73 | 0.73 |
| item_42 Ancient Manuscript | Bean Teacher | 70 | 70 | 55.7 | 0.80 | 0.80 |
| item_44 Radioactive Soap | Leather Vest | 45 | 45 | 49.6 | 1.10 | 1.10 |
| item_45 Behemoth Foam Fists | Mastery | 55 | 55 | 16.3 | 0.30 | 0.30 |
| item_46 Plot-Armor Underwear | Metal Plate | 40 | 40 | 30.9 | 0.77 | 0.77 |
| item_48 Leprechaun Top Hat | Shady Potion | 48 | 48 | 47.6 | 0.99 | 0.99 |
| item_51 Fire Escape Map | Terrified Onion | 15 | 15 | 18.1 | 1.20 | 1.20 |
| item_52 Action Figure | Missile | 45 | 45 | 37.2 | 0.83 | 0.83 |
| item_53 Vampire Comic | Bat | 20 | 20 | 22.7 | 1.13 | 1.13 |
| item_54 Charcoal | Charcoal | 20 | 20 | 17.1 | 0.85 | 0.85 |
| item_56 Fertilizer | Fertilizer | 15 | 15 | 17.2 | 1.15 | 1.15 |
| item_57 Gummy Berserker | Gummy Berserker | 25 | 25 | 28.6 | 1.14 | 1.14 |
| item_58 Head Injury | Head Injury | 25 | 25 | 21.4 | 0.86 | 0.86 |
| item_59 Lemonade | Lemonade | 15 | 15 | 12.8 | 0.85 | 0.85 |
| item_60 Lens | Lens | 20 | 20 | 10.1 | 0.50 | 0.50 |
| item_61 Peaceful Bee | Peaceful Bee | 18 | 18 | 15.4 | 0.85 | 0.85 |
| item_62 Field Notes | Scar | 25 | 25 | 23.3 | 0.93 | 0.93 |
| item_67 Blindfold | Blindfold | 45 | 45 | 34.8 | 0.77 | 0.77 |
| item_68 Plasma Bag | Blood Leech | 45 | 45 | 36.3 | 0.81 | 0.81 |
| item_69 Cracked Visor | Cyclops Worm | 45 | 45 | 44.9 | 1.00 | 1.00 |
| item_71 Pocket Dumbbell | Little Muscley Dude | 50 | 50 | 41.5 | 0.83 | 0.83 |
| item_72 Participation Medal | Medal | 55 | 55 | 59.3 | 1.08 | 1.08 |
| item_74 Scope | Scope | 48 | 48 | 40.9 | 0.85 | 0.85 |
| item_77 Wheelbarrow | Wheelbarrow | 40 | 40 | 31.0 | 0.77 | 0.77 |
| item_82 Boss's Hat | Bowler Hat | 75 | 75 | 72.9 | 0.97 | 0.97 |
| item_84 Running Shoes | Fin | 65 | 65 | 89.1 | 1.37 | 1.37 |
| item_85 Overcharged Battery | Glass Cannon | 75 | 75 | 78.0 | 1.04 | 1.04 |
| item_87 Lucky Charm | Lucky Charm | 75 | 75 | 70.4 | 0.94 | 0.94 |
| item_90 Poisonous Tonic | Poisonous Tonic | 80 | 80 | 57.7 | 0.72 | 0.72 |
| item_91 Comfort Blanket | Shmoop | 60 | 60 | 40.5 | 0.67 | 0.67 |
| item_92 Overtime Contract | Tractor | 70 | 70 | 83.8 | 1.20 | 1.20 |
| item_95 Motorcycle Helmet | Warrior Helmet | 80 | 80 | 71.8 | 0.90 | 0.90 |
| item_96 Packed Lunch | Wheat | 85 | 85 | 65.9 | 0.78 | 0.78 |
| item_97 Cardboard Wings | Wings | 85 | 85 | 84.3 | 0.99 | 0.99 |
| item_102 Jet Skates | Jet Pack | 100 | 100 | 104.8 | 1.05 | 1.05 |
| item_105 Night Goggles | Night Goggles | 95 | 95 | 103.3 | 1.09 | 1.09 |
| item_106 Regenerative Patch | Octopus | 105 | 105 | 131.2 | 1.25 | 1.25 |
| item_107 Lucky Teddy | Panda | 100 | 100 | 133.6 | 1.34 | 1.34 |
| item_108 Cauldron Family Casserole | Potato | 95 | 95 | 142.6 | 1.50 | 1.50 |

Quando o ratio de uma cópia exata foge de 1.0 e o preço é igual ao do Brotato, o desvio é do modelo (stat mal calibrado), não do item. Itens que no Brotato têm um efeito extra que não copiamos (por exemplo o Coil, com +1% Damage por ponto de Knockback) não aparecem aqui porque o pacote de stats não é idêntico.

## Cópias sem o efeito especial do Brotato

Itens ativos nossos cujos stats planos coincidem (**exata**) ou quase coincidem (**parcial**) com um item do Brotato que tem um efeito especial ou condicional que o nosso não tem. O texto do efeito vem do dataset do Brotato. 'Nosso equivalente' mostra atributos sem equivalente direto no Brotato e hooks da planilha; vazio significa que não há nada que reproduza o efeito. Ratios baixos aqui costumam ser o efeito faltando, não o preço errado.

| Nosso item | Item do Brotato | Tipo | Efeito que falta (dataset) | Nosso equivalente | Ratio |
|---|---|---|---|---|---|
| item_83 Bedspring | Coil (T3, 70) | parcial (um valor diferente) | +1 % Damage for every 1 Knockback you have | nenhum | 0.31 |
| item_103 Lucky Coin | Lucky Coin (T4, 105) | parcial (mesmo nome) | +2 Luck for every 1 % Crit Chance you have | nenhum | -0.13 |
| item_109 Pocket Teleporter | Sifd’s Relic (T4, 100) | exata | +100% chance to instantly attract a material when it’s dropped | auto_magnet_on_drop_chance +1 | 0.86 |

Não entram aqui cópias exatas cujo item do Brotato não tem efeito especial (por exemplo Behemoth Foam Fists = Mastery e Black Bandana = Gambling Token): elas estão na tabela de cópias exatas acima, e o ratio baixo delas vem do modelo, não de efeito faltando.

## Nota do designer

O designer confirmou que o nosso Glasses (item_10) é um item original, não baseado em nenhum item do Brotato.

## Lacunas de dados

- Base do Brotato: 241 itens (208 do jogo base e 33 de DLC), extraídos dos dados decompilados do jogo (repositório mojimoon/brotato). 168 conferidos contra a wiki (coluna `verified`); os demais, em geral itens de DLC ou sem página na wiki, não foram conferidos.
- Itens do Brotato sem stats planos (pets, torres, efeitos de wave) ficam fora do ajuste; aparecem na base só com notas.
- O Brotato muda preços por dificuldade; usamos o preço base.
- Stats com poucos itens (Knockback, XP Gain, Pickup Range, HP de consumível) têm valor pouco confiável.
- Atributos só do nosso jogo dependem de premissas manuais; nenhum dado de partida (telemetria) entrou ainda.
