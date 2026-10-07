import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { death, envelope, get, post, setup, summary, DASH } from './helpers.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const j = async (r: Response) => (await r.json()) as any;

test('ingest: JSON puro devolve o recibo que o cliente confere', async () => {
  const { call } = setup();
  const body = JSON.stringify(summary());
  const res = await call(post('/v1/runs', body));
  assert.equal(res.status, 200);
  assert.deepEqual(await j(res), { ok: true, persisted: true, run_id: 'run1', revision: 1, sha256: sha(body) });
});

test('ingest: gzip, mesmo sha256 (dos bytes descomprimidos)', async () => {
  const { call, sql } = setup();
  const body = JSON.stringify(summary({ run_id: 'gz1' }));
  const res = await call(post('/v1/runs', body, { gzip: true }));
  assert.equal(res.status, 200);
  assert.equal((await j(res)).sha256, sha(body));
  const row = sql.prepare('SELECT character, difficulty, result, wave_reached, session_id, build_version, raw FROM runs').get() as any;
  assert.equal(row.character, 'hero');
  assert.equal(row.difficulty, 'normal');
  assert.equal(row.result, 'victory');
  assert.equal(row.wave_reached, 20);
  assert.equal(row.session_id, 'sess1');
  assert.equal(row.build_version, '0.5.0');
  assert.equal(row.raw, body);
});

test('ingest: envelope uh-transport/0.1 com resumo dentro', async () => {
  const { call, sql } = setup();
  const body = JSON.stringify(envelope(summary({ run_id: 'env1' }), { revision: 3 }));
  const res = await call(post('/v1/runs', body, { gzip: true }));
  assert.equal(res.status, 200);
  assert.deepEqual(await j(res), { ok: true, persisted: true, run_id: 'env1', revision: 3, sha256: sha(body) });
  const row = sql.prepare("SELECT kind, doc, lifecycle FROM runs WHERE run_id='env1'").get() as any;
  assert.equal(row.kind, 'summary');
  assert.equal(row.lifecycle, 'final');
  assert.equal(JSON.parse(row.doc).run_id, 'env1');
});

test('auth: sem token, token errado e servidor sem INGEST_KEY', async () => {
  const { call } = setup();
  const body = JSON.stringify(summary());
  assert.equal((await call(post('/v1/runs', body, { token: null }))).status, 401);
  const bad = await call(post('/v1/runs', body, { token: 'nope' }));
  assert.equal(bad.status, 401);
  assert.equal((await j(bad)).error, 'unauthorized');
  assert.equal((await call(post('/v1/feedback', '{}', { token: 'nope' }))).status, 401);
  const open = setup({ INGEST_KEY: undefined });
  assert.equal((await open.call(post('/v1/runs', body))).status, 503);
});

test('idempotencia: duplicata devolve o mesmo recibo e nao grava de novo', async () => {
  const { call, sql } = setup();
  const body = JSON.stringify(summary({ run_id: 'dup' }));
  const a = await call(post('/v1/runs', body));
  const b = await call(post('/v1/runs', body, { gzip: true }));
  assert.equal(b.status, 200);
  assert.equal(b.headers.get('x-uh-duplicate'), '1');
  assert.deepEqual(await j(a), await j(b));
  assert.equal((sql.prepare('SELECT COUNT(*) c FROM runs').get() as any).c, 1);
  const changed = JSON.stringify(summary({ run_id: 'dup', outcome: { result: 'death', wave_reached: 3 } }));
  assert.equal((await call(post('/v1/runs', changed))).status, 409);
});

test('revisoes: so a mais nova fica; reenvio de revisao antiga e coberto', async () => {
  const { call, sql } = setup();
  const rev = (n: number, extra: Record<string, unknown> = {}) => JSON.stringify(envelope(summary({ run_id: 'r' }), { revision: n, lifecycle: n === 2 ? 'final' : 'open', ...extra }));
  await call(post('/v1/runs', rev(1)));
  await call(post('/v1/runs', rev(2)));
  assert.deepEqual((sql.prepare('SELECT revision FROM runs').all() as any[]).map((r) => r.revision), [2]);
  const old = await call(post('/v1/runs', rev(1)));
  assert.equal(old.status, 200);
  assert.equal((await j(old)).superseded, true);
});

