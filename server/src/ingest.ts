import type { Clock, Env } from './types.ts';
import {
  HttpError, isObj, json, maxBodyBytes, parseJsonObject, readBody, safeEqual, secondsUntilNextUtcDay, sha256Hex, validId,
} from './util.ts';
import {
  SUMMARY_SCHEMA, TRANSPORT_PROTOCOL, parseFeedback, validateSummary, type SummaryColumns,
} from './validate.ts';

const UNKNOWN_GRANT_DAILY_LIMIT = 5000;

export async function authorize(request: Request, env: Env): Promise<void> {
  if (!env.INGEST_KEY) throw new HttpError(503, 'not_configured', 'Server has no INGEST_KEY configured.', { 'retry-after': '3600' });
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match || !(await safeEqual(match[1], env.INGEST_KEY))) {
    throw new HttpError(401, 'unauthorized', 'Missing or invalid bearer token.', { 'www-authenticate': 'Bearer' });
  }
}

function dailyLimit(env: Env): number {
  const n = Number(env.DAILY_RUN_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 200;
}

interface ParsedRun {
  runId: string;
  revision: number;
  kind: 'summary' | 'pilot';
  payloadSchema: string;
  lifecycle: 'open' | 'final';
  grantId: string | null;
  cols: SummaryColumns | null;
  /** Payload serializado quando o resumo veio dentro de um envelope. */
  doc: string | null;
}

function parseRun(body: Record<string, unknown>): ParsedRun {
  if (body.protocol !== undefined) {
    if (body.protocol !== TRANSPORT_PROTOCOL) throw new HttpError(400, 'unsupported_schema', `protocol must be "${TRANSPORT_PROTOCOL}".`);
    if (!validId(body.run_id)) throw new HttpError(400, 'invalid_run_id', 'run_id must match [A-Za-z0-9_-]{1,100}.');
    const revision = body.revision;
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1 || revision > 1_000_000) {
      throw new HttpError(400, 'invalid_revision', 'revision must be an integer between 1 and 1000000.');
    }
    const schema = body.payload_schema;
    if (typeof schema !== 'string' || schema.length < 1 || schema.length > 100) {
      throw new HttpError(400, 'invalid_shape', 'payload_schema must be a non-empty string.');
    }
    if (!isObj(body.payload)) throw new HttpError(400, 'invalid_shape', 'payload must be an object.');
    if (body.lifecycle !== 'open' && body.lifecycle !== 'final') throw new HttpError(400, 'invalid_shape', 'lifecycle must be open or final.');
    const payload = body.payload;
    if (schema === SUMMARY_SCHEMA) {
      const { grantId, cols } = validateSummary(payload);
      if (payload.run_id !== body.run_id) throw new HttpError(400, 'run_id_mismatch', 'payload.run_id differs from run_id.');
      return { runId: body.run_id, revision, kind: 'summary', payloadSchema: schema, lifecycle: body.lifecycle, grantId, cols, doc: JSON.stringify(payload) };
    }
    // Payload antigo do piloto: guardado cru, sem validação de conteúdo.
    return {
      runId: body.run_id, revision, kind: 'pilot', payloadSchema: schema, lifecycle: body.lifecycle,
      grantId: validId(payload.grant_id) ? payload.grant_id : null, cols: null, doc: null,
    };
  }
  if (body.schema === SUMMARY_SCHEMA) {
    const { grantId, cols } = validateSummary(body);
    return { runId: body.run_id as string, revision: 1, kind: 'summary', payloadSchema: SUMMARY_SCHEMA, lifecycle: 'final', grantId, cols, doc: null };
  }
  throw new HttpError(400, 'unsupported_schema', `Unknown schema. Supported: "${SUMMARY_SCHEMA}" or an "${TRANSPORT_PROTOCOL}" envelope.`);
}

