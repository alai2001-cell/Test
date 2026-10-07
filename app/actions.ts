"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSetting, sql } from "@/lib/db";
import { runNightly } from "@/lib/jobs";
import { generateSummary } from "@/lib/summarize";
import { syncChats, syncDay } from "@/lib/sync";
import { isDay } from "@/lib/time";
import { publishToGithub, obsidianGithubConfigured } from "@/lib/obsidian";

function day(formData: FormData) {
  const d = String(formData.get("day") ?? "");
  if (!isDay(d)) throw new Error("bad day");
  return d;
}

export async function regenerateAction(formData: FormData) {
  const d = day(formData);
  await syncDay(d);
  await generateSummary(d, { partial: formData.get("partial") === "1" });
  if (obsidianGithubConfigured()) await publishToGithub(d);
  revalidatePath(`/day/${d}`);
}

export async function syncDayAction(formData: FormData) {
  const d = day(formData);
  await syncDay(d);
  revalidatePath(`/day/${d}`);
}

export async function saveSummaryEditAction(formData: FormData) {
  const d = day(formData);
  const content = String(formData.get("content") ?? "");
  await sql()`UPDATE daily_summaries SET content_md = ${content} WHERE day = ${d} AND source = 'generated'`;
  if (obsidianGithubConfigured()) await publishToGithub(d);
  redirect(`/day/${d}`);
}

export async function savePromptAction(formData: FormData) {
  const key = String(formData.get("key"));
  if (key !== "summary_prompt" && key !== "telegram_prompt") throw new Error("bad key");
  const value = String(formData.get("value") ?? "").trim();
  if (value) await setSetting(key, value);
  else await sql()`DELETE FROM settings WHERE key = ${key}`; // blank = back to default
  revalidatePath("/settings");
}

export async function syncChatsAction() {
  await syncChats({ maxPages: 20 });
  revalidatePath("/settings");
}

export async function runNightlyNowAction() {
  await runNightly({ force: true });
  revalidatePath("/settings");
}