test('limite de tamanho: >1 MiB descomprimido e rejeitado (gzip bomb incluida)', async () => {
  const { call } = setup();
  const big = JSON.stringify(summary({ pad: 'x'.repeat(1_100_000) }));
  const res = await call(post('/v1/runs', big, { gzip: true })); // comprime para poucos KB
  assert.equal(res.status, 413);
  assert.equal((await j(res)).error, 'payload_too_large');
  assert.equal((await call(post('/v1/runs', big))).status, 413);
});

test('validacao: json invalido, gzip invalido, schema desconhecido, forma errada', async () => {
  const { call } = setup();
  assert.equal((await j(await call(post('/v1/runs', '{nope')))).error, 'invalid_json');
  const badGz = new Request('https://uh.test/v1/runs', { method: 'POST', headers: { authorization: 'Bearer test-ingest-key' }, body: Buffer.from([0x1f, 0x8b, 1, 2, 3]) });
  assert.equal((await j(await call(badGz))).error, 'invalid_gzip');
  const unk = await call(post('/v1/runs', JSON.stringify({ schema: 'uh-run-summary/99', run_id: 'x' })));
  assert.equal(unk.status, 400);
  assert.equal((await j(unk)).error, 'unsupported_schema');
  assert.equal((await j(await call(post('/v1/runs', '{"hello":1}')))).error, 'unsupported_schema');
  assert.equal((await j(await call(post('/v1/runs', JSON.stringify(summary({ outcome: { result: 'draw', wave_reached: 1 } })))))).error, 'invalid_shape');
  assert.equal((await j(await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'bad id!'})))))).error, 'invalid_run_id');
  assert.equal((await j(await call(post('/v1/runs', JSON.stringify(envelope(summary({ run_id: 'a' }), { run_id: 'b' })))))).error, 'run_id_mismatch');
});

test('limite diario: 200 runs por grant_id (configuravel), outro grant nao e afetado', async () => {
  const { call, state } = setup({ DAILY_RUN_LIMIT: '3' });
  for (let i = 0; i < 3; i++) assert.equal((await call(post('/v1/runs', JSON.stringify(summary({ run_id: `l${i}` }))))).status, 200);
  const over = await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'l9' }))));
  assert.equal(over.status, 429);
  assert.ok(Number(over.headers.get('retry-after')) > 0);
  // duplicata de run ja aceita nao e barrada
  assert.equal((await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'l0' }))))).status, 200);
  assert.equal((await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'o1', grant_id: 'other' }))))).status, 200);
  state.clock = new Date('2026-10-08T00:00:01Z');
  assert.equal((await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'l9' }))))).status, 200);
});

test('limite padrao e 200 por dia', async () => {
  const { call, sql } = setup();
  const ins = sql.prepare("INSERT INTO runs (run_id, revision, kind, payload_schema, grant_id, sha256, received_at, day, raw) VALUES (?,?,?,?,?,?,?,?,?)");
  for (let i = 0; i < 200; i++) ins.run(`seed${i}`, 1, 'pilot', 'x', 'grant1', 'h', '2026-10-07T00:00:00Z', '2026-10-07', '{}');
  assert.equal((await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'new' }))))).status, 429);
});

