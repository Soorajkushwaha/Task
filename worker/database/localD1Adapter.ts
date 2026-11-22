import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Env } from './d1';

let cachedEnv: Env | null = null;

/**
 * Local Cloudflare D1 (SQLite) & R2 Bucket simulator for Vite local dev/preview.
 * Executes `migrations/0001_initial_schema.sql` against a persistent SQLite database
 * in `.wrangler/whimsymaya-d1.sqlite` so all Worker `/api/*` endpoints run real SQLite queries.
 */
export function getLocalCloudflareEnv(projectRoot: string): Env {
  if (cachedEnv) return cachedEnv;

  const stateDir = path.resolve(projectRoot, '.wrangler');
  const r2Dir = path.resolve(stateDir, 'r2-files');
  fs.mkdirSync(r2Dir, { recursive: true });

  const dbPath = path.resolve(stateDir, 'whimsymaya-d1.sqlite');
  const sqlite = new DatabaseSync(dbPath);

  // Apply D1 SQL migrations
  const migrationFile = path.resolve(projectRoot, 'migrations/0001_initial_schema.sql');
  if (fs.existsSync(migrationFile)) {
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    sqlite.exec(sqlContent);
  }

  const createStatement = (sql: string, boundParams: unknown[] = []) => {
    const normalizeParams = (params: unknown[]) =>
      params.map((p) => {
        if (p === undefined) return null;
        if (typeof p === 'boolean') return p ? 1 : 0;
        return p as string | number | bigint | Uint8Array | null;
      });

    return {
      bind(...params: unknown[]) {
        return createStatement(sql, params);
      },
      async all<T = Record<string, unknown>>() {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...normalizeParams(boundParams)) as T[];
        return {
          results: rows,
          success: true,
          meta: { duration: 0.1, changes: 0, last_row_id: 0, served_by: 'local-d1-sqlite' },
        };
      },
      async first<T = Record<string, unknown>>(colName?: string) {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...normalizeParams(boundParams)) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as unknown as T;
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const res = stmt.run(...normalizeParams(boundParams));
        return {
          results: [],
          success: true,
          meta: {
            duration: 0.1,
            changes: Number(res.changes ?? 0),
            last_row_id: Number(res.lastInsertRowid ?? 0),
            served_by: 'local-d1-sqlite',
          },
        };
      },
      async raw<T = unknown[]>() {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...normalizeParams(boundParams)) as Record<string, unknown>[];
        return rows.map((r) => Object.values(r)) as unknown as T[];
      },
    };
  };

  const localD1 = {
    prepare(sql: string) {
      return createStatement(sql);
    },
    async batch(statements: Array<{ all: () => Promise<unknown> }>) {
      const results = [];
      for (const st of statements) {
        results.push(await st.all());
      }
      return results;
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0.1 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;

  const localR2 = {
    async put(
      key: string,
      value: ArrayBuffer | Uint8Array | string,
      options?: { httpMetadata?: { contentType?: string } }
    ) {
      const safePath = path.resolve(r2Dir, Buffer.from(key).toString('hex'));
      const metaPath = `${safePath}.meta.json`;
      const buf =
        typeof value === 'string'
          ? Buffer.from(value, 'utf-8')
          : value instanceof ArrayBuffer
          ? Buffer.from(value)
          : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      fs.writeFileSync(safePath, buf);
      fs.writeFileSync(
        metaPath,
        JSON.stringify({
          key,
          contentType: options?.httpMetadata?.contentType || 'application/octet-stream',
          size: buf.byteLength,
        })
      );
      return { key, size: buf.byteLength };
    },
    async get(key: string) {
      const safePath = path.resolve(r2Dir, Buffer.from(key).toString('hex'));
      const metaPath = `${safePath}.meta.json`;
      if (!fs.existsSync(safePath)) return null;
      const buf = fs.readFileSync(safePath);
      let contentType = 'application/octet-stream';
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          contentType = meta.contentType || contentType;
        } catch {
          // ignore
        }
      }
      return {
        key,
        size: buf.byteLength,
        httpMetadata: { contentType },
        async arrayBuffer() {
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      };
    },
    async delete(key: string) {
      const safePath = path.resolve(r2Dir, Buffer.from(key).toString('hex'));
      const metaPath = `${safePath}.meta.json`;
      if (fs.existsSync(safePath)) fs.unlinkSync(safePath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    },
  } as unknown as R2Bucket;

  cachedEnv = {
    DB: localD1,
    FILES: localR2,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || '',
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
    VITE_TURNSTILE_SITE_KEY: process.env.VITE_TURNSTILE_SITE_KEY || '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    EMAIL_FROM: process.env.EMAIL_FROM || '',
    APP_NAME: 'WhimsyMaya',
    ENVIRONMENT: process.env.NODE_ENV || 'development',
  };

  return cachedEnv;
}
