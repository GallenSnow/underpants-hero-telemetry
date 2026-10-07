// D1 de mentira sobre node:sqlite (SQLite real, com JSON1), só para os testes locais.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { D1Database, D1PreparedStatement, D1Result } from '../src/types.ts';

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));

export function createD1(): { db: D1Database; sql: DatabaseSync } {
  const sql = new DatabaseSync(':memory:');
  for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
    sql.exec(readFileSync(migrationsDir + f, 'utf8'));
  }
  const norm = (params: unknown[]) => params.map((p) => {
    if (p === undefined) throw new Error('D1 nao aceita undefined em bind()');
    return p as null | number | string;
  });
  const make = (text: string, params: unknown[] = []): D1PreparedStatement => ({
    bind: (...values) => make(text, values),
    async first<T>() { return (sql.prepare(text).get(...norm(params)) as T | undefined) ?? null; },
    async all<T>() {
      const results = sql.prepare(text).all(...norm(params)).map((r) => ({ ...r })) as T[];
      return { results, success: true, meta: {} } as D1Result<T>;
    },
    async run() {
      const r = sql.prepare(text).run(...norm(params));
      return { results: [], success: true, meta: { changes: Number(r.changes) } };
    },
  });
  const db: D1Database = {
    prepare: (text) => make(text),
    async batch<T>(statements: D1PreparedStatement[]) {
      sql.exec('BEGIN');
      try {
        const out: D1Result<T>[] = [];
        for (const s of statements) out.push((await s.all<T>()) as D1Result<T>);
        sql.exec('COMMIT');
        return out;
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { db, sql };
}