test('payload legado do piloto (uh-session-checkpoints/0.1) e guardado cru', async () => {
  const { call, sql } = setup();
  const legacy = { protocol: 'uh-transport/0.1', run_id: 'pilot_1', revision: 7, payload_schema: 'uh-session-checkpoints/0.1', lifecycle: 'open',
    payload: { economy: { schema: 'uh-economy-ledger/1.0', operations: [] }, checkpoints: [{ index: 1 }] } };
  const body = JSON.stringify(legacy);
  const res = await call(post('/v1/runs', body, { gzip: true }));
  assert.equal(res.status, 200);
  assert.deepEqual(await j(res), { ok: true, persisted: true, run_id: 'pilot_1', revision: 7, sha256: sha(body) });
  const row = sql.prepare("SELECT kind, payload_schema, lifecycle, raw, difficulty FROM runs WHERE run_id='pilot_1'").get() as any;
  assert.equal(row.kind, 'pilot');
  assert.equal(row.payload_schema, 'uh-session-checkpoints/0.1');
  assert.equal(row.lifecycle, 'open');
  assert.equal(row.raw, body);
  assert.equal(row.difficulty, null);
  // nao entra nas estatisticas
  const stats = await j(await call(get(`/v1/stats?key=${DASH}`)));
  assert.equal(stats.totals.runs, 0);
});

test('feedback: formato do cliente atual (uh-feedback/0.1), idempotente', async () => {
  const { call, sql } = setup();
  await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'fr1' }))));
  const fb = { protocol: 'uh-feedback/0.1', response_id: 'a'.repeat(64), revision: 1, question_version: 'post-run/1', scale_version: 'five-point/1',
    rating: 4, comment: 'divertido', locale: 'pt_BR', responded_at: '2026-10-07T12:00:00Z', run_id: 'fr1' };
  const body = JSON.stringify(fb);
  const a = await call(post('/v1/feedback', body, { gzip: true }));
  assert.equal(a.status, 200);
  const receiptA = await j(a);
  assert.deepEqual(receiptA, { ok: true, persisted: true, response_id: 'a'.repeat(64), run_id: 'fr1', revision: 1, sha256: sha(body) });
  const b = await call(post('/v1/feedback', body, { gzip: true }));
  assert.deepEqual(await j(b), receiptA);
  assert.equal(b.headers.get('x-uh-duplicate'), '1');
  const row = sql.prepare('SELECT grant_id, rating, comment FROM feedback').get() as any;
  assert.deepEqual({ ...row }, { grant_id: 'grant1', rating: 4, comment: 'divertido' }); // grant_id veio da run
  assert.equal((await call(post('/v1/feedback', JSON.stringify({ ...fb, rating: 1 })))).status, 409);
});

test('feedback: formato novo {run_id, grant_id, rating, comment, tags}', async () => {
  const { call, sql } = setup();
  const body = JSON.stringify({ run_id: 'r9', grant_id: 'g9', rating: 5, comment: 'otimo', tags: ['facil', 'bonito', 'facil'] });
  const res = await call(post('/v1/feedback', body));
  assert.equal(res.status, 200);
  const receipt = await j(res);
  assert.equal(receipt.persisted, true);
  assert.equal(receipt.response_id, 'r9');
  assert.equal(receipt.sha256, sha(body));
  assert.equal((sql.prepare('SELECT tags FROM feedback').get() as any).tags, '["facil","bonito"]');
});

test('feedback: validacao', async () => {
  const { call } = setup();
  const ok = { run_id: 'r1', grant_id: 'g1', rating: 3 };
  const code = async (o: Record<string, unknown>) => (await j(await call(post('/v1/feedback', JSON.stringify(o))))).error;
  assert.equal(await code({ ...ok, rating: 6 }), 'invalid_rating');
  assert.equal(await code({ ...ok, rating: 1.5 }), 'invalid_rating');
  assert.equal(await code({ ...ok, comment: 'x'.repeat(1001) }), 'invalid_comment');
  assert.equal(await code({ ...ok, tags: 'x' }), 'invalid_tags');
  assert.equal(await code({ rating: 3, grant_id: 'g' }), 'invalid_run_id');
  assert.equal(await code({ ...ok, grant_id: undefined }), 'invalid_grant_id');
  assert.equal(await code({ ...ok, protocol: 'other/1' }), 'unsupported_schema');
  // 1000 pontos de codigo (emoji conta 1) passa
  assert.equal((await call(post('/v1/feedback', JSON.stringify({ ...ok, comment: '😀'.repeat(1000) })))).status, 200);
});

