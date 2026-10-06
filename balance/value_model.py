#!/usr/bin/env python3
"""Modelo de valor em gold dos itens do Underpants Hero.

Uso:
    python3 balance/value_model.py --configs <pasta com item_config.csv> [--out balance/output]

Passos:
  1. Ajusta o valor em gold de cada stat do Brotato (minimos quadrados nao negativos,
     erro relativo ao preco) usando itens do Brotato que so tem stats planos.
  2. Traduz os atributos do nosso jogo para stats do Brotato (data/attribute_map.csv).
  3. Valor de cada item nosso = soma(valor do atributo x quantidade); compara com o preco.

So usa a biblioteca padrao do Python 3. Nao acessa a rede. Resultado deterministico.
"""
import argparse
import csv
import math
import os
import re
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

# Stats do Brotato usados no ajuste: os 16 principais + 4 "extras" com poucos itens.
CORE_STATS = [
    "max_hp", "hp_regen", "life_steal", "damage_pct", "melee_damage", "ranged_damage",
    "elemental_damage", "attack_speed", "crit_chance", "engineering", "range", "armor",
    "dodge", "speed", "luck", "harvesting",
]
EXTRA_STATS = ["knockback", "xp_gain", "pickup_range", "consumable_heal"]
FIT_STATS = CORE_STATS + EXTRA_STATS

STAT_LABEL = {
    "max_hp": "Max HP", "hp_regen": "HP Regeneration", "life_steal": "% Life Steal",
    "damage_pct": "% Damage", "melee_damage": "Melee Damage", "ranged_damage": "Ranged Damage",
    "elemental_damage": "Elemental Damage", "attack_speed": "% Attack Speed",
    "crit_chance": "% Crit Chance", "engineering": "Engineering", "range": "Range",
    "armor": "Armor", "dodge": "% Dodge", "speed": "% Speed", "luck": "Luck",
    "harvesting": "Harvesting", "knockback": "Knockback", "xp_gain": "% XP Gain",
    "pickup_range": "% Pickup Range", "consumable_heal": "HP de consumível",
}

RATIO_LOW = 0.75
RATIO_HIGH = 1.33
OUTLIER_PCT = 0.50  # itens com erro acima disso saem do ajuste final (e sao listados)


def num(text):
    text = (text or "").strip().replace(",", ".")
    if text == "":
        return None
    return float(text)


def round5(x):
    return int(math.floor(x / 5.0 + 0.5) * 5)


# --------------------------------------------------------------------------- Brotato

def load_brotato(path):
    items = []
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if float(row["price"]) <= 1:
                continue  # itens que nao sao vendidos na loja (preco simbolico 1)
            stats = {}
            for tok in filter(None, row["stats"].split(";")):
                k, v = tok.split(":")
                stats[k.strip()] = float(v)
            items.append({
                "name": row["name"], "tier": int(row["tier"]), "price": float(row["price"]),
                "stats": stats, "notes": row["notes"].strip(),
                "verified": row.get("verified", "").strip() == "yes",
                "dlc": "[DLC]" in row.get("source", ""),
            })
    return items


def is_simple(item):
    """Item 'limpo' para calibrar: so stats planos conhecidos e nenhum efeito especial."""
    return (not item["notes"]) and item["stats"] and all(k in FIT_STATS for k in item["stats"])


def nnls_relative(rows, prices, stats, w0=None, sweeps=5000):
    """Minimos quadrados nao negativos, minimizando o erro relativo ((pred-preco)/preco)^2.

    Descida de coordenadas (deterministica). rows: lista de dicts stat->quantidade."""
    n = len(rows)
    B = [[rows[i].get(s, 0.0) / prices[i] for s in stats] for i in range(n)]
    cols = range(len(stats))
    denom = [sum(B[i][j] ** 2 for i in range(n)) for j in cols]
    w = list(w0) if w0 else [0.0] * len(stats)
    resid = [1.0 - sum(B[i][j] * w[j] for j in cols) for i in range(n)]  # y - Bw, com y=1
    for _ in range(sweeps):
        biggest = 0.0
        for j in cols:
            if denom[j] <= 0:
                continue
            g = sum(B[i][j] * resid[i] for i in range(n))
            new = max(0.0, w[j] + g / denom[j])
            d = new - w[j]
            if d != 0.0:
                for i in range(n):
                    resid[i] -= B[i][j] * d
                w[j] = new
                biggest = max(biggest, abs(d))
        if biggest < 1e-10:
            break
    return w


