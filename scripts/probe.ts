// Calls each Limitless endpoint once and prints the response shape, so you can
// confirm the API (and where the daily summaries live) before a full backfill.
import "./_env";
import { closeDb } from "../lib/db";
import { mkdirSync, writeFileSync } from "node:fs";
import { limitlessGet } from "../lib/limitless";
import { config } from "../lib/env";
import { addDays, todayIn } from "../lib/time";

const tz = config.timezone;
const day = addDays(todayIn(tz), -1);
const out: Record<string, unknown> = {};

function shape(v: any, depth = 0): any {
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `…${v.length} items`] : [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, depth > 4 ? typeof x : shape(x, depth + 1)]));
  return typeof v === "string" ? (v.length > 80 ? v.slice(0, 80) + "…" : v) : v;
}

for (const [name, path, params] of [
  ["lifelogs (yesterday)", "/lifelogs", { date: day, timezone: tz, limit: 2, includeContents: true }],
  ["scheduled chats", "/chats", { isScheduled: true, limit: 3 }],
  ["all chats", "/chats", { limit: 3 }],
] as const) {
  try {
    const json = await limitlessGet(path, params as any);
    out[name] = json;
    console.log(`\n=== ${name} ===\n${JSON.stringify(shape(json), null, 2)}`);
  } catch (e) {
    console.log(`\n=== ${name} === FAILED: ${(e as Error).message}`);
  }
}
mkdirSync("exports", { recursive: true });
writeFileSync("exports/probe.json", JSON.stringify(out, null, 2));
console.log("\nFull raw responses saved to exports/probe.json");

await closeDb();