async function seed(call: (r: Request) => Promise<Response>) {
  const runs = [
    summary({ run_id: 'v1', session: { id: 's1', run_index: 1 } }),
    summary({ run_id: 'v2', session: { id: 's1', run_index: 2 }, context: { character: 'mage', difficulty: 'hard' } }),
    death('d1', 5, 'bat', { session: { id: 's1', run_index: 3 } }),
    death('d2', 5, 'bat', { session: { id: 's2', run_index: 1 } }),
    death('d3', 5, 'wolf', { session: { id: 's2', run_index: 2 }, context: { character: 'mage', difficulty: 'hard' } }),
    death('d4', 9, 'boss', { session: { id: 's3', run_index: 1 }, build: { version: '0.6.0' } }),
    summary({ run_id: 'a1', outcome: { result: 'abandoned', wave_reached: 4 }, session: { id: 's3', run_index: 2 }, final_build: { weapons: [], items: [{ item: 'ring', count: 1 }] }, shop: [], level_ups: [] }),
  ];
  for (const r of runs) assert.equal((await call(post('/v1/runs', JSON.stringify(r)))).status, 200);
  const fbs = [
    { run_id: 'v1', grant_id: 'grant1', rating: 5, tags: ['divertido'] },
    { run_id: 'd1', grant_id: 'grant1', rating: 2, tags: ['dificil', 'divertido'] },
  ];
  for (const f of fbs) assert.equal((await call(post('/v1/feedback', JSON.stringify(f)))).status, 200);
}

test('stats: agregados', async () => {
  const { call } = setup();
  await seed(call);
  const res = await call(get(`/v1/stats?key=${DASH}`));
  assert.equal(res.status, 200);
  const s = await j(res);
  assert.deepEqual({ runs: s.totals.runs, wins: s.totals.wins, deaths: s.totals.deaths, abandoned: s.totals.abandoned }, { runs: 7, wins: 2, deaths: 4, abandoned: 1 });

  const normal = s.by_difficulty.find((g: any) => g.key === 'normal');
  assert.deepEqual({ runs: normal.runs, wins: normal.wins, win_rate: normal.win_rate }, { runs: 5, wins: 1, win_rate: 0.2 });
  const hard = s.by_difficulty.find((g: any) => g.key === 'hard');
  assert.deepEqual({ runs: hard.runs, wins: hard.wins, win_rate: hard.win_rate }, { runs: 2, wins: 1, win_rate: 0.5 });
  const hero = s.by_character.find((g: any) => g.key === 'hero');
  assert.equal(hero.runs, 5);

  assert.deepEqual(s.wave_reached_by_difficulty.normal.find((w: any) => w.wave === 5), { wave: 5, runs: 2 });
  assert.deepEqual(s.death_wave_by_difficulty.normal.find((w: any) => w.wave === 5), { wave: 5, deaths: 2 });
  assert.deepEqual(s.top_killers_by_wave['5'], [{ killer: 'bat', deaths: 2 }, { killer: 'wolf', deaths: 1 }]);
  assert.deepEqual(s.top_killers[0], { killer: 'bat', deaths: 2 });
  assert.deepEqual(s.abandon_waves, [{ wave: 4, runs: 1 }]);

  // s1: 3 runs, s2: 2, s3: 2
  assert.deepEqual(s.runs_per_session.distribution, [{ runs_in_session: 2, sessions: 2 }, { runs_in_session: 3, sessions: 1 }]);
  assert.equal(s.runs_per_session.sessions, 3);

  const sword = s.items.find((i: any) => i.item === 'sword');
  assert.equal(sword.offers, 2);
  assert.equal(sword.buys, 2);
  assert.equal(sword.buy_rate, 1);
  assert.equal(sword.presence_in_wins, 1); // sword esta nas 2 vitorias
  assert.equal(s.items.find((i: any) => i.item === 'shield').buy_rate, 0);
  // ring: 2 vitorias + 1 abandono = 3 runs, 2 delas vitorias
  const ring = s.items.find((i: any) => i.item === 'ring');
  assert.deepEqual({ w: ring.wins_with, r: ring.runs_with, p: ring.presence_overall }, { w: 2, r: 3, p: 0.4286 });

  const hp = s.level_up_options.find((o: any) => o.stat === 'hp');
  assert.deepEqual({ offered: hp.offered, picked: hp.picked, rate: hp.pick_rate }, { offered: 2, picked: 2, rate: 1 });
  assert.equal(s.level_up_options.find((o: any) => o.stat === 'speed').picked, 0);

  assert.equal(s.feedback.responses, 2);
  assert.equal(s.feedback.avg_rating, 3.5);
  assert.deepEqual(s.feedback.tags.map((t: any) => [t.tag, t.responses]), [['divertido', 2], ['dificil', 1]]);
  assert.deepEqual(s.available.builds, ['0.6.0', '0.5.0']);
});

