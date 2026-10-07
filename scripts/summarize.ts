// Generate summaries for past days.
//   npm run summarize -- --day 2026-10-06
//   npm run summarize -- --from 2026-09-01 --to 2026-09-30
//   npm run summarize -- --missing           (all days without a generated summary)
// Add --yes to actually run; without it you only get the plan + cost estimate.
import "./_env";
import { closeDb } from "../lib/db";
import { sql } from "../lib/db";
import { daysMissingSummaries } from "../lib/data";
import { generateSummary } from "../lib/summarize";
import { obsidianGithubConfigured, publishToGithub } from "../lib/obsidian";
import { arg, flag } from "./_env";

let days: string[];
if (arg("day")) days = [arg("day")!];
else if (flag("missing") || arg("from")) days = (await daysMissingSummaries(arg("from"), arg("to"))).map((d) => d.day);
else {
  console.log("Usage: npm run summarize -- (--day YYYY-MM-DD | --missing | --from YYYY-MM-DD [--to YYYY-MM-DD]) [--yes]");
  process.exit(1);
}
if (flag("force") && arg("from")) {
  const rows = await sql()`SELECT DISTINCT day::text AS day FROM lifelogs WHERE day >= ${arg("from")!} AND day <= ${arg("to") ?? "9999-12-31"} ORDER BY day`;
  days = rows.map((r: any) => r.day);
}

const [{ chars }] = (await sql()`SELECT coalesce(sum(length(markdown)), 0)::bigint AS chars FROM lifelogs WHERE day = ANY(${days}::date[])`) as any[];
const inTok = Number(chars) / 3.5;
const outTok = days.length * 6000; // ~3k answer + thinking
const cost = (inTok / 1e6) * 4 + (outTok / 1e6) * 20; // claude-opus-5-5 list price
console.log(`${days.length} day(s) to summarise (${days[0] ?? "—"} → ${days.at(-1) ?? "—"})`);
console.log(`≈ ${(inTok / 1e6).toFixed(1)}M input tokens → estimated cost ≈ $${cost.toFixed(2)} on ${process.env.CLAUDE_MODEL ?? "claude-opus-5-5"}`);
if (!flag("yes")) {
  console.log("\nDry run. Re-run with --yes to generate.");
  process.exit(0);
}

const queue = [...days];
const concurrency = Number(arg("concurrency") ?? 3);
let done = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        const r = await generateSummary(d);
        if (!r.skipped && obsidianGithubConfigured() && !flag("no-obsidian")) await publishToGithub(d);
        console.log(`✓ ${d} (${++done}/${days.length})${r.skipped ? " skipped: " + r.reason : ""}`);
      } catch (e) {
        console.log(`✗ ${d}: ${(e as Error).message}`);
      }
    }
  }),
);

await closeDb();
