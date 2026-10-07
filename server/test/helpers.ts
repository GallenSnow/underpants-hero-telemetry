import { gzipSync } from 'node:zlib';
import { handle } from '../src/index.ts';
import type { Env } from '../src/types.ts';
import { createD1 } from './d1shim.ts';

export const INGEST = 'test-ingest-key';
export const DASH = 'test-dash-key';
export const BASE = 'https://uh.test';

export function setup(overrides: Partial<Env> = {}, clock = new Date('2026-10-07T12:00:00Z')) {
  const { db, sql } = createD1();
  const env: Env = { DB: db, INGEST_KEY: INGEST, DASH_KEY: DASH, ...overrides };
  const state = { clock };
  const call = (req: Request) => handle(req, env, () => state.clock);
  return { env, sql, state, call };
}

export function post(path: string, body: string | Uint8Array, opts: { token?: string | null; gzip?: boolean } = {}): Request {
  const bytes = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
  const payload = opts.gzip ? gzipSync(bytes) : bytes;
  const headers: Record<string, string> = { 'content-type': opts.gzip ? 'application/gzip' : 'application/json' };
  const token = opts.token === undefined ? INGEST : opts.token;
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(BASE + path, { method: 'POST', headers, body: payload });
}

export const get = (path: string) => new Request(BASE + path);

export function summary(over: Record<string, unknown> = {}): Record<string, any> {
  return {
    schema: 'uh-run-summary/1',
    grant_id: 'grant1',
    run_id: 'run1',
    session: { id: 'sess1', run_index: 1 },
    build: { version: '0.5.0', commit: 'abc123', channel: 'dev' },
    context: { character: 'hero', difficulty: 'normal', mode: 'solo', players: 1, locale: 'pt_BR', platform: 'windows' },
    outcome: { result: 'victory', wave_reached: 20, waves_completed: 20, duration_s: 900, level: 15 },
    death: null,
    waves: [{ wave: 1, clear_s: 30, damage_taken: { rat: 3 }, healed: 0, min_hp: 8, kills: 12, gold_earned: 10, gold_collected: 9, gold_lost_bandit: 1, xp: 5, level_end: 2 }],
    shop: [
      { wave: 1, kind: 'offer', item: 'sword', tier: 1, price: 10 },
      { wave: 1, kind: 'offer', item: 'shield', tier: 1, price: 12 },
      { wave: 1, kind: 'buy', item: 'sword', tier: 1, price: 10 },
    ],
    level_ups: [{ wave: 2, level: 2, options: [{ stat: 'hp', tier: 1, value: 3 }, { stat: 'speed', tier: 1, value: 2 }], picked: 0 }],
    final_build: { weapons: [{ item: 'sword', tier: 2 }], items: [{ item: 'ring', count: 1 }], stats: { hp: 10 } },
    ...over,
  };
}

export function death(id: string, wave: number, killer: string, over: Record<string, unknown> = {}) {
  return summary({
    run_id: id,
    outcome: { result: 'death', wave_reached: wave, waves_completed: wave - 1, duration_s: 300, level: 5 },
    death: { wave, t_in_wave: 12, killer, max_hp: 10, last_hits: [{ src: killer, dmg: 3, t: 11 }] },
    shop: [], level_ups: [], final_build: { weapons: [{ item: 'bow', tier: 1 }], items: [], stats: {} },
    ...over,
  });
}

export const envelope = (payload: Record<string, unknown>, o: Record<string, unknown> = {}) => ({
  protocol: 'uh-transport/0.1', run_id: payload.run_id, revision: 1, payload_schema: 'uh-run-summary/1', lifecycle: 'final', payload, ...o,
});