def eff(stats_dict, pw):
    """Aplica o peso de penalidade: quantidades negativas valem pw vezes (padrao 0.5)."""
    return {k: (v if v > 0 else v * pw) for k, v in stats_dict.items()}


def predict(stats_dict, weights, stats):
    return sum(stats_dict.get(s, 0.0) * weights[k] for k, s in enumerate(stats))


def fit_brotato(items, pw):
    pool = []
    for it in items:
        if is_simple(it):
            it = dict(it)
            it["raw_stats"] = it["stats"]
            it["stats"] = eff(it["stats"], pw)  # ja com o peso de penalidade aplicado
            pool.append(it)
    stats = [s for s in FIT_STATS if any(s in it["stats"] for it in pool)]
    rows = [it["stats"] for it in pool]
    prices = [it["price"] for it in pool]
    w = nnls_relative(rows, prices, stats)
    outliers = []
    keep = []
    for it in pool:
        err = (predict(it["stats"], w, stats) - it["price"]) / it["price"]
        if abs(err) > OUTLIER_PCT:
            outliers.append(it)
        else:
            keep.append(it)
    w = nnls_relative([it["stats"] for it in keep], [it["price"] for it in keep], stats, w0=w)

    errs, pct, preds = [], [], []
    for it in keep:
        p = predict(it["stats"], w, stats)
        preds.append(p)
        errs.append(p - it["price"])
        pct.append(abs(p - it["price"]) / it["price"])
    mean_price = statistics.mean(it["price"] for it in keep)
    ss_res = sum(e * e for e in errs)
    ss_tot = sum((it["price"] - mean_price) ** 2 for it in keep)
    r2 = 1 - ss_res / ss_tot

    # validacao deixando um item de fora (leave-one-out)
    loo = []
    for k, it in enumerate(keep):
        rest = keep[:k] + keep[k + 1:]
        wk = nnls_relative([x["stats"] for x in rest], [x["price"] for x in rest], stats, w0=w, sweeps=2000)
        loo.append(abs(predict(it["stats"], wk, stats) - it["price"]) / it["price"])

    count = {s: sum(1 for it in keep if s in it["stats"]) for s in stats}
    all_mean = statistics.mean(it["price"] for it in pool)
    ss_res_all = sum((predict(it["stats"], w, stats) - it["price"]) ** 2 for it in pool)
    ss_tot_all = sum((it["price"] - all_mean) ** 2 for it in pool)
    outlier_rows = [(it, predict(it["stats"], w, stats)) for it in outliers]
    quality = {
        "r2_all": 1 - ss_res_all / ss_tot_all, "outlier_rows": outlier_rows,
        "n_pool": len(pool), "n_fit": len(keep), "r2": r2,
        "median_pct": statistics.median(pct), "mean_pct": statistics.mean(pct),
        "loo_median_pct": statistics.median(loo), "outliers": outliers,
        "count": count, "n_total": len(items),
    }
    values = {s: w[k] for k, s in enumerate(stats)}
    for s in FIT_STATS:
        values.setdefault(s, 0.0)
    detail = [(it, predict(it["stats"], w, stats)) for it in keep]
    return values, quality, detail


def fit_tier_bands(items):
    """Limiares de preco (multiplos de 5) que melhor separam os tiers 1-4 do Brotato."""
    best = None
    grid = list(range(10, 145, 5))
    for a in grid:
        for b in grid:
            if b <= a:
                continue
            for c in grid:
                if c <= b:
                    continue
                hits = sum(1 for it in items if tier_from_price(it["price"], (a, b, c)) == it["tier"])
                if best is None or hits > best[0]:
                    best = (hits, (a, b, c))
    return best[1], best[0] / len(items)


def tier_from_price(price, bands):
    return 1 + sum(1 for b in bands if price >= b)


# --------------------------------------------------------------------------- Nosso jogo

