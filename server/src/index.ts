import { renderDashboard } from './dashboard.ts';
import { handleFeedback, handleRuns } from './ingest.ts';
import { computeStats, parseFilters } from './stats.ts';
import type { Clock, Env } from './types.ts';
import { HttpError, errorResponse, json, safeEqual } from './util.ts';

const systemClock: Clock = () => new Date();

async function requireDashKey(url: URL, request: Request, env: Env): Promise<string> {
  // Sem DASH_KEY configurada as rotas de leitura não existem.
  if (!env.DASH_KEY) throw new HttpError(404, 'not_found', 'Not found.');
  const given = url.searchParams.get('key') ?? request.headers.get('x-dash-key') ?? '';
  if (!(await safeEqual(given, env.DASH_KEY))) throw new HttpError(401, 'unauthorized', 'Missing or invalid key.');
  return given;
}

export async function handle(request: Request, env: Env, now: Clock = systemClock): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const post = (fn: typeof handleRuns) => {
      if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST.', { allow: 'POST' });
      return fn(request, env, now);
    };
    const get = () => {
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Use GET.', { allow: 'GET' });
    };
    switch (path) {
      case '/v1/runs':
        return await post(handleRuns);
      case '/v1/feedback':
        return await post(handleFeedback);
      case '/v1/health':
        return json({ ok: true });
      case '/v1/stats': {
        get();
        await requireDashKey(url, request, env);
        return json(await computeStats(env.DB, parseFilters(url.searchParams), now()));
      }
      case '/dashboard': {
        get();
        const key = await requireDashKey(url, request, env);
        const stats = await computeStats(env.DB, parseFilters(url.searchParams), now());
        return new Response(renderDashboard(stats, key), {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'referrer-policy': 'no-referrer',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
          },
        });
      }
      default:
        throw new HttpError(404, 'not_found', 'Not found.');
    }
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e);
    // Nunca registra corpo, cabeçalhos ou IP: só o tipo do erro.
    console.error('internal_error', e instanceof Error ? e.name : 'unknown');
    return json({ ok: false, error: 'internal', message: 'Internal error.' }, 500, { 'retry-after': '30' });
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
