import { complete } from "./claude";
import { getSetting, sql } from "./db";
import { config } from "./env";
import { getConversations, getSummaries } from "./data";
import { DEFAULT_SUMMARY_PROMPT, DEFAULT_TELEGRAM_PROMPT, fillTemplate } from "./prompts";
import { transcriptForModel } from "./transcript";
import { formatTime, prettyDay } from "./time";

export async function summaryPrompt() {
  return (await getSetting("summary_prompt")) ?? DEFAULT_SUMMARY_PROMPT;
}
export async function telegramPrompt() {
  return (await getSetting("telegram_prompt")) ?? DEFAULT_TELEGRAM_PROMPT;
}

/** Generates (or regenerates) the work + personal summary for one day from the stored transcript. */
export async function generateSummary(day: string, opts: { partial?: boolean } = {}) {
  const tz = config.timezone;
  const convs = await getConversations(day);
  if (!convs.length) return { skipped: true as const, reason: "no transcript for this day" };

  const transcript = transcriptForModel(convs, tz);
  const template = await summaryPrompt();
  const system = fillTemplate(template, { date: prettyDay(day), timezone: tz });
  const coverage = opts.partial
    ? `\n\nNote: the day is still in progress — this transcript runs until ${formatTime(convs[convs.length - 1].endTime, tz)}.`
    : "";
  const user = `Here is the full pendant transcript for ${prettyDay(day)}. Timestamps are local (${tz}).${coverage}\n\n<transcript>\n${transcript}\n</transcript>`;

  const res = await complete({ system, user, effort: "medium" });
  await sql()`
    INSERT INTO daily_summaries (day, source, content_md, is_partial, prompt_used, model, created_at)
    VALUES (${day}, 'generated', ${res.text}, ${!!opts.partial}, ${template}, ${res.model}, now())
    ON CONFLICT (day, source) DO UPDATE SET
      content_md = EXCLUDED.content_md, is_partial = EXCLUDED.is_partial,
      prompt_used = EXCLUDED.prompt_used, model = EXCLUDED.model, created_at = now()`;
  return { skipped: false as const, content: res.text, conversations: convs.length, chars: transcript.length };
}

/** Short Telegram-friendly recap built from the day's stored summary. */
export async function telegramRecap(day: string): Promise<string | null> {
  const summaries = await getSummaries(day);
  const s = summaries.find((x) => x.source === "generated") ?? summaries.find((x) => x.source === "limitless");
  if (!s) return null;
  const res = await complete({
    system: await telegramPrompt(),
    user: `<daily_summary date="${day}">\n${s.content_md}\n</daily_summary>`,
    effort: "low",
    maxTokens: 4000,
  });
  return res.text;
}
