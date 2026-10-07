import postgres from "postgres";
import { env } from "./env";

let _sql: postgres.Sql | null = null;

/** Works with Neon (use the pooled connection string), Supabase, or a local Postgres. */
export function sql() {
  if (!_sql) {
    const url = env("DATABASE_URL");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("host=/");
    _sql = postgres(url, {
      ssl: local ? false : "require",
      prepare: false, // required behind PgBouncer-style poolers (Neon/Supabase pooled URLs)
      max: process.env.VERCEL ? 1 : 5,
      idle_timeout: 20,
      onnotice: () => {},
    });
  }
  return _sql;
}

export async function closeDb() {
  await _sql?.end({ timeout: 5 });
  _sql = null;
}

export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS lifelogs (
    id text PRIMARY KEY,
    day date NOT NULL,
    title text,
    start_time timestamptz,
    end_time timestamptz,
    markdown text,
    contents jsonb,
    is_starred boolean DEFAULT false,
    updated_at timestamptz,
    synced_at timestamptz DEFAULT now(),
    search tsvector GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(markdown, ''))
    ) STORED
  )`,
  `CREATE INDEX IF NOT EXISTS lifelogs_day_idx ON lifelogs (day, start_time)`,
  `CREATE INDEX IF NOT EXISTS lifelogs_search_idx ON lifelogs USING gin (search)`,
  `CREATE TABLE IF NOT EXISTS chats (
    id text PRIMARY KEY,
    day date,
    summary text,
    created_at timestamptz,
    is_scheduled boolean DEFAULT false,
    prompt text,
    answer text,
    raw jsonb,
    synced_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS chats_scheduled_idx ON chats (is_scheduled, day)`,
  `CREATE TABLE IF NOT EXISTS daily_summaries (
    day date NOT NULL,
    source text NOT NULL CHECK (source IN ('generated', 'limitless')),
    content_md text NOT NULL,
    is_partial boolean DEFAULT false,
    prompt_used text,
    model text,
    chat_id text,
    created_at timestamptz DEFAULT now(),
    search tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content_md, ''))) STORED,
    PRIMARY KEY (day, source)
  )`,
  `CREATE INDEX IF NOT EXISTS daily_summaries_search_idx ON daily_summaries USING gin (search)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS job_runs (
    id bigserial PRIMARY KEY,
    job text NOT NULL,
    day date,
    status text NOT NULL,
    detail text,
    ran_at timestamptz DEFAULT now()
  )`,
];

export async function migrate() {
  const q = sql();
  for (const stmt of MIGRATIONS) await q.unsafe(stmt);
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql()`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length ? (rows[0].value as string) : null;
}

export async function setSetting(key: string, value: string) {
  await sql()`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

export async function logJob(job: string, day: string | null, status: "ok" | "skipped" | "error", detail: string) {
  try {
    await sql()`INSERT INTO job_runs (job, day, status, detail) VALUES (${job}, ${day}, ${status}, ${detail.slice(0, 4000)})`;
  } catch (e) {
    console.error("failed to log job", e);
  }
}

/** Postgres `date` columns come back as JS Dates from the driver; normalise to YYYY-MM-DD. */
export function asDay(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