def load_attribute_map(path, fitted):
    amap = {}
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            adj = num(row["game_adjust"])
            adj = 1.0 if adj is None else adj
            manual = num(row["manual_gold_per_unit"])
            if manual is not None:
                per_unit = manual * adj
                source = "manual"
            else:
                per_unit = fitted[row["brotato_stat"]] * num(row["scale"]) * adj
                source = "fit"
            amap[row["our_attribute"]] = {
                "stat": row["brotato_stat"], "scale": num(row["scale"]), "adjust": adj,
                "manual": manual, "per_unit": per_unit, "source": source,
                "kind": row["kind"], "up_ref": num(row["up_ref_units"]), "notes": row["notes"],
            }
    return amap


ATTR_RE = re.compile(r"\[\s*([A-Za-z0-9_]+)\s*,\s*([+-]?[0-9]*\.?[0-9]+)\s*\]")


def load_items(configs):
    path = os.path.join(configs, "item_config.csv")
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    header = None
    active = False
    items = []
    for row in rows:
        first = row[0].strip() if row else ""
        if first == "Item ID":
            header = {name.strip(): i for i, name in enumerate(row)}
            continue
        if first.startswith("["):
            active = first == "[Stackable Items]"
            if first == "[Archive]":
                break
            continue
        if not active or not first or header is None:
            continue

        def col(name):
            i = header.get(name)
            return row[i].strip() if i is not None and i < len(row) else ""

        attrs = [(k, float(v)) for k, v in ATTR_RE.findall(col("Player Attributes Levelup"))]
        items.append({
            "id": first, "name": col("Item Name"), "tier": int(num(col("Tier")) or 0),
            "price": num(col("Shop Price")) or 0.0, "max_count": col("Maximum Count"),
            "attrs": attrs, "synergy": col("Synergy Hooks"), "replace": col("Replace Hook"),
            "unlock": col("Unlock Condition"),
        })
    return items


def exact_copies(items, amap, brotato, rows):
    """Itens nossos cujo pacote de stats (convertido para unidades do Brotato) e identico ao de um item do Brotato."""
    flat = [b for b in brotato if b["stats"] and not b["notes"]]
    byid = {r["id"]: r for r in rows}
    out = []
    for it in items:
        vec = {}
        ok = bool(it["attrs"])
        for k, v in it["attrs"]:
            m = amap.get(k)
            if m is None or m["source"] != "fit" or k in ("jump_force", "max_jumps", "pickup_range"):
                ok = False
                break
            vec[m["stat"]] = vec.get(m["stat"], 0.0) + v * m["scale"]
        if not ok:
            continue
        vec = {k: round(v, 6) for k, v in vec.items() if abs(v) > 1e-9}
        for b in flat:
            if {k: round(v, 6) for k, v in b["stats"].items()} == vec:
                r = byid[it["id"]]
                out.append((it, b, r))
                break
    return out


MATCH_UNITS = {"knockback_force": ("knockback", 1.0), "items_price": ("items_price", 100.0),
               "xp_gain": ("xp_gain", 100.0), "consumable_heal": ("consumable_heal", 1.0)}


def our_vector(it, amap):
    """Pacote do nosso item em unidades do Brotato (so atributos com equivalente direto) + atributos sem equivalente."""
    vec, extra = {}, []
    for k, v in it["attrs"]:
        m = amap.get(k)
        if k in MATCH_UNITS:
            st, sc = MATCH_UNITS[k]
        elif m is not None and m["source"] == "fit" and k not in ("jump_force", "max_jumps", "pickup_range"):
            st, sc = m["stat"], m["scale"]
        else:
            extra.append("%s %+g" % (k, v))
            continue
        vec[st] = vec.get(st, 0.0) + v * sc
    return {k: round(v, 6) for k, v in vec.items() if abs(v) > 1e-9}, extra


