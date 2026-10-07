// Subconjunto mínimo do D1 e do ambiente, para o código compilar sem @cloudflare/workers-types.
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
export interface Env {
  DB: D1Database;
  /** Worker secret: chave de escrita que o jogo envia como Bearer. */
  INGEST_KEY?: string;
  /** Worker secret: chave de leitura de /v1/stats e /dashboard. Sem ela as duas rotas dão 404. */
  DASH_KEY?: string;
  /** Opcional: limite de bytes descomprimidos (padrão 1 MiB). */
  MAX_BODY_BYTES?: string;
  /** Opcional: máximo de runs novos por grant_id por dia (padrão 200). */
  DAILY_RUN_LIMIT?: string;
}
export type Clock = () => Date;
