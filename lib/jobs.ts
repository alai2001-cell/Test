import { logJob } from "./db";
import { config } from "./env";
import { obsidianGithubConfigured, publishToGithub } from "./obsidian";
import { generateSummary, telegramRecap } from "./summarize";
import { syncChats, syncDay } from "./sync";
import { sendTelegram, telegramConfigured } from "./telegram";
import { addDays, hourIn, prettyDay, todayIn } from "./time";

/**
 * 9pm job: pull today's audio, summarise the day so far, push it to Obsidian,
 * and send the Telegram recap. Vercel cron runs in UTC, so it is scheduled at
 * both 01:00 and 02:00 UTC and only proceeds in the configured local hour
 * (covers daylight-saving changes).
 */
export async function runNightly(opts: { force?: boolean; day?: string } = {}) {
  const tz = config.timezone;
  if (!opts.force && hourIn(tz) !== config.telegramHour) {
    return { status: "skipped", reason: `local hour is ${hourIn(tz)}, waiting for ${config.telegramHour}` };
  }
  const day = opts.day ?? todayIn(tz);
  const steps: string[] = [];
  try {
    steps.push(`synced ${await syncDay(day)} conversations`);
    const s = await generateSummary(day, { partial: day === todayIn(tz) });
    steps.push(s.skipped ? `summary skipped: ${s.reason}` : "summary generated");
    if (!s.skipped && obsidianGithubConfigured()) steps.push(`obsidian: ${await publishToGithub(day)} files`);
    if (telegramConfigured()) {
      const recap = s.skipped ? `No pendant recordings found for ${prettyDay(day)}.` : await telegramRecap(day);
      const link = config.appUrl ? `\n\n${config.appUrl}/day/${day}` : "";
      await sendTelegram(`🎙️ Limitless — ${prettyDay(day)}\n\n${recap ?? "No summary."}${link}`);
      steps.push("telegram sent");
    }
    await logJob("nightly", day, "ok", steps.join("; "));
    return { status: "ok", day, steps };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logJob("nightly", day, "error", `${steps.join("; ")} | ${msg}`);
    if (telegramConfigured()) await sendTelegram(`⚠️ Limitless nightly job failed for ${day}: ${msg}`).catch(() => {});
    throw e;
  }
}

/** Early-morning job: re-sync yesterday in full and replace the partial 9pm summary with a final one. */
export async function runFinalize(opts: { day?: string } = {}) {
  const tz = config.timezone;
  const day = opts.day ?? addDays(todayIn(tz), -1);
  const steps: string[] = [];
  try {
    steps.push(`synced ${await syncDay(day)} conversations`);
    const chats = await syncChats({ maxPages: 2 });
    steps.push(`chats: ${chats.scheduled} scheduled, ${chats.other} other`);
    const s = await generateSummary(day, { partial: false });
    steps.push(s.skipped ? `summary skipped: ${s.reason}` : "final summary generated");
    if (obsidianGithubConfigured()) steps.push(`obsidian: ${await publishToGithub(day)} files`);
    await logJob("finalize", day, "ok", steps.join("; "));
    return { status: "ok", day, steps };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logJob("finalize", day, "error", `${steps.join("; ")} | ${msg}`);
    throw e;
  }
}