def missing_effects(items, amap, brotato, rows):
    """Itens nossos parecidos com um item do Brotato que tem efeito especial (notes) que o nosso nao tem."""
    byid = {r["id"]: r for r in rows}
    out = []
    for it in items:
        vec, extra = our_vector(it, amap)
        if not vec:
            continue
        best_score, best = 0, []
        for b in brotato:
            notes = "; ".join(n for n in b["notes"].split("; ") if "Nightmare" not in n)  # ignora efeitos so do modo Nightmare
            if not notes:
                continue
            bs = {k: round(v, 6) for k, v in b["stats"].items()}
            name_eq = it["name"].strip().lower() == b["name"].strip().lower()
            if bs and bs == vec:
                score, kind = 4, "exata"
            elif bs and set(bs) == set(vec) and sum(1 for k in bs if bs[k] != vec[k]) == 1 and (
                    len(bs) >= 2 or (next(iter(bs.values())) * next(iter(vec.values())) > 0
                                     and 0.7 <= vec[next(iter(vec))] / bs[next(iter(bs))] <= 1.5
                                     and 0.75 <= it["price"] / b["price"] <= 1.33)):
                score, kind = 3, "parcial (um valor diferente)"
            elif name_eq:
                score, kind = 2, "parcial (mesmo nome)"
            elif bs and b["price"] == it["price"] and b["tier"] == it["tier"] and len(bs) >= 2 \
                    and sum(1 for k in bs if vec.get(k) == bs[k]) * 3 >= len(bs) * 2:
                score, kind = 1, "parcial (mesmo preço e tier, 2/3 dos stats)"
            else:
                continue
            if score > best_score:
                best_score, best = score, [(b, kind, notes)]
            elif score == best_score:
                best.append((b, kind, notes))
        for b, kind, notes in best:
            hook = (it["synergy"] + " " + it["replace"]).strip()
            out.append((it, b, kind, extra, hook, byid[it["id"]], notes))
    return out


def evaluate(items, amap, bands, pw):
    out = []
    for it in items:
        total = 0.0
        manual_abs = 0.0
        all_abs = 0.0
        parts = []
        unknown = []
        for k, v in it["attrs"]:
            m = amap.get(k)
            if m is None:
                unknown.append(k)
                parts.append("%s %+g = ?" % (k, v))
                continue
            gold = v * m["per_unit"]
            if gold < 0:
                gold *= pw  # penalidades valem pw vezes o bonus equivalente
            total += gold
            all_abs += abs(gold)
            if m["source"] == "manual" or m["kind"] == "assumption":
                manual_abs += abs(gold)
            parts.append("%s %+g = %+.1f" % (k, v, gold))
        flags = []
        hooks = bool(it["synergy"] or it["replace"])
        if it["max_count"] == "1" or hooks:
            flags.append("UNICO/HOOK: stats planos subestimam o item")
        if unknown:
            flags.append("atributo sem valor: " + "/".join(unknown))
        share = (manual_abs / all_abs) if all_abs else 0.0
        if share > 0.5:
            flags.append("depende de premissa (%d%% do valor)" % round(share * 100))
        price = it["price"]
        if not it["attrs"]:
            ratio = None
            flags.append("sem atributos (so hook): fora do ranking")
            suggested_price = ""
        else:
            ratio = total / price if price > 0 else None
            suggested_price = max(5, round5(total)) if total > 0 else ""
            if ratio is not None:
                if ratio < RATIO_LOW:
                    flags.append("PRECO ALTO vs valor (ratio<%.2f)" % RATIO_LOW)
                elif ratio > RATIO_HIGH:
                    flags.append("PRECO BAIXO vs valor (ratio>%.2f)" % RATIO_HIGH)
            if total <= 0:
                flags.append("valor liquido <= 0")
        band_tier = tier_from_price(price, bands)
        if it["tier"] and band_tier != it["tier"]:
            flags.append("tier %d na planilha, mas preco %g cai na faixa do tier %d" % (it["tier"], price, band_tier))
        suggested_tier = tier_from_price(suggested_price, bands) if suggested_price != "" else ""
        out.append({
            "id": it["id"], "name": it["name"], "tier": it["tier"], "price": price,
            "max_count": it["max_count"], "model_value": total, "ratio": ratio,
            "suggested_price": suggested_price, "suggested_tier": suggested_tier,
            "flags": flags, "breakdown": "; ".join(parts), "share": share,
        })
    return out


# --------------------------------------------------------------------------- Saida

def fmt(x, nd=2):
    return ("%." + str(nd) + "f") % x


def write_csv(rows, path):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "name", "tier", "price", "model_value", "ratio", "suggested_price",
                    "suggested_tier", "flags", "breakdown", "assumption_share"])
        for r in rows:
            w.writerow([r["id"], r["name"], r["tier"], fmt(r["price"], 0), fmt(r["model_value"]),
                        "" if r["ratio"] is None else fmt(r["ratio"]), r["suggested_price"],
                        r["suggested_tier"], " | ".join(r["flags"]), r["breakdown"],
                        fmt(r["share"])])