test('stats: filtros build, difficulty e datas; picked por nome do atributo', async () => {
  const { call, state } = setup();
  await seed(call);
  state.clock = new Date('2026-10-09T10:00:00Z');
  await call(post('/v1/runs', JSON.stringify(summary({ run_id: 'late', level_ups: [{ options: [{ stat: 'hp' }, { stat: 'speed' }], picked: 'speed' }] }))));
  const q = async (qs: string) => j(await call(get(`/v1/stats?key=${DASH}&${qs}`)));
  assert.equal((await q('build=0.6.0')).totals.runs, 1);
  assert.equal((await q('difficulty=hard')).totals.runs, 2);
  assert.equal((await q('from=2026-10-08')).totals.runs, 1);
  assert.equal((await q('to=2026-10-08')).totals.runs, 7);
  const late = await q('from=2026-10-09');
  assert.equal(late.level_up_options.find((o: any) => o.stat === 'speed').picked, 1);
  assert.equal((await q('difficulty=hard')).feedback.responses, 0);
  assert.equal((await q('difficulty=normal')).feedback.responses, 2);
  const badDate = await call(get(`/v1/stats?key=${DASH}&from=ontem`));
  assert.equal(badDate.status, 400);
});

test('stats e dashboard: sem DASH_KEY dao 404; chave errada 401', async () => {
  const off = setup({ DASH_KEY: undefined });
  assert.equal((await off.call(get('/v1/stats?key=x'))).status, 404);
  assert.equal((await off.call(get('/dashboard?key=x'))).status, 404);
  const { call } = setup();
  assert.equal((await call(get('/v1/stats'))).status, 401);
  assert.equal((await call(get('/dashboard?key=wrong'))).status, 401);
});

test('dashboard: HTML autocontido em portugues, sem recursos externos, com escape', async () => {
  const { call } = setup();
  await seed(call);
  await call(post('/v1/runs', JSON.stringify(death('xss', 3, '<script>alert(1)</script>'))));
  const res = await call(get(`/dashboard?key=${DASH}`));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type')!, /text\/html/);
  const html = await res.text();
  assert.match(html, /Win rate por dificuldade/);
  assert.match(html, /<svg /);
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /&lt;script&gt;alert\(1\)/);
  assert.doesNotMatch(html, /(src|href)="https?:/i);
  assert.match(html, /prefers-color-scheme:dark/);
});

test('privacidade: nenhuma coluna de IP/user agent e nenhum log de corpo', async () => {
  const { sql, call } = setup();
  const cols = ['runs', 'feedback'].flatMap((t) => (sql.prepare(`PRAGMA table_info(${t})`).all() as any[]).map((c) => c.name));
  for (const forbidden of ['ip', 'ip_address', 'ua', 'user_agent', 'remote_addr', 'cf_connecting_ip']) assert.ok(!cols.includes(forbidden), forbidden);
  const logs: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { logs.push(a); };
  try {
    const bad = { ...setup().env, DB: { prepare() { throw new Error('boom SECRET-BODY'); } } as any };
    const { handle } = await import('../src/index.ts');
    const res = await handle(post('/v1/runs', JSON.stringify(summary())), bad);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(logs).includes('SECRET'));
    assert.ok(!JSON.stringify(logs).includes('grant1'));
  } finally {
    console.error = orig;
  }
  assert.equal((await call(get('/v1/health'))).status, 200);
});
