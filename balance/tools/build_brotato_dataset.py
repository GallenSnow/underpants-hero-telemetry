#!/usr/bin/env python3
"""Converte o JSON do codex mojimoon/brotato (dados extraidos do jogo) em balance/data/brotato_items.csv.

Uso: python3 balance/tools/build_brotato_dataset.py <brotato_data.en.json> <commit> [--wiki <csv antigo>] [--verified <nomes.txt>]
Gera tambem a comparacao com a extracao antiga da wiki (somente se --wiki for passado).
"""
import csv, json, re, sys

STAT = {
    "stat_percent_damage": "damage_pct", "stat_max_hp": "max_hp", "stat_hp_regeneration": "hp_regen",
    "stat_speed": "speed", "stat_range": "range", "stat_engineering": "engineering",
    "stat_melee_damage": "melee_damage", "stat_attack_speed": "attack_speed",
    "stat_ranged_damage": "ranged_damage", "stat_elemental_damage": "elemental_damage",
    "stat_armor": "armor", "stat_crit_chance": "crit_chance", "stat_dodge": "dodge",
    "stat_luck": "luck", "stat_lifesteal": "life_steal", "stat_harvesting": "harvesting",
    "knockback": "knockback", "xp_gain": "xp_gain", "pickup_range": "pickup_range",
    "consumable_heal": "consumable_heal", "stat_curse": "curse",
    "explosion_damage": "explosion_damage", "explosion_size": "explosion_size", "items_price": "items_price",
}


def render(e):
    t = e["text"]
    s = t["en"]
    for i, a in enumerate(t.get("args", [])):
        v = a["value"]
        v = int(v) if float(v).is_integer() else v
        s = s.replace("{%d}" % i, str(v))
    return re.sub(r"<[^>]+>", "", s).strip()


def fmtv(v):
    v = int(v) if float(v).is_integer() else v
    return ("+%s" % v) if v >= 0 else str(v)


def main():
    src, commit = sys.argv[1], sys.argv[2]
    verified = set()
    if "--verified" in sys.argv:
        verified = {l.strip() for l in open(sys.argv[sys.argv.index("--verified") + 1], encoding="utf-8") if l.strip()}
    data = json.load(open(src, encoding="utf-8"))
    rows = []
    for it in data["items"]:
        stats, notes = [], []
        for e in it["effects"]:
            text = render(e)
            flat = (e["key"] in STAT and e["custom_key"] == "" and e["storage_method"] == 0
                    and " for every " not in text and " per " not in text)
            if flat:
                stats.append("%s:%s" % (STAT[e["key"]], fmtv(e["value"])))
            else:
                notes.append(text)
        rows.append([it["name"], it["tier"] + 1, int(it["value"]), ";".join(stats), "; ".join(notes),
                     "dataset: mojimoon/brotato@%s (dados decompilados do jogo)%s" % (commit[:7], " [DLC]" if it["dlc"] else ""),
                     "yes" if it["name"] in verified else "no", it["max_nb"] if it["max_nb"] > 0 else ""])
    rows.sort(key=lambda r: r[0].lower())
    w = csv.writer(open(sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith("--") else "brotato_items.csv", "w", newline="", encoding="utf-8"))
    w.writerow(["name", "tier", "price", "stats", "notes", "source", "verified", "max_count"])
    w.writerows(rows)
    print(len(rows), "itens")


if __name__ == "__main__":
    main()
