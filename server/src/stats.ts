import type { D1Database } from './types.ts';
import { HttpError } from './util.ts';

export interface Filters {
  build?: string;
  difficulty?: string;
  from?: string;
  to?: string;
}

export function parseFilters(params: URLSearchParams): Filters {
  const f: Filters = {};
  for (const k of ['build', 'difficulty'] as const) {
    const v = params.get(k);
    if (v) {
      if (v.length > 100) throw new HttpError(400, 'bad_param', `${k} is too long.`);
      f[k] = v;
    }
  }
  for (const k of ['from', 'to'] as const) {
    const v = params.get(k);
    if (v) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new HttpError(400, 'bad_param', `${k} must be YYYY-MM-DD.`);
      f[k] = v;
    }
  }
  return f;
}

type Row = Record<string, unknown>;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const rate = (a: number, b: number) => (b > 0 ? r4(a / b) : null);
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));

function runWhere(f: Filters): { sql: string; args: unknown[] } {
  const c = ["r.kind = 'summary'", "r.lifecycle = 'final'"];
  const args: unknown[] = [];
  if (f.build) { c.push('r.build_version = ?'); args.push(f.build); }
  if (f.difficulty) { c.push('r.difficulty = ?'); args.push(f.difficulty); }
  if (f.from) { c.push('r.day >= ?'); args.push(f.from); }
  if (f.to) { c.push('r.day <= ?'); args.push(f.to); }
  return { sql: c.join(' AND '), args };
}

function feedbackWhere(f: Filters): { sql: string; args: unknown[] } {
  const c = ['1 = 1'];
  const args: unknown[] = [];
  if (f.from) { c.push('f.day >= ?'); args.push(f.from); }
  if (f.to) { c.push('f.day <= ?'); args.push(f.to); }
  if (f.build || f.difficulty) {
    const inner: string[] = ["r.kind = 'summary'"];
    if (f.build) { inner.push('r.build_version = ?'); args.push(f.build); }
    if (f.difficulty) { inner.push('r.difficulty = ?'); args.push(f.difficulty); }
    c.push(`f.run_id IN (SELECT r.run_id FROM runs r WHERE ${inner.join(' AND ')})`);
  }
  return { sql: c.join(' AND '), args };
}

const DOC = 'COALESCE(r.doc, r.raw)';

