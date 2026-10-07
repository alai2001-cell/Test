// Writes Markdown notes straight into a local Obsidian vault folder:
//   npm run export:obsidian -- --out ~/Obsidian/MyVault [--from 2026-01-01] [--to 2026-10-01]
import "./_env";
import { closeDb } from "../lib/db";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { sql } from "../lib/db";
import { buildVaultFiles } from "../lib/obsidian";
import { arg } from "./_env";

const out = (arg("out") ?? "exports/vault").replace(/^~/, homedir());
const rows = await sql()`
  SELECT DISTINCT day::text AS day FROM (
    SELECT day FROM lifelogs UNION SELECT day FROM daily_summaries
  ) d
  WHERE day >= ${arg("from") ?? "1970-01-01"} AND day <= ${arg("to") ?? "9999-12-31"}
  ORDER BY day`;
let files = 0;
for (const { day } of rows as unknown as { day: string }[]) {
  for (const f of await buildVaultFiles(day)) {
    const p = join(out, f.path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.content);
    files++;
  }
}
console.log(`✓ wrote ${files} notes for ${rows.length} days into ${out}`);

await closeDb();
