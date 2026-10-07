export class HttpError extends Error {
  status: number;
  code: string;
  headers: Record<string, string>;
  constructor(status: number, code: string, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export const DEFAULT_MAX_BODY = 1_048_576;
const encoder = new TextEncoder();

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(e: HttpError): Response {
  // O cliente do jogo limita a resposta a 4096 bytes: mensagens ficam curtas.
  return json({ ok: false, error: e.code, message: e.message.slice(0, 300) }, e.status, e.headers);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante (compara os hashes, que têm tamanho fixo). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

/** Mesma regra de id do cliente (UHTelemetryOutbox.valid_id). */
export function validId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
}

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function maxBodyBytes(env: { MAX_BODY_BYTES?: string }): number {
  const n = Number(env.MAX_BODY_BYTES);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_BODY;
}

class TooLarge extends Error {}

async function readLimited(stream: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new TooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Lê o corpo (gzip ou JSON puro, detectado pelo magic number 1f 8b) e devolve os bytes
 * descomprimidos. O limite vale para o corpo recebido e para o descomprimido.
 */
export async function readBody(request: Request, max: number): Promise<Uint8Array> {
  const tooLarge = new HttpError(413, 'payload_too_large', `Body exceeds ${max} bytes (decompressed).`);
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) throw tooLarge;
  if (!request.body) throw new HttpError(400, 'empty_body', 'Request body is empty.');
  let received: Uint8Array;
  try {
    received = await readLimited(request.body, max);
  } catch (e) {
    if (e instanceof TooLarge) throw tooLarge;
    throw new HttpError(400, 'unreadable_body', 'Could not read request body.');
  }
  if (received.length === 0) throw new HttpError(400, 'empty_body', 'Request body is empty.');
  if (received[0] === 0x1f && received[1] === 0x8b) {
    try {
      const stream = new Response(received as BodyInit).body!.pipeThrough(new DecompressionStream('gzip'));
      return await readLimited(stream, max);
    } catch (e) {
      if (e instanceof TooLarge) throw tooLarge;
      throw new HttpError(400, 'invalid_gzip', 'Body is not valid gzip.');
    }
  }
  return received;
}

export function parseJsonObject(bytes: Uint8Array): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, 'invalid_json', 'Body is not valid UTF-8 JSON.');
  }
  if (!isObj(value)) throw new HttpError(400, 'invalid_json', 'Body must be a JSON object.');
  return value;
}

export function secondsUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}