export async function computeStats(db: D1Database, f: Filters, now: Date) {
  const w = runWhere(f);
  const fw = feedbackWhere(f);
  const q = (sql: string, args: unknown[]) => db.prepare(sql).bind(...args);

  const groupSql = (col: string) => q(
    `SELECT r.${col} AS k, COUNT(*) AS runs, SUM(r.result = 'victory') AS wins, SUM(r.result = 'death') AS deaths,
            SUM(r.result = 'abandoned') AS abandoned, AVG(r.wave_reached) AS avg_wave, AVG(r.duration_s) AS avg_duration_s
     FROM runs r WHERE ${w.sql} GROUP BY r.${col} ORDER BY runs DESC, k`, w.args);

  const res = await db.batch([
    /* 0 */ q(`SELECT COUNT(*) AS runs, SUM(r.result = 'victory') AS wins, SUM(r.result = 'death') AS deaths,
                     SUM(r.result = 'abandoned') AS abandoned, AVG(r.duration_s) AS avg_duration_s, COUNT(DISTINCT r.grant_id) AS grants
              FROM runs r WHERE ${w.sql}`, w.args),
    /* 1 */ groupSql('difficulty'),
    /* 2 */ groupSql('character'),
    /* 3 */ q(`SELECT r.difficulty AS d, r.wave_reached AS wave, COUNT(*) AS runs FROM runs r WHERE ${w.sql}
              GROUP BY r.difficulty, r.wave_reached ORDER BY r.difficulty, r.wave_reached`, w.args),
    /* 4 */ q(`SELECT r.difficulty AS d, r.death_wave AS wave, COUNT(*) AS deaths FROM runs r
              WHERE ${w.sql} AND r.result = 'death' AND r.death_wave IS NOT NULL
              GROUP BY r.difficulty, r.death_wave ORDER BY r.difficulty, r.death_wave`, w.args),
    /* 5 */ q(`SELECT r.death_wave AS wave, r.killer AS killer, COUNT(*) AS deaths FROM runs r
              WHERE ${w.sql} AND r.death_wave IS NOT NULL AND r.killer IS NOT NULL
              GROUP BY r.death_wave, r.killer ORDER BY r.death_wave, deaths DESC, killer`, w.args),
    /* 6 */ q(`SELECT r.wave_reached AS wave, COUNT(*) AS runs FROM runs r WHERE ${w.sql} AND r.result = 'abandoned'
              GROUP BY r.wave_reached ORDER BY r.wave_reached`, w.args),
    /* 7 */ q(`SELECT c AS runs_in_session, COUNT(*) AS sessions FROM (
                SELECT r.session_id, COUNT(*) AS c FROM runs r WHERE ${w.sql} AND r.session_id IS NOT NULL GROUP BY r.session_id
              ) GROUP BY c ORDER BY c`, w.args),
    /* 8 */ q(`SELECT json_extract(s.value, '$.item') AS item,
                     SUM(json_extract(s.value, '$.kind') = 'offer') AS offers,
                     SUM(json_extract(s.value, '$.kind') = 'buy') AS buys,
                     SUM(json_extract(s.value, '$.kind') = 'reroll') AS rerolls,
                     SUM(json_extract(s.value, '$.kind') = 'sell') AS sells
              FROM runs r, json_each(${DOC}, '$.shop') s
              WHERE ${w.sql} AND json_extract(s.value, '$.item') IS NOT NULL
              GROUP BY item ORDER BY offers DESC, item LIMIT 500`, w.args),
    /* 9 */ q(`SELECT item, COUNT(DISTINCT run_id) AS runs_with, COUNT(DISTINCT CASE WHEN result = 'victory' THEN run_id END) AS wins_with FROM (
                SELECT r.run_id AS run_id, r.result AS result, json_extract(i.value, '$.item') AS item
                FROM runs r, json_each(${DOC}, '$.final_build.items') i WHERE ${w.sql}
                UNION ALL
                SELECT r.run_id, r.result, json_extract(i.value, '$.item')
                FROM runs r, json_each(${DOC}, '$.final_build.weapons') i WHERE ${w.sql}
              ) WHERE item IS NOT NULL GROUP BY item`, [...w.args, ...w.args]),
    /* 10 */ q(`SELECT json_extract(o.value, '$.stat') AS stat, COUNT(*) AS offered,
                      SUM(CASE json_type(lu.value, '$.picked')
                            WHEN 'integer' THEN o.key = json_extract(lu.value, '$.picked')
                            WHEN 'text' THEN json_extract(o.value, '$.stat') = json_extract(lu.value, '$.picked')
                            WHEN 'object' THEN json_extract(o.value, '$.stat') = json_extract(lu.value, '$.picked.stat')
                            ELSE 0 END) AS picked
               FROM runs r, json_each(${DOC}, '$.level_ups') lu, json_each(lu.value, '$.options') o
               WHERE ${w.sql} AND json_extract(o.value, '$.stat') IS NOT NULL
               GROUP BY stat ORDER BY offered DESC, stat LIMIT 200`, w.args),
    /* 11 */ q(`SELECT COUNT(*) AS responses, AVG(f.rating) AS avg_rating FROM feedback f WHERE ${fw.sql}`, fw.args),
    /* 12 */ q(`SELECT f.rating AS rating, COUNT(*) AS responses FROM feedback f WHERE ${fw.sql} GROUP BY f.rating ORDER BY f.rating`, fw.args),
    /* 13 */ q(`SELECT t.value AS tag, COUNT(*) AS responses, AVG(f.rating) AS avg_rating FROM feedback f, json_each(f.tags) t
               WHERE ${fw.sql} GROUP BY t.value ORDER BY responses DESC, tag LIMIT 100`, fw.args),
    /* 14 */ db.prepare(`SELECT DISTINCT build_version AS v FROM runs WHERE kind = 'summary' AND build_version IS NOT NULL ORDER BY v DESC LIMIT 50`),
    /* 15 */ db.prepare(`SELECT DISTINCT difficulty AS v FROM runs WHERE kind = 'summary' AND difficulty IS NOT NULL ORDER BY v LIMIT 50`),
  ]);
  const rows = (i: number): Row[] => res[i].results as Row[];

  const total = rows(0)[0] ?? {};
  const runs = n(total.runs);
  const wins = n(total.wins);
  const group = (i: number) => rows(i).map((g) => ({
    key: (g.k as string | null) ?? '(desconhecido)',
    runs: n(g.runs), wins: n(g.wins), deaths: n(g.deaths), abandoned: n(g.abandoned),
    win_rate: rate(n(g.wins), n(g.runs)),
    avg_wave_reached: g.avg_wave === null ? null : r4(n(g.avg_wave)),
    avg_duration_s: g.avg_duration_s === null ? null : Math.round(n(g.avg_duration_s)),
  }));

  const byDifficulty = <T extends string>(i: number, field: T) => {
    const out: Record<string, { wave: number; [k: string]: number }[]> = {};
    for (const r of rows(i)) {
      const d = (r.d as string | null) ?? '(desconhecido)';
      (out[d] ??= []).push({ wave: n(r.wave), [field]: n(r[field]) });
    }
    return out;
  };

  const killersByWave: Record<string, { killer: string; deaths: number }[]> = {};
  const killerTotals = new Map<string, number>();
  for (const r of rows(5)) {
    const list = (killersByWave[String(r.wave)] ??= []);
    if (list.length < 5) list.push({ killer: r.killer as string, deaths: n(r.deaths) });
    killerTotals.set(r.killer as string, (killerTotals.get(r.killer as string) ?? 0) + n(r.deaths));
  }
  const topKillers = [...killerTotals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10)
    .map(([killer, deaths]) => ({ killer, deaths }));

  const presence = new Map(rows(9).map((r) => [r.item as string, r]));
  const shop = new Map(rows(8).map((r) => [r.item as string, r]));
  // Itens que só aparecem na build final (ex.: inicial) também entram, com 0 ofertas.
  const names = [...new Set([...shop.keys(), ...presence.keys()])];
  const items = names.map((item) => {
    const r = shop.get(item);
    const offers = r ? n(r.offers) : 0;
    const buys = r ? n(r.buys) : 0;
    const p = presence.get(item);
    const runsWith = p ? n(p.runs_with) : 0;
    const winsWith = p ? n(p.wins_with) : 0;
    return {
      item, offers, buys, rerolls: r ? n(r.rerolls) : 0, sells: r ? n(r.sells) : 0,
      buy_rate: rate(buys, offers),
      runs_with: runsWith, wins_with: winsWith,
      presence_in_wins: rate(winsWith, wins),
      presence_overall: rate(runsWith, runs),
      win_rate_with: rate(winsWith, runsWith),
    };
  }).sort((a, b) => b.offers - a.offers || b.runs_with - a.runs_with || a.item.localeCompare(b.item)).slice(0, 500);

  const fbTotal = rows(11)[0] ?? {};
  return {
    generated_at: now.toISOString(),
    filters: f,
    available: { builds: rows(14).map((r) => r.v as string), difficulties: rows(15).map((r) => r.v as string) },
    totals: {
      runs, wins, deaths: n(total.deaths), abandoned: n(total.abandoned), win_rate: rate(wins, runs),
      avg_duration_s: total.avg_duration_s === null || total.avg_duration_s === undefined ? null : Math.round(n(total.avg_duration_s)),
      grants: n(total.grants),
    },
    by_difficulty: group(1),
    by_character: group(2),
    wave_reached_by_difficulty: byDifficulty(3, 'runs'),
    death_wave_by_difficulty: byDifficulty(4, 'deaths'),
    top_killers: topKillers,
    top_killers_by_wave: killersByWave,
    abandon_waves: rows(6).map((r) => ({ wave: n(r.wave), runs: n(r.runs) })),
    runs_per_session: (() => {
      const dist = rows(7).map((r) => ({ runs_in_session: n(r.runs_in_session), sessions: n(r.sessions) }));
      const sessions = dist.reduce((a, d) => a + d.sessions, 0);
      const runsInSessions = dist.reduce((a, d) => a + d.sessions * d.runs_in_session, 0);
      return { sessions, avg_runs: sessions ? r4(runsInSessions / sessions) : null, distribution: dist };
    })(),
    items,
    level_up_options: rows(10).map((r) => ({
      stat: r.stat as string, offered: n(r.offered), picked: n(r.picked), pick_rate: rate(n(r.picked), n(r.offered)),
    })),
    feedback: {
      responses: n(fbTotal.responses),
      avg_rating: fbTotal.avg_rating === null || fbTotal.avg_rating === undefined ? null : r4(n(fbTotal.avg_rating)),
      ratings: rows(12).map((r) => ({ rating: n(r.rating), responses: n(r.responses) })),
      tags: rows(13).map((r) => ({ tag: String(r.tag), responses: n(r.responses), avg_rating: r.avg_rating === null ? null : r4(n(r.avg_rating)) })),
    },
  };
}

export type Stats = Awaited<ReturnType<typeof computeStats>>;