export async function handleRuns(request: Request, env: Env, now: Clock): Promise<Response> {
  await authorize(request, env);
  const bytes = await readBody(request, maxBodyBytes(env));
  const body = parseJsonObject(bytes);
  const run = parseRun(body);
  const sha = await sha256Hex(bytes);
  // Campos que o cliente confere antes de gravar o .ack local.
  const receipt = { ok: true, persisted: true, run_id: run.runId, revision: run.revision, sha256: sha };
  const db = env.DB;

  const existing = (await db.prepare('SELECT revision, sha256 FROM runs WHERE run_id = ?').bind(run.runId).all<{ revision: number; sha256: string }>()).results;
  const same = existing.find((e) => e.revision === run.revision);
  if (same) {
    if (same.sha256 === sha) return json(receipt, 200, { 'x-uh-duplicate': '1' });
    throw new HttpError(409, 'revision_conflict', 'This run revision was already stored with different content.');
  }
  if (existing.some((e) => e.revision > run.revision)) {
    // Revisão antiga reenviada depois de uma mais nova: já está coberta.
    return json({ ...receipt, superseded: true }, 200, { 'x-uh-duplicate': '1' });
  }

  const at = now();
  const day = at.toISOString().slice(0, 10);
  if (existing.length === 0) {
    const limit = run.grantId ? dailyLimit(env) : UNKNOWN_GRANT_DAILY_LIMIT;
    const used = await db.prepare('SELECT COUNT(DISTINCT run_id) AS c FROM runs WHERE day = ? AND grant_id IS ?').bind(day, run.grantId).first<{ c: number }>();
    if ((used?.c ?? 0) >= limit) {
      throw new HttpError(429, 'daily_limit', `Daily run limit (${limit}) reached for this grant.`, { 'retry-after': String(secondsUntilNextUtcDay(at)) });
    }
  }

  const c = run.cols;
  await db.batch([
    db.prepare(
      `INSERT INTO runs (run_id, revision, kind, payload_schema, lifecycle, grant_id, sha256, received_at, day, raw, doc,
         build_version, build_commit, build_channel, character, difficulty, mode, players, platform, locale,
         result, wave_reached, waves_completed, duration_s, level, death_wave, killer, session_id, run_index)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?)
       ON CONFLICT (run_id, revision) DO NOTHING`,
    ).bind(
      run.runId, run.revision, run.kind, run.payloadSchema, run.lifecycle, run.grantId, sha, at.toISOString(), day,
      new TextDecoder().decode(bytes), run.doc,
      c?.build_version ?? null, c?.build_commit ?? null, c?.build_channel ?? null, c?.character ?? null, c?.difficulty ?? null,
      c?.mode ?? null, c?.players ?? null, c?.platform ?? null, c?.locale ?? null,
      c?.result ?? null, c?.wave_reached ?? null, c?.waves_completed ?? null, c?.duration_s ?? null, c?.level ?? null,
      c?.death_wave ?? null, c?.killer ?? null, c?.session_id ?? null, c?.run_index ?? null,
    ),
    // Só a revisão mais nova de cada run fica guardada.
    db.prepare('DELETE FROM runs WHERE run_id = ? AND revision < ?').bind(run.runId, run.revision),
  ]);
  return json(receipt);
}

export async function handleFeedback(request: Request, env: Env, now: Clock): Promise<Response> {
  await authorize(request, env);
  const bytes = await readBody(request, maxBodyBytes(env));
  const fb = parseFeedback(parseJsonObject(bytes));
  const sha = await sha256Hex(bytes);
  const receipt = { ok: true, persisted: true, response_id: fb.responseId, run_id: fb.runId, revision: fb.revision, sha256: sha };
  const db = env.DB;

  const existing = await db.prepare('SELECT sha256 FROM feedback WHERE response_id = ?').bind(fb.responseId).first<{ sha256: string }>();
  if (existing) {
    if (existing.sha256 === sha) return json(receipt, 200, { 'x-uh-duplicate': '1' });
    throw new HttpError(409, 'already_submitted', 'Feedback for this response_id was already stored with different content.');
  }

  const at = now();
  const day = at.toISOString().slice(0, 10);
  // O cliente atual não manda grant_id no feedback: recupera pela run, se ela já chegou.
  let grantId = fb.grantId;
  if (!grantId) {
    const row = await db.prepare('SELECT grant_id FROM runs WHERE run_id = ? AND grant_id IS NOT NULL LIMIT 1').bind(fb.runId).first<{ grant_id: string }>();
    grantId = row?.grant_id ?? null;
  }
  if (grantId) {
    const used = await db.prepare('SELECT COUNT(*) AS c FROM feedback WHERE day = ? AND grant_id = ?').bind(day, grantId).first<{ c: number }>();
    if ((used?.c ?? 0) >= dailyLimit(env)) {
      throw new HttpError(429, 'daily_limit', 'Daily feedback limit reached for this grant.', { 'retry-after': String(secondsUntilNextUtcDay(at)) });
    }
  }
  await db.prepare(
    `INSERT INTO feedback (response_id, run_id, grant_id, revision, rating, comment, tags, locale, question_version, scale_version, sha256, received_at, day, raw)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (response_id) DO NOTHING`,
  ).bind(
    fb.responseId, fb.runId, grantId, fb.revision, fb.rating, fb.comment, JSON.stringify(fb.tags), fb.locale,
    fb.questionVersion, fb.scaleVersion, sha, at.toISOString(), day, new TextDecoder().decode(bytes),
  ).run();
  return json(receipt);
}
