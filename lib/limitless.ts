import { env } from "./env";

const BASE = process.env.LIMITLESS_API_BASE ?? "https://api.limitless.ai/v1";

export interface ContentNode {
  type: string; // heading1 | heading2 | heading3 | blockquote | paragraph ...
  content: string;
  startTime?: string;
  endTime?: string;
  startOffsetMs?: number;
  endOffsetMs?: number;
  children?: ContentNode[];
  speakerName?: string | null;
  speakerIdentifier?: "user" | null;
}

export interface Lifelog {
  id: string;
  title?: string;
  markdown?: string | null;
  contents?: ContentNode[];
  startTime: string;
  endTime: string;
  isStarred?: boolean;
  updatedAt?: string;
}

export interface ChatMessage {
  id?: string;
  text: string;
  createdAt?: string;
  role: "user" | "assistant" | string;
}

export interface Chat {
  id: string;
  summary?: string;
  createdAt?: string;
  startedAt?: string;
  messages: ChatMessage[];
  raw: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// API limit is 180 req/min; stay comfortably under it.
let lastCall = 0;
async function throttle() {
  const wait = lastCall + 400 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

export async function limitlessGet(path: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    await throttle();
    const res = await fetch(url, { headers: { "X-API-Key": env("LIMITLESS_API_KEY") } });
    if (res.ok) return (await res.json()) as any;
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt * 2;
      await sleep(retryAfter * 1000);
      continue;
    }
    throw new Error(`Limitless ${path} → ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
}

export interface LifelogQuery {
  date?: string;
  start?: string;
  end?: string;
  timezone: string;
  direction?: "asc" | "desc";
}

/** Iterates every lifelog matching the query, following cursors. */
export async function* iterLifelogs(q: LifelogQuery): AsyncGenerator<Lifelog> {
  let cursor: string | undefined;
  do {
    const json = await limitlessGet("/lifelogs", {
      ...q,
      direction: q.direction ?? "asc",
      includeMarkdown: true,
      includeHeadings: true,
      includeContents: true,
      limit: 10,
      cursor,
    });
    const logs: Lifelog[] = json?.data?.lifelogs ?? [];
    for (const l of logs) yield l;
    cursor = json?.meta?.lifelogs?.nextCursor ?? undefined;
    if (!logs.length) cursor = undefined;
  } while (cursor);
}

function normaliseChat(c: any): Chat {
  const messages: ChatMessage[] = (c?.messages ?? []).map((m: any) => ({
    id: m?.id,
    text: String(m?.text ?? m?.content ?? ""),
    createdAt: m?.createdAt,
    role: String(m?.user?.role ?? m?.role ?? m?.sender ?? "unknown").toLowerCase(),
  }));
  return {
    id: String(c.id),
    summary: c.summary ?? c.title,
    createdAt: c.createdAt ?? c.startedAt,
    startedAt: c.startedAt,
    messages,
    raw: c,
  };
}

/**
 * Iterates Ask-AI chats. With `isScheduled: true` this returns the scheduled
 * chats, which is where Limitless's recurring "Daily Insights" summaries live.
 */
export async function* iterChats(opts: { isScheduled?: boolean; direction?: "asc" | "desc"; maxPages?: number } = {}) {
  let cursor: string | undefined;
  let pages = 0;
  do {
    const json = await limitlessGet("/chats", {
      isScheduled: opts.isScheduled,
      direction: opts.direction ?? "desc",
      limit: 10,
      cursor,
    });
    const chats: any[] = json?.data?.chats ?? json?.chats ?? [];
    for (const c of chats) yield normaliseChat(c);
    cursor = json?.meta?.chats?.nextCursor ?? undefined;
    if (!chats.length) cursor = undefined;
    pages++;
  } while (cursor && (!opts.maxPages || pages < opts.maxPages));
}
