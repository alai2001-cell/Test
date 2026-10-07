import { optionalEnv, config } from "./env";
import { getConversations, getSummaries } from "./data";
import { anchorId, nearestAnchor, type Conversation } from "./transcript";
import { formatTime, parseClock, prettyDay } from "./time";

export interface VaultFile {
  path: string;
  content: string;
}

const folder = () => optionalEnv("OBSIDIAN_FOLDER") ?? "Limitless";

function transcriptNote(day: string) {
  return `${folder()}/Transcripts/${day} transcript`;
}

function anchorsOf(convs: Conversation[]): number[] {
  const set = new Set<number>();
  for (const c of convs) for (const l of c.lines) if (l.minute !== undefined && l.kind !== "heading") set.add(l.minute);
  return [...set].sort((a, b) => a - b);
}

/** "[10:42 AM]" → Obsidian block link into the transcript note. */
function wikiLinkTimestamps(md: string, anchors: number[], note: string) {
  return md.replace(/\[(\d{1,2}:\d{2}\s*[AaPp]\.?[Mm]\.?)\](?!\()/g, (whole, clock: string) => {
    const m = parseClock(clock);
    const a = m === null ? null : nearestAnchor(anchors, m);
    return a === null ? whole : `[[${note}#^${anchorId(a)}|${clock}]]`;
  });
}

function yamlList(items: string[]) {
  return `[${items.map((t) => JSON.stringify(t)).join(", ")}]`;
}

export async function buildVaultFiles(day: string): Promise<VaultFile[]> {
  const tz = config.timezone;
  const convs = await getConversations(day);
  const summaries = await getSummaries(day);
  const gen = summaries.find((s) => s.source === "generated");
  const lim = summaries.find((s) => s.source === "limitless");
  const anchors = anchorsOf(convs);
  const note = transcriptNote(day);
  const files: VaultFile[] = [];

  if (gen || lim) {
    const tagLine = (gen?.content_md ?? "").split(/^##[^\n]*Tags[^\n]*$/m)[1] ?? "";
    const tags = [...new Set((tagLine.match(/(?<=^|\s)#[a-z0-9][\w-]*/g) ?? []).map((t) => t.slice(1)))];
    const body = [
      "---",
      `title: "Daily Limitless Pendant Summary — ${day}"`,
      `date: ${day}`,
      `type: limitless-daily-summary`,
      `conversations: ${convs.length}`,
      `partial: ${gen?.is_partial ?? false}`,
      `tags: ${yamlList(["limitless", "daily-summary", ...tags])}`,
      `transcript: "[[${note}]]"`,
      "---",
      "",
      gen ? wikiLinkTimestamps(gen.content_md, anchors, note) : `# Daily Limitless Pendant Summary — ${day}`,
      "",
      lim ? `\n---\n\n## Limitless's own daily summary\n\n${lim.content_md}\n` : "",
      `\n[[${note}|Full transcript →]]\n`,
    ].join("\n");
    files.push({ path: `${folder()}/Daily/${day}.md`, content: body });
  }

  if (convs.length) {
    const out: string[] = [
      "---",
      `date: ${day}`,
      `type: limitless-transcript`,
      `tags: [limitless, transcript]`,
      "---",
      "",
      `# Limitless transcript — ${prettyDay(day)}`,
      "",
    ];
    const used = new Set<number>();
    for (const c of convs) {
      out.push(`## ${formatTime(c.startTime, tz)}–${formatTime(c.endTime, tz)} · ${c.title}`, "");
      for (const l of c.lines) {
        if (l.kind === "heading") continue;
        let line = l.kind === "speech" ? `**${l.speaker}** (${l.clock}): ${l.text}` : l.text;
        if (l.minute !== undefined && !used.has(l.minute)) {
          used.add(l.minute);
          line += ` ^${anchorId(l.minute)}`;
        }
        out.push(line, "");
      }
    }
    files.push({ path: `${note}.md`, content: out.join("\n") });
  }
  return files;
}

export function obsidianGithubConfigured() {
  return !!(optionalEnv("OBSIDIAN_GITHUB_REPO") && optionalEnv("OBSIDIAN_GITHUB_TOKEN"));
}

/** Commits the day's notes to the vault repo (pulled into Obsidian by the Obsidian Git plugin). */
export async function publishToGithub(day: string) {
  const repo = optionalEnv("OBSIDIAN_GITHUB_REPO");
  const token = optionalEnv("OBSIDIAN_GITHUB_TOKEN");
  const branch = optionalEnv("OBSIDIAN_GITHUB_BRANCH") ?? "main";
  if (!repo || !token) throw new Error("OBSIDIAN_GITHUB_REPO / OBSIDIAN_GITHUB_TOKEN not set");
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  const files = await buildVaultFiles(day);
  for (const f of files) {
    const url = `https://api.github.com/repos/${repo}/contents/${f.path.split("/").map(encodeURIComponent).join("/")}`;
    const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
    let sha: string | undefined;
    if (existing.ok) {
      const j = (await existing.json()) as { sha: string; content?: string };
      if (j.content && Buffer.from(j.content, "base64").toString("utf8") === f.content) continue;
      sha = j.sha;
    }
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Limitless ${day}: ${f.path.split("/").pop()}`,
        content: Buffer.from(f.content, "utf8").toString("base64"),
        branch,
        sha,
      }),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} writing ${f.path}: ${(await res.text()).slice(0, 300)}`);
  }
  return files.length;
}
