import { sql } from "./db";
import { config } from "./env";
import { conversationFromRow, type Conversation } from "./transcript";

export interface DayRow {
  day: string;
  conversations: number;
  first_start: string | null;
  last_end: string | null;
  has_generated: boolean;
  has_limitless: boolean;
  tldr: string | null;
}

export async function listDays(limit = 120): Promise<DayRow[]> {
  const rows = await sql()`
    WITH days AS (
      SELECT day FROM lifelogs GROUP BY day
      UNION SELECT day FROM daily_summaries
    )
    SELECT d.day::text AS day,
      (SELECT count(*)::int FROM lifelogs l WHERE l.day = d.day) AS conversations,
      (SELECT min(start_time) FROM lifelogs l WHERE l.day = d.day) AS first_start,
      (SELECT max(end_time) FROM lifelogs l WHERE l.day = d.day) AS last_end,
      EXISTS (SELECT 1 FROM daily_summaries s WHERE s.day = d.day AND s.source = 'generated') AS has_generated,
      EXISTS (SELECT 1 FROM daily_summaries s WHERE s.day = d.day AND s.source = 'limitless') AS has_limitless,
      (SELECT substring(content_md from '## TL;DR\\s*\\n((?:[-*].*\\n?){1,5})')
         FROM daily_summaries s WHERE s.day = d.day AND s.source = 'generated') AS tldr
    FROM days d ORDER BY d.day DESC LIMIT ${limit}`;
  return rows as unknown as DayRow[];
}

export async function getConversations(day: string): Promise<Conversation[]> {
  const rows = await sql()`
    SELECT id, title, start_time, end_time, markdown, contents
    FROM lifelogs WHERE day = ${day} ORDER BY start_time`;
  return rows.map((r: any) => conversationFromRow(r, config.timezone));
}

export interface SummaryRow {
  day: string;
  source: "generated" | "limitless";
  content_md: string;
  is_partial: boolean;
  prompt_used: string | null;
  model: string | null;
  created_at: string | null;
}

export async function getSummaries(day: string): Promise<SummaryRow[]> {
  const rows = await sql()`
    SELECT day::text AS day, source, content_md, is_partial, prompt_used, model, created_at
    FROM daily_summaries WHERE day = ${day}`;
  return rows as unknown as SummaryRow[];
}

export async function neighbourDays(day: string) {
  const [prev] = await sql()`SELECT max(day)::text AS d FROM lifelogs WHERE day < ${day}`;
  const [next] = await sql()`SELECT min(day)::text AS d FROM lifelogs WHERE day > ${day}`;
  return { prev: (prev?.d as string) ?? null, next: (next?.d as string) ?? null };
}

// ts_headline wraps hits in these sentinels; the page escapes everything and then swaps them for <mark>.
export const HL_START = "\u0001";
export const HL_END = "\u0002";

export interface SearchHit {
  kind: "summary" | "transcript";
  day: string;
  id: string;
  title: string;
  start_time: string | null;
  snippet: string;
}

export async function search(q: string): Promise<SearchHit[]> {
  const opts = `StartSel=${HL_START}, StopSel=${HL_END}, MaxFragments=3, MaxWords=30, MinWords=10, FragmentDelimiter=" … "`;
  const summaries = await sql()`
    SELECT 'summary' AS kind, s.day::text AS day, s.source AS id,
      CASE WHEN s.source = 'limitless' THEN 'Limitless daily summary' ELSE 'Daily summary' END AS title,
      NULL AS start_time,
      ts_headline('english', s.content_md, query, ${opts}) AS snippet,
      ts_rank(s.search, query) AS rank
    FROM daily_summaries s, websearch_to_tsquery('english', ${q}) query
    WHERE s.search @@ query
    ORDER BY rank DESC, s.day DESC LIMIT 25`;
  const logs = await sql()`
    SELECT 'transcript' AS kind, l.day::text AS day, l.id, coalesce(l.title, 'Untitled') AS title,
      l.start_time,
      ts_headline('english', coalesce(l.markdown, ''), query, ${opts}) AS snippet,
      ts_rank(l.search, query) AS rank
    FROM lifelogs l, websearch_to_tsquery('english', ${q}) query
    WHERE l.search @@ query
    ORDER BY rank DESC, l.day DESC LIMIT 75`;
  return [...summaries, ...logs] as unknown as SearchHit[];
}

export async function stats() {
  const [r] = await sql()`
    SELECT
      (SELECT count(*)::int FROM lifelogs) AS lifelogs,
      (SELECT min(day)::text FROM lifelogs) AS first_day,
      (SELECT max(day)::text FROM lifelogs) AS last_day,
      (SELECT count(DISTINCT day)::int FROM lifelogs) AS days,
      (SELECT count(*)::int FROM daily_summaries WHERE source = 'generated') AS generated,
      (SELECT count(*)::int FROM daily_summaries WHERE source = 'limitless') AS limitless,
      (SELECT count(*)::int FROM chats) AS chats`;
  const jobs = await sql()`SELECT job, day::text AS day, status, detail, ran_at FROM job_runs ORDER BY ran_at DESC LIMIT 15`;
  return {
    ...(r as {
      lifelogs: number;
      first_day: string | null;
      last_day: string | null;
      days: number;
      generated: number;
      limitless: number;
      chats: number;
    }),
    jobs,
  };
}

export async function limitlessPrompts() {
  const rows = await sql()`
    SELECT prompt, count(*)::int AS uses, max(created_at) AS last_used
    FROM chats WHERE is_scheduled AND prompt IS NOT NULL
    GROUP BY prompt ORDER BY uses DESC LIMIT 10`;
  return rows as unknown as { prompt: string; uses: number; last_used: string }[];
}

export async function daysMissingSummaries(from?: string, to?: string) {
  const rows = await sql()`
    SELECT l.day::text AS day, count(*)::int AS conversations
    FROM lifelogs l
    WHERE (${from ?? null}::date IS NULL OR l.day >= ${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR l.day <= ${to ?? null}::date)
      AND NOT EXISTS (SELECT 1 FROM daily_summaries s WHERE s.day = l.day AND s.source = 'generated' AND NOT s.is_partial)
    GROUP BY l.day ORDER BY l.day`;
  return rows as unknown as { day: string; conversations: number }[];
}
