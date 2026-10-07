import { HttpError, isObj, validId } from './util.ts';

export const SUMMARY_SCHEMA = 'uh-run-summary/1';
export const TRANSPORT_PROTOCOL = 'uh-transport/0.1';
export const FEEDBACK_PROTOCOL = 'uh-feedback/0.1';
export const RESULTS = ['victory', 'death', 'abandoned'];
export const SHOP_KINDS = ['offer', 'buy', 'reroll', 'lock', 'sell'];

function bad(code: string, message: string): never {
  throw new HttpError(400, code, message);
}

export function str(v: unknown, max = 100): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
}
export function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export interface SummaryColumns {
  build_version: string | null;
  build_commit: string | null;
  build_channel: string | null;
  character: string | null;
  difficulty: string | null;
  mode: string | null;
  players: number | null;
  platform: string | null;
  locale: string | null;
  result: string;
  wave_reached: number;
  waves_completed: number | null;
  duration_s: number | null;
  level: number | null;
  death_wave: number | null;
  killer: string | null;
  session_id: string | null;
  run_index: number | null;
}

/** Validação mínima de uh-run-summary/1 + extração das colunas indexadas. */
export function validateSummary(p: Record<string, unknown>): { grantId: string; cols: SummaryColumns } {
  if (p.schema !== SUMMARY_SCHEMA) bad('unsupported_schema', `schema must be "${SUMMARY_SCHEMA}".`);
  if (!validId(p.run_id)) bad('invalid_run_id', 'run_id must match [A-Za-z0-9_-]{1,100}.');
  if (!validId(p.grant_id)) bad('invalid_grant_id', 'grant_id must match [A-Za-z0-9_-]{1,100}.');
  for (const k of ['session', 'build', 'context'] as const) {
    if (p[k] !== undefined && !isObj(p[k])) bad('invalid_shape', `${k} must be an object.`);
  }
  if (!isObj(p.outcome)) bad('invalid_shape', 'outcome must be an object.');
  const outcome = p.outcome;
  if (typeof outcome.result !== 'string' || !RESULTS.includes(outcome.result)) {
    bad('invalid_shape', 'outcome.result must be victory, death or abandoned.');
  }
  const waveReached = num(outcome.wave_reached);
  if (waveReached === null || waveReached < 0) bad('invalid_shape', 'outcome.wave_reached must be a number >= 0.');
  if (p.death !== undefined && p.death !== null && !isObj(p.death)) bad('invalid_shape', 'death must be an object or null.');
  for (const k of ['waves', 'shop', 'level_ups'] as const) {
    if (p[k] !== undefined && !Array.isArray(p[k])) bad('invalid_shape', `${k} must be an array.`);
  }
  for (const arr of ['waves', 'shop', 'level_ups'] as const) {
    for (const el of (p[arr] as unknown[] | undefined) ?? []) {
      if (!isObj(el)) bad('invalid_shape', `${arr} entries must be objects.`);
    }
  }
  for (const s of (p.shop as Record<string, unknown>[] | undefined) ?? []) {
    if (s.kind !== undefined && !(typeof s.kind === 'string' && SHOP_KINDS.includes(s.kind))) {
      bad('invalid_shape', 'shop[].kind must be offer, buy, reroll, lock or sell.');
    }
  }
  for (const lu of (p.level_ups as Record<string, unknown>[] | undefined) ?? []) {
    if (lu.options !== undefined && !Array.isArray(lu.options)) bad('invalid_shape', 'level_ups[].options must be an array.');
  }
  if (p.final_build !== undefined && !isObj(p.final_build)) bad('invalid_shape', 'final_build must be an object.');
  const fb = p.final_build as Record<string, unknown> | undefined;
  if (fb) {
    for (const k of ['weapons', 'items'] as const) {
      if (fb[k] !== undefined && !Array.isArray(fb[k])) bad('invalid_shape', `final_build.${k} must be an array.`);
    }
  }

  const session = (p.session ?? {}) as Record<string, unknown>;
  const build = (p.build ?? {}) as Record<string, unknown>;
  const context = (p.context ?? {}) as Record<string, unknown>;
  const death = isObj(p.death) ? p.death : null;
  const deathWave = death ? int(death.wave) : null;
  return {
    grantId: p.grant_id as string,
    cols: {
      build_version: str(build.version),
      build_commit: str(build.commit),
      build_channel: str(build.channel),
      character: str(context.character),
      difficulty: str(context.difficulty),
      mode: str(context.mode),
      players: int(context.players),
      platform: str(context.platform),
      locale: str(context.locale, 35),
      result: outcome.result as string,
      wave_reached: Math.trunc(waveReached),
      waves_completed: int(outcome.waves_completed),
      duration_s: num(outcome.duration_s),
      level: int(outcome.level),
      death_wave: deathWave ?? (outcome.result === 'death' ? Math.trunc(waveReached) : null),
      killer: death ? str(death.killer) : null,
      session_id: str(session.id),
      run_index: int(session.run_index),
    },
  };
}

