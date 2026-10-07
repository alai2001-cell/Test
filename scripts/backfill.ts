// One-time (resumable) import of your entire Limitless history:
//   npm run backfill                  # everything
//   npm run backfill -- --from 2025-06-01
import "./_env";
import { getSetting, migrate, setSetting } from "../lib/db";
import { daysMissingSummaries, stats } from "../lib/data";
import { syncChats, syncLifelogs } from "../lib/sync";
import { arg, flag } from "./_env";
import { closeDb } from "../lib/db";
import { config } from "../lib/env";
import { localDateTime } from "../lib/time";

await migrate();
const resume = flag("restart") ? null : await getSetting("backfill_last_start");
const from = arg("from") ?? resume ?? "2023-01-01";
console.log(`Importing lifelogs from ${from} (resumable — re-run to continue)…`);

const t0 = Date.now();
const n = await syncLifelogs({ start: from.length === 10 ? `${from} 00:00:00` : from, direction: "asc" }, async (i, l) => {
  if (i % 25 === 0) {
    process.stdout.write(`\r  ${i} conversations… (at ${l.startTime.slice(0, 10)})`);
    await setSetting("backfill_last_start", localDateTime(l.startTime, config.timezone));
  }
});
console.log(`\r✓ ${n} conversations imported in ${Math.round((Date.now() - t0) / 1000)}s`);

if (!flag("skip-chats")) {
  console.log("Importing Limitless chats and scheduled daily summaries…");
  const c = await syncChats({ onProgress: (i) => process.stdout.write(`\r  ${i} chats…`) });
  console.log(`\r✓ ${c.scheduled} scheduled (daily summary) chats, ${c.other} other chats`);
}

const s = await stats();
const missing = await daysMissingSummaries();
console.log(`
Summary
  Days with transcripts:        ${s.days} (${s.first_day} → ${s.last_day})
  Limitless summaries imported: ${s.limitless}
  Days without a generated summary: ${missing.length}

Next step: generate summaries for the missing days
  npm run summarize -- --missing          (shows a cost estimate first)
`);

await closeDb();