def md_table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        lines.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(lines)


SPECIAL_NOTES = {
    "cape": "Equivale ao Cape do Brotato (Tier 4, 110 gold). Se a coluna Tier mostrar 1, o desencontro é de Tier, não de preço.",
    "item_72": "Pacote misto de cinco stats pequenos, como o Medal do Brotato (Tier 2, 55 gold). A soma de stats planos é a avaliação mais confiável aqui.",
    "item_108": "Equivale ao Potato do Brotato (Tier 4, 95 gold), nove stats pequenos. No próprio Brotato o Potato sai com ratio igual ao nosso (ver a checagem de cópias): o ratio alto é, em parte, o desconto de pacote do original, não necessariamente erro de preço.",
    "item_109": "Máximo 1 e atração automática de drops: o valor de coleta é uma premissa manual (ver attribute_map.csv). Stats planos subestimam o item.",
    "item_103": "Máximo 1. No Brotato, o Lucky Coin dá +2 Luck por 1% de Crit Chance e -2 Armor; o efeito principal é essa conversão, que só existe como hook. Sem o hook, sobram os stats planos, que somam pouco ou negativo.",
    "vampire_fang": "Âncora simples de Life Steal: Fresh Meat (+2% Life Steal, -1 HP Regen, 25 gold) e Bat (+2%, -2 Harvesting, 20 gold) no Brotato.",
    "heavy_bullets": "Equivale ao Heavy Bullets do Brotato (Tier 4, 100 gold, com +10 Range). Bom teste de calibração: se o ratio ficar longe de 1, suspeite do valor de % Damage, Range e Attack Speed.",
}


