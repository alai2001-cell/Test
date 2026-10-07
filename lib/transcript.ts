import type { ContentNode } from "./limitless";
import { formatTime, minuteOfDay, parseClock } from "./time";

export interface TranscriptLine {
  kind: "heading" | "speech" | "text";
  text: string;
  speaker?: string;
  time?: string; // ISO
  minute?: number; // minutes since local midnight
  clock?: string; // "10:42 AM"
}

export interface Conversation {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  lines: TranscriptLine[];
}

function speakerLabel(n: ContentNode): string {
  if (n.speakerIdentifier === "user") return n.speakerName ? `${n.speakerName} (me)` : "Me";
  return n.speakerName || "Unknown";
}

export function flattenContents(nodes: ContentNode[] | undefined, tz: string, fallbackTime?: string): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  const walk = (list: ContentNode[], inherited?: string) => {
    for (const n of list) {
      const t = n.startTime ?? inherited;
      const base = t ? { time: t, minute: minuteOfDay(t, tz), clock: formatTime(t, tz) } : {};
      const text = (n.content ?? "").trim();
      if (text) {
        if (n.type.startsWith("heading")) out.push({ kind: "heading", text, ...base });
        else if (n.type === "blockquote") out.push({ kind: "speech", text, speaker: speakerLabel(n), ...base });
        else out.push({ kind: "text", text, ...base });
      }
      if (n.children?.length) walk(n.children, t);
    }
  };
  walk(nodes ?? [], fallbackTime);
  return out;
}

export function conversationFromRow(row: {
  id: string;
  title: string | null;
  start_time: string | Date;
  end_time: string | Date;
  markdown: string | null;
  contents: ContentNode[] | string | null;
}, tz: string): Conversation {
  const start = new Date(row.start_time).toISOString();
  const contents = typeof row.contents === "string" ? (JSON.parse(row.contents) as ContentNode[]) : row.contents;
  let lines = flattenContents(Array.isArray(contents) ? contents : [], tz, start);
  if (!lines.length && row.markdown) {
    lines = row.markdown.split("\n").filter(Boolean).map((text) => ({
      kind: "text" as const,
      text,
      time: start,
      minute: minuteOfDay(start, tz),
      clock: formatTime(start, tz),
    }));
  }
  return {
    id: row.id,
    title: row.title || "Untitled",
    startTime: start,
    endTime: new Date(row.end_time).toISOString(),
    lines,
  };
}

/** Plain-text transcript for the model: one line per utterance, timestamped. */
export function transcriptForModel(convs: Conversation[], tz: string): string {
  const parts: string[] = [];
  for (const c of convs) {
    parts.push(`\n=== ${formatTime(c.startTime, tz)}–${formatTime(c.endTime, tz)} · ${c.title} ===`);
    let lastClock = "";
    for (const l of c.lines) {
      if (l.kind === "heading") continue; // Limitless-generated headings, not speech
      const stamp = l.clock && l.clock !== lastClock ? `[${l.clock}] ` : "";
      if (l.clock) lastClock = l.clock;
      parts.push(l.kind === "speech" ? `${stamp}${l.speaker}: ${l.text}` : `${stamp}${l.text}`);
    }
  }
  return parts.join("\n").trim();
}

/** Picks the latest anchor minute <= target (or the first anchor if target is earlier than all). */
export function nearestAnchor(anchors: number[], target: number): number | null {
  if (!anchors.length) return null;
  let best = anchors[0];
  for (const a of anchors) {
    if (a <= target) best = a;
    else break;
  }
  return best;
}

export function anchorId(minute: number): string {
  return `t-${String(Math.floor(minute / 60)).padStart(2, "0")}${String(minute % 60).padStart(2, "0")}`;
}

/** Rewrites "[10:42 AM]" timestamps in summary markdown into links to the transcript. */
export function linkTimestamps(md: string, anchors: number[], hrefPrefix = ""): string {
  const sorted = [...anchors].sort((a, b) => a - b);
  return md.replace(/\[(\d{1,2}:\d{2}\s*[AaPp]\.?[Mm]\.?)\](?!\()/g, (whole, clock: string) => {
    const minute = parseClock(clock);
    if (minute === null) return whole;
    const a = nearestAnchor(sorted, minute);
    if (a === null) return whole;
    return `[${clock}](${hrefPrefix}#${anchorId(a)})`;
  });
}