export interface FeedbackParsed {
  responseId: string;
  runId: string;
  grantId: string | null;
  revision: number;
  rating: number;
  comment: string;
  tags: string[];
  locale: string | null;
  questionVersion: string | null;
  scaleVersion: string | null;
}

function codepoints(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/**
 * Aceita dois formatos:
 *  A) o do cliente atual: {protocol:"uh-feedback/0.1", response_id, revision, run_id, rating, comment, ...} (sem grant_id/tags)
 *  B) o contrato novo: {run_id, grant_id, rating, comment, tags[]} (id de submissão = response_id ou, se ausente, run_id)
 */
export function parseFeedback(b: Record<string, unknown>): FeedbackParsed {
  const legacy = b.protocol !== undefined;
  if (legacy && b.protocol !== FEEDBACK_PROTOCOL) bad('unsupported_schema', `protocol must be "${FEEDBACK_PROTOCOL}".`);
  if (!legacy && b.schema !== undefined && b.schema !== 'uh-feedback/1') bad('unsupported_schema', 'schema must be "uh-feedback/1" or omitted.');
  if (!validId(b.run_id)) bad('invalid_run_id', 'run_id must match [A-Za-z0-9_-]{1,100}.');
  let grantId: string | null = null;
  if (b.grant_id !== undefined && b.grant_id !== null) {
    if (!validId(b.grant_id)) bad('invalid_grant_id', 'grant_id must match [A-Za-z0-9_-]{1,100}.');
    grantId = b.grant_id;
  } else if (!legacy) {
    bad('invalid_grant_id', 'grant_id is required.');
  }
  let responseId: string;
  if (b.response_id !== undefined) {
    if (!validId(b.response_id)) bad('invalid_response_id', 'response_id must match [A-Za-z0-9_-]{1,100}.');
    responseId = b.response_id;
  } else if (legacy) {
    return bad('invalid_response_id', 'response_id is required.');
  } else {
    responseId = b.run_id;
  }
  let revision = 1;
  if (b.revision !== undefined) {
    if (typeof b.revision !== 'number' || !Number.isInteger(b.revision) || b.revision < 1 || b.revision > 1_000_000) {
      bad('invalid_revision', 'revision must be an integer between 1 and 1000000.');
    }
    revision = b.revision;
  }
  if (typeof b.rating !== 'number' || !Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) {
    bad('invalid_rating', 'rating must be an integer from 1 to 5.');
  }
  const comment = b.comment === undefined || b.comment === null ? '' : b.comment;
  if (typeof comment !== 'string') bad('invalid_comment', 'comment must be a string.');
  if (codepoints(comment) > 1000) bad('invalid_comment', 'comment must have at most 1000 characters.');
  if (/[\ud800-\udfff]/u.test(comment)) bad('invalid_comment', 'comment contains invalid Unicode.');
  let tags: string[] = [];
  if (b.tags !== undefined && b.tags !== null) {
    if (!Array.isArray(b.tags) || b.tags.length > 20) bad('invalid_tags', 'tags must be an array of at most 20 strings.');
    for (const t of b.tags) {
      if (typeof t !== 'string' || t.length < 1 || t.length > 40) bad('invalid_tags', 'each tag must be a string of 1 to 40 characters.');
    }
    tags = [...new Set(b.tags as string[])];
  }
  return {
    responseId,
    runId: b.run_id,
    grantId,
    revision,
    rating: b.rating,
    comment,
    tags,
    locale: str(b.locale, 35),
    questionVersion: str(b.question_version, 50),
    scaleVersion: str(b.scale_version, 50),
  };
}
