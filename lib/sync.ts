import { sql } from "./db";
import { config } from "./env";
import { iterChats, iterLifelogs, type Chat, type Lifelog, type LifelogQuery } from "./limitless";
import { dayOf } from "./time";

async function upsertLifelog(l: Lifelog, tz: string) {
  await sql()`
    INSERT INTO lifelogs (id, day, title, start_time, end_time, markdown, contents, is_starred, updated_at, synced_at)
    VALUES (${l.id}, ${dayOf(l.startTime, tz)}, ${l.title ?? null}, ${l.startTime}, ${l.endTime},
            ${l.markdown ?? null}, ${sql().json((l.contents ?? []) as any)}, ${l.isStarred ?? false},
            ${l.updatedAt ?? null}, now())
    ON CONFLICT (id) DO UPDATE SET
      day = EXCLUDED.day, title = EXCLUDED.title, start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time, markdown = EXCLUDED.markdown, contents = EXCLUDED.contents,
      is_starred = EXCLUDED.is_starred, updated_at = EXCLUDED.updated_at, synced_at = now()`;
}

export async function syncLifelogs(q: Omit<LifelogQuery, "timezone">, onProgress?: (n: number, l: Lifelog) => void) {
  const tz = config.timezone;
  let n = 0;
  for await (const l of iterLifelogs({ ...q, timezone: tz })) {
    await upsertLifelog(l, tz);
    n++;
    onProgress?.(n, l);
  }
  return n;
}

export const syncDay = (day: string) => syncLifelogs({ date: day });

function chatPrompt(c: Chat) {
  return c.messages.find((m) => m.role === "user")?.text ?? null;
}
function chatAnswer(c: Chat) {
  const answers = c.messages.filter((m) => m.role === "assistant" || m.role === "ai");
  return answers.length ? answers[answers.length - 1].text : null;
}

async function upsertChat(c: Chat, scheduled: boolean, tz: string) {
  const day = c.createdAt ? dayOf(c.createdAt, tz) : null;
  const prompt = chatPrompt(c);
  const answer = chatAnswer(c);
  await sql()`
    INSERT INTO chats (id, day, summary, created_at, is_scheduled, prompt, answer, raw, synced_at)
    VALUES (${c.id}, ${day}, ${c.summary ?? null}, ${c.createdAt ?? null}, ${scheduled},
            ${prompt}, ${answer}, ${sql().json(c.raw as any)}, now())
    ON CONFLICT (id) DO UPDATE SET
      day = EXCLUDED.day, summary = EXCLUDED.summary, created_at = EXCLUDED.created_at,
      is_scheduled = chats.is_scheduled OR EXCLUDED.is_scheduled,
      prompt = EXCLUDED.prompt, answer = EXCLUDED.answer, raw = EXCLUDED.raw, synced_at = now()`;
  // Scheduled chats are Limitless's own recurring summaries ("Daily insights").
  // Keep the latest one per day as that day's Limitless summary.
  if (scheduled && day && answer) {
    await sql()`
      INSERT INTO daily_summaries (day, source, content_md, prompt_used, chat_id, created_at)
      VALUES (${day}, 'limitless', ${answer}, ${prompt}, ${c.id}, ${c.createdAt ?? null})
      ON CONFLICT (day, source) DO UPDATE SET
        content_md = EXCLUDED.content_md, prompt_used = EXCLUDED.prompt_used,
        chat_id = EXCLUDED.chat_id, created_at = EXCLUDED.created_at
      WHERE daily_summaries.created_at IS NULL OR daily_summaries.created_at <= EXCLUDED.created_at`;
  }
}

/** Imports Ask-AI chats. Scheduled ones first, so they're flagged even if the unfiltered list repeats them. */
export async function syncChats(opts: { maxPages?: number; onProgress?: (n: number) => void } = {}) {
  const tz = config.timezone;
  let scheduled = 0;
  let other = 0;
  for await (const c of iterChats({ isScheduled: true, maxPages: opts.maxPages })) {
    await upsertChat(c, true, tz);
    scheduled++;
    opts.onProgress?.(scheduled + other);
  }
  for await (const c of iterChats({ maxPages: opts.maxPages })) {
    await upsertChat(c, false, tz);
    other++;
    opts.onProgress?.(scheduled + other);
  }
  return { scheduled, other };
}
