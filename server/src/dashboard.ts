import type { Stats } from './stats.ts';

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pct = (v: number | null): string => (v === null ? '-' : `${(v * 100).toFixed(1)}%`);
const num = (v: number | null): string => (v === null ? '-' : String(v));

interface Bar { label: string; value: number; text?: string }

/** Barras horizontais em SVG inline. */
function hbars(rows: Bar[], title: string, max?: number): string {
  if (!rows.length) return '<p class="muted">Sem dados.</p>';
  const top = max ?? Math.max(...rows.map((r) => r.value), 1e-9);
  const h = rows.length * 24 + 4;
  const body = rows.map((r, i) => {
    const y = i * 24 + 2;
    const w = Math.max(0, Math.min(1, r.value / top)) * 340;
    return `<text x="0" y="${y + 15}" class="lbl">${esc(r.label.length > 24 ? r.label.slice(0, 23) + '…' : r.label)}</text>` +
      `<rect x="170" y="${y + 3}" width="${w.toFixed(1)}" height="14" rx="2" class="bar"/>` +
      `<text x="${(176 + w).toFixed(1)}" y="${y + 15}" class="val">${esc(r.text ?? r.value)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 600 ${h}" role="img" aria-label="${esc(title)}" class="chart">${body}</svg>`;
}

/** Histograma vertical em SVG inline (eixo x = rótulo). */
function vbars(rows: Bar[], title: string): string {
  if (!rows.length) return '<p class="muted">Sem dados.</p>';
  const max = Math.max(...rows.map((r) => r.value), 1);
  const slot = Math.min(36, 600 / rows.length);
  const width = Math.max(rows.length * slot, 120);
  const body = rows.map((r, i) => {
    const h = (r.value / max) * 100;
    const x = i * slot;
    return `<rect x="${(x + 3).toFixed(1)}" y="${(112 - h).toFixed(1)}" width="${(slot - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="bar"><title>${esc(r.label)}: ${esc(r.value)}</title></rect>` +
      `<text x="${(x + slot / 2).toFixed(1)}" y="${(108 - h).toFixed(1)}" text-anchor="middle" class="val">${esc(r.value)}</text>` +
      `<text x="${(x + slot / 2).toFixed(1)}" y="128" text-anchor="middle" class="lbl">${esc(r.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} 136" role="img" aria-label="${esc(title)}" class="chart" style="max-width:${width}px">${body}</svg>`;
}

function table(head: string[], rows: (string | number)[][]): string {
  if (!rows.length) return '<p class="muted">Sem dados.</p>';
  return `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
  }</tbody></table></div>`;
}

const section = (title: string, inner: string): string => `<section><h2>${esc(title)}</h2>${inner}</section>`;

export function renderDashboard(s: Stats, key: string): string {
  const f = s.filters;
  const opt = (values: string[], current?: string) =>
    `<option value="">todos</option>${values.map((v) => `<option${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('')}`;
  const form = `<form method="get" action="/dashboard">
    <input type="hidden" name="key" value="${esc(key)}">
    <label>Build <select name="build">${opt(s.available.builds, f.build)}</select></label>
    <label>Dificuldade <select name="difficulty">${opt(s.available.difficulties, f.difficulty)}</select></label>
    <label>De <input type="date" name="from" value="${esc(f.from ?? '')}"></label>
    <label>Até <input type="date" name="to" value="${esc(f.to ?? '')}"></label>
    <button type="submit">Filtrar</button></form>`;

  const groupTable = (g: Stats['by_difficulty']) => table(
    ['', 'Runs', 'Vitórias', 'Win rate', 'Mortes', 'Abandonos', 'Wave média', 'Duração média (s)'],
    g.map((r) => [r.key, r.runs, r.wins, pct(r.win_rate), r.deaths, r.abandoned, num(r.avg_wave_reached), num(r.avg_duration_s)]),
  );
  const groupBars = (g: Stats['by_difficulty'], title: string) =>
    hbars(g.map((r) => ({ label: r.key, value: r.win_rate ?? 0, text: `${pct(r.win_rate)} (${r.runs})` })), title, 1);

  const waveBlocks = (data: Record<string, { wave: number; [k: string]: number }[]>, field: string, title: string) =>
    Object.keys(data).length
      ? Object.entries(data).map(([d, list]) => `<h3>${esc(d)}</h3>${vbars(list.map((w) => ({ label: String(w.wave), value: w[field] })), `${title} - ${d}`)}`).join('')
      : '<p class="muted">Sem dados.</p>';

  const killersWave = Object.entries(s.top_killers_by_wave).map(([wave, list]) =>
    [`Wave ${wave}`, list.map((k) => `${k.killer} (${k.deaths})`).join(', ')]);

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Underpants Hero - Telemetria</title>
<style>
:root{color-scheme:light dark;--bg:#fafafa;--fg:#1c1c1e;--muted:#6b6b72;--card:#fff;--line:#dcdce0;--bar:#3b6fd4}
@media(prefers-color-scheme:dark){:root{--bg:#141416;--fg:#ececf0;--muted:#9a9aa3;--card:#1e1e22;--line:#34343a;--bar:#6c9cff}}
*{box-sizing:border-box}body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
main{max-width:980px;margin:0 auto}h1{font-size:1.4rem;margin:.2rem 0 1rem}h2{font-size:1.1rem;margin:0 0 .6rem}h3{font-size:.95rem;margin:.8rem 0 .2rem;color:var(--muted)}
section{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px;margin:0 0 14px}
form{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:0 0 14px}label{display:flex;flex-direction:column;font-size:.8rem;color:var(--muted);gap:2px}
select,input,button{font:inherit;padding:5px 8px;border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--fg)}button{cursor:pointer}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}th{color:var(--muted);font-weight:600}
td:not(:first-child),th:not(:first-child){text-align:right}.muted{color:var(--muted)}.kpis{display:flex;flex-wrap:wrap;gap:10px}.kpi{flex:1 1 130px;border:1px solid var(--line);border-radius:6px;padding:8px 10px}.kpi b{display:block;font-size:1.3rem}
.chart{width:100%;height:auto;display:block}.bar{fill:var(--bar)}.lbl{font-size:11px;fill:var(--muted)}.val{font-size:11px;fill:var(--fg)}
</style></head><body><main>
<h1>Underpants Hero - Telemetria</h1>
${form}
${section('Resumo', `<div class="kpis">
<div class="kpi"><b>${s.totals.runs}</b>runs</div><div class="kpi"><b>${pct(s.totals.win_rate)}</b>win rate</div>
<div class="kpi"><b>${s.totals.deaths}</b>mortes</div><div class="kpi"><b>${s.totals.abandoned}</b>abandonos</div>
<div class="kpi"><b>${s.runs_per_session.sessions}</b>sessões</div><div class="kpi"><b>${num(s.runs_per_session.avg_runs)}</b>runs por sessão</div>
<div class="kpi"><b>${s.totals.grants}</b>jogadores (grants)</div></div>
<p class="muted">Gerado em ${esc(s.generated_at)} (UTC). Só runs finalizadas entram.</p>`)}
${section('Win rate por dificuldade', groupBars(s.by_difficulty, 'Win rate por dificuldade') + groupTable(s.by_difficulty))}
${section('Win rate por personagem', groupBars(s.by_character, 'Win rate por personagem') + groupTable(s.by_character))}
${section('Wave alcançada (runs) por dificuldade', waveBlocks(s.wave_reached_by_difficulty, 'runs', 'Wave alcançada'))}
${section('Wave da morte por dificuldade', waveBlocks(s.death_wave_by_difficulty, 'deaths', 'Wave da morte'))}
${section('Quem mais mata', hbars(s.top_killers.map((k) => ({ label: k.killer, value: k.deaths })), 'Principais causas de morte') +
  '<h3>Top 5 por wave</h3>' + table(['Wave', 'Assassinos (mortes)'], killersWave))}
${section('Waves em que os jogadores abandonam', vbars(s.abandon_waves.map((w) => ({ label: String(w.wave), value: w.runs })), 'Abandonos por wave'))}
${section('Runs por sessão', vbars(s.runs_per_session.distribution.map((d) => ({ label: String(d.runs_in_session), value: d.sessions })), 'Sessões por quantidade de runs') +
  '<p class="muted">Eixo x: runs na sessão; barra: nº de sessões.</p>')}
${section('Itens: oferta, compra e presença nas vitórias', table(
  ['Item', 'Ofertas', 'Compras', 'Taxa de compra', 'Rerolls', 'Vendas', 'Presença nas vitórias', 'Presença geral', 'Win rate com o item'],
  s.items.map((i) => [i.item, i.offers, i.buys, pct(i.buy_rate), i.rerolls, i.sells, pct(i.presence_in_wins), pct(i.presence_overall), pct(i.win_rate_with)])))}
${section('Level-up: opção oferecida vs escolhida', hbars(
  s.level_up_options.slice(0, 20).map((o) => ({ label: o.stat, value: o.pick_rate ?? 0, text: `${pct(o.pick_rate)} (${o.picked}/${o.offered})` })), 'Taxa de escolha por atributo', 1))}
${section('Feedback', `<p>${s.feedback.responses} respostas, nota média <b>${num(s.feedback.avg_rating)}</b></p>` +
  hbars(s.feedback.ratings.map((r) => ({ label: `${r.rating} estrela(s)`, value: r.responses })), 'Distribuição das notas') +
  '<h3>Tags</h3>' + table(['Tag', 'Respostas', 'Nota média'], s.feedback.tags.map((t) => [t.tag, t.responses, num(t.avg_rating)])))}
</main></body></html>`;
  return html;
}