def write_report(path, args, values, quality, bands, band_acc, brotato, amap, rows, configs_used, detail, items):
    L = []
    a = L.append
    a("# Relatório do modelo de valor em gold — Underpants Hero")
    a("")
    src = "/".join(os.path.normpath(configs_used).split(os.sep)[-3:])
    a("Gerado por `balance/value_model.py`. Fonte dos itens: `%s/item_config.csv` (%d itens ativos, seção `[Stackable Items]`)." % (src, len(rows)))
    a("")
    a("## Como ler")
    a("")
    a("- **Valor do modelo** = soma de (quantidade de cada atributo × gold por unidade). Penalidades subtraem.")
    a("- **Ratio** = valor do modelo ÷ preço atual na loja. Perto de 1,00 está coerente com o Brotato.")
    a("  - Ratio **abaixo de %.2f**: o item custa mais do que seus stats valem (preço alto)." % RATIO_LOW)
    a("  - Ratio **acima de %.2f**: o item custa menos do que seus stats valem (preço baixo, tende a ser escolhido sempre)." % RATIO_HIGH)
    a("- **Preço sugerido** é o valor do modelo arredondado para múltiplos de 5 (mínimo 5; vazio se o valor líquido for zero ou negativo). É um ponto de partida, não uma ordem.")
    a("- **Cuidado com penalidades grandes**: o modelo subtrai uma penalidade pelo mesmo valor que soma o bônus. No Brotato o desconto de penalidade costuma ser menor (Mastery, Cog e Goat Skull são outliers por isso), então itens como Behemoth Foam Fists e Wizard Hat saem baratos demais aqui.")
    a("- Itens com **máximo 1** ou **hook** têm efeito que a soma de stats planos não enxerga; trate o valor como piso.")
    a("- Atributos só do nosso jogo (pulo, coleta, ricochete...) usam **premissas manuais**: veja `balance/data/attribute_map.csv`. Itens que dependem muito delas recebem o aviso 'depende de premissa'.")
    a("")
    a("## Qualidade do ajuste")
    a("")
    a(md_table(["Medida", "Valor"], [
        ["Itens do Brotato na base", quality["n_total"]],
        ["Itens 'limpos' (só stats planos conhecidos)", quality["n_pool"]],
        ["Itens usados no ajuste final (sem outliers)", quality["n_fit"]],
        ["R² (itens do ajuste final)", fmt(quality["r2"], 3)],
        ["R² (todos os itens limpos, incluindo outliers)", fmt(quality["r2_all"], 3)],
        ["Erro % absoluto mediano (no ajuste)", fmt(quality["median_pct"] * 100, 1) + "%"],
        ["Erro % absoluto médio (no ajuste)", fmt(quality["mean_pct"] * 100, 1) + "%"],
        ["Erro % absoluto mediano deixando um item de fora (validação)", fmt(quality["loo_median_pct"] * 100, 1) + "%"],
    ]))
    a("")
    if quality["outliers"]:
        a("Outliers (erro maior que %d%%) retirados do ajuste. Preço no Brotato x valor segundo o modelo:" % (OUTLIER_PCT * 100))
        a("")
        a(md_table(["Item Brotato", "Tier", "Preço", "Valor do modelo", "Ratio"],
                   [[it["name"], it["tier"], "%g" % it["price"], fmt(v, 1), fmt(v / it["price"])]
                    for it, v in sorted(quality["outlier_rows"], key=lambda x: x[0]["name"])]))
        a("")
        a("Penalidades pesam %g vezes o bônus equivalente (parâmetro `--penalty-weight`), no ajuste e na avaliação." % args.penalty_weight)
        a("")
    a("Leitura honesta: o Brotato não precifica por uma fórmula; os preços são arredondados à mão e variam por tier. "
      "O modelo captura a ordem de grandeza, não o preço exato. Use ratios entre 0.75 e 1.33 como 'ok'.")
    a("")
    a("## Valor por stat do Brotato (gold por unidade)")
    a("")
    rowsv = []
    for s in FIT_STATS:
        n = quality["count"].get(s, 0)
        conf = "baixa (n<4)" if n < 4 else ("média" if n < 8 else "boa")
        if values[s] == 0:
            conf = "zerado pelo ajuste (n=%d)" % n
        rowsv.append([STAT_LABEL[s], fmt(values[s], 2), n, conf])
    a(md_table(["Stat", "Gold por unidade", "Itens no ajuste", "Confiança"], rowsv))
    a("")
    a("Engineering foi ajustado com os itens do Brotato, mas **não existe no nosso jogo** (não entra no cálculo).")
    a("")
    a("## Valor por atributo do Underpants Hero (já com as premissas)")
    a("")
    rowsa = []
    for k, m in amap.items():
        implied = ""
        if m["up_ref"]:
            implied = fmt(m["per_unit"] * m["up_ref"], 1)
        origem = "ajuste Brotato" if m["source"] == "fit" else "premissa manual"
        if m["source"] == "fit" and m["kind"] == "assumption":
            origem = "ajuste + premissa"
        rowsa.append([k, fmt(m["per_unit"], 3), fmt(m["adjust"], 2), origem, implied])
    a(md_table(["Atributo", "Gold por unidade nossa", "Ajuste do jogo", "Origem", "Gold por 1 UP (estudo anterior)"], rowsa))
    a("")
    a("A última coluna reaproveita a tabela 'T1 reference' da aba `item_budget` do estudo anterior (quantos pontos de atributo valem 1 UP de level-up Tier 1). "
      "Se o estudo anterior estivesse perfeitamente alinhado ao Brotato, essa coluna seria constante; a variação mostra onde as duas visões divergem.")
    a("")
    a("## Faixas de preço por tier (Brotato)")
    a("")
    by_tier = {}
    for it in brotato:
        by_tier.setdefault(it["tier"], []).append(it["price"])
    rowst = []
    for t in sorted(by_tier):
        p = by_tier[t]
        rowst.append([t, len(p), "%g" % min(p), "%g" % statistics.median(p), "%g" % max(p)])
    a(md_table(["Tier", "Itens", "Preço mín.", "Mediana", "Preço máx."], rowst))
    a("")
    a("Limiares ajustados (preço mínimo de cada tier, acerto de %d%% dos itens do Brotato): "
      "**Tier 2 a partir de %d, Tier 3 a partir de %d, Tier 4 a partir de %d**. "
      "Os tiers 2 e 3 se sobrepõem muito no Brotato, então a sugestão de tier é aproximada." % (
          round(band_acc * 100), bands[0], bands[1], bands[2]))
    a("")

    ranked = [r for r in rows if r["ratio"] is not None]
    over = sorted(ranked, key=lambda r: (r["ratio"], r["id"]))[:15]
    under = sorted(ranked, key=lambda r: (-r["ratio"], r["id"]))[:15]

    def lines(sel):
        return [[r["id"], r["name"], r["tier"], "%g" % r["price"], fmt(r["model_value"], 1), fmt(r["ratio"]),
                 r["suggested_price"], "sim" if r["share"] > 0.5 else ""] for r in sel]
    heads = ["ID", "Nome", "Tier", "Preço", "Valor", "Ratio", "Sugerido", "Premissa?"]
    a("## 15 itens com preço mais alto que o valor (ratio mais baixo)")
    a("")
    a(md_table(heads, lines(over)))
    a("")
    a("## 15 itens com preço mais baixo que o valor (ratio mais alto)")
    a("")
    a(md_table(heads, lines(under)))
    a("")
    a("'Premissa?' = mais da metade do valor vem de atributos com premissa manual; confirme esses antes de mexer no preço.")
    a("")
    a("## Itens pedidos")
    a("")
    byid = {r["id"]: r for r in rows}
    spec = ["cape", "item_72", "item_108", "item_109", "item_103", "vampire_fang", "heavy_bullets"]
    for iid in spec:
        r = byid.get(iid)
        if r is None:
            a("### %s" % iid)
            a("")
            a("Não encontrado entre os itens ativos.")
            a("")
            continue
        a("### %s — %s" % (iid, r["name"]))
        a("")
        a("- Tier %s, preço %g, máximo %s." % (r["tier"], r["price"], r["max_count"]))
        a("- Valor do modelo: **%s**; ratio: **%s**; sugestão: preço %s, tier %s." % (
            fmt(r["model_value"], 1), "-" if r["ratio"] is None else fmt(r["ratio"]),
            r["suggested_price"] if r["suggested_price"] != "" else "-", r["suggested_tier"] if r["suggested_tier"] != "" else "-"))
        a("- Composição: %s." % r["breakdown"])
        if r["flags"]:
            a("- Avisos: %s." % "; ".join(r["flags"]))
        a("- Nota: %s" % SPECIAL_NOTES.get(iid, ""))
        a("")
    a("## Checagem: cópias exatas de itens do Brotato")
    a("")
    a("Itens nossos com o mesmo pacote de stats de um item do Brotato (depois de converter as unidades). Se o modelo estiver bem calibrado, o ratio deles fica perto de 1.0, "
      "desde que o preço também seja o do Brotato.")
    a("")
    cps = exact_copies(items, amap, brotato, rows)
    a(md_table(["Nosso item", "Item do Brotato", "Preço Brotato", "Nosso preço", "Valor do modelo", "Ratio (valor/preço nosso)", "Valor/preço Brotato"],
               [[it["id"] + " " + it["name"], b["name"], "%g" % b["price"], "%g" % r["price"], fmt(r["model_value"], 1),
                 "-" if r["ratio"] is None else fmt(r["ratio"]), fmt(r["model_value"] / b["price"])] for it, b, r in cps]))
    a("")
    a("Quando o ratio de uma cópia exata foge de 1.0 e o preço é igual ao do Brotato, o desvio é do modelo (stat mal calibrado), não do item. "
      "Itens que no Brotato têm um efeito extra que não copiamos (por exemplo o Coil, com +1% Damage por ponto de Knockback) não aparecem aqui porque o pacote de stats não é idêntico.")
    a("")
    a("## Cópias sem o efeito especial do Brotato")
    a("")
    a("Itens ativos nossos cujos stats planos coincidem (**exata**) ou quase coincidem (**parcial**) com um item do Brotato que tem um efeito especial ou condicional que o nosso não tem. "
      "O texto do efeito vem do dataset do Brotato. 'Nosso equivalente' mostra atributos sem equivalente direto no Brotato e hooks da planilha; vazio significa que não há nada que reproduza o efeito. "
      "Ratios baixos aqui costumam ser o efeito faltando, não o preço errado.")
    a("")
    me = missing_effects(items, amap, brotato, rows)
    lines_me = []
    for it, b, kind, extra, hook, r, notes in me:
        equiv = "; ".join(extra + (["hook: " + hook[:80]] if hook else [])) or "nenhum"
        lines_me.append([it["id"] + " " + it["name"], "%s (T%d, %g)" % (b["name"], b["tier"], b["price"]), kind,
                         notes.replace("|", "/"), equiv, "-" if r["ratio"] is None else fmt(r["ratio"])])
    a(md_table(["Nosso item", "Item do Brotato", "Tipo", "Efeito que falta (dataset)", "Nosso equivalente", "Ratio"], lines_me))
    a("")
    a("Não entram aqui cópias exatas cujo item do Brotato não tem efeito especial (por exemplo Behemoth Foam Fists = Mastery e Black Bandana = Gambling Token): "
      "elas estão na tabela de cópias exatas acima, e o ratio baixo delas vem do modelo, não de efeito faltando.")
    a("")
    a("## Nota do designer")
    a("")
    a("O designer confirmou que o nosso Glasses (item_10) é um item original, não baseado em nenhum item do Brotato.")
    a("")
    a("## Lacunas de dados")
    a("")
    nver = sum(1 for b in brotato if b["verified"])
    ndlc = sum(1 for b in brotato if b["dlc"])
    a("- Base do Brotato: %d itens (%d do jogo base e %d de DLC), extraídos dos dados decompilados do jogo (repositório mojimoon/brotato). %d conferidos contra a wiki (coluna `verified`); os demais, em geral itens de DLC ou sem página na wiki, não foram conferidos." % (
        len(brotato), len(brotato) - ndlc, ndlc, nver))
    a("- Itens do Brotato sem stats planos (pets, torres, efeitos de wave) ficam fora do ajuste; aparecem na base só com notas.")
    a("- O Brotato muda preços por dificuldade; usamos o preço base.")
    a("- Stats com poucos itens (Knockback, XP Gain, Pickup Range, HP de consumível) têm valor pouco confiável.")
    a("- Atributos só do nosso jogo dependem de premissas manuais; nenhum dado de partida (telemetria) entrou ainda.")
    a("")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))


def main():
    ap = argparse.ArgumentParser(description="Modelo de valor em gold dos itens do Underpants Hero")
    ap.add_argument("--configs", default=None, help="pasta com item_config.csv")
    ap.add_argument("--out", default=os.path.join(HERE, "output"), help="pasta de saida")
    ap.add_argument("--penalty-weight", type=float, default=0.5,
                    help="peso das penalidades (stats negativos) no ajuste e na avaliacao; padrao 0.5")
    ap.add_argument("--data", default=os.path.join(HERE, "data"), help="pasta com brotato_items.csv e attribute_map.csv")
    args = ap.parse_args()

    configs = args.configs
    if configs is None:
        for cand in (os.path.join(REPO, "..", "underpants-hero-lab-v2", "configs"),
                     os.path.join(os.getcwd(), "..", "underpants-hero-lab-v2", "configs"),
                     os.path.join(HERE, "data", "snapshot")):
            if os.path.isfile(os.path.join(cand, "item_config.csv")):
                configs = cand
                break
    if configs is None or not os.path.isfile(os.path.join(configs, "item_config.csv")):
        sys.exit("item_config.csv nao encontrado. Use --configs <pasta>.")
    os.makedirs(args.out, exist_ok=True)

    brotato = load_brotato(os.path.join(args.data, "brotato_items.csv"))
    values, quality, detail = fit_brotato(brotato, args.penalty_weight)
    bands, band_acc = fit_tier_bands(brotato)
    amap = load_attribute_map(os.path.join(args.data, "attribute_map.csv"), values)
    items = load_items(configs)
    rows = evaluate(items, amap, bands, args.penalty_weight)

    write_csv(rows, os.path.join(args.out, "item_values.csv"))
    write_report(os.path.join(args.out, "report.md"), args, values, quality, bands, band_acc,
                 brotato, amap, rows, configs, detail, items)

    print("Itens ativos: %d | Brotato: %d (ajuste: %d) | R2 %.3f | erro mediano %.1f%%"
          % (len(rows), len(brotato), quality["n_fit"], quality["r2"], quality["median_pct"] * 100))
    print("Faixas de tier (minimo para T2/T3/T4): %s" % (bands,))


if __name__ == "__main__":
    main()
