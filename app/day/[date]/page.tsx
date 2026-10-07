import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversations, getSummaries, neighbourDays } from "@/lib/data";
import { config } from "@/lib/env";
import { renderMarkdown } from "@/lib/markdown";
import { anchorId, linkTimestamps } from "@/lib/transcript";
import { formatTime, isDay, prettyDay, todayIn } from "@/lib/time";
import { regenerateAction, saveSummaryEditAction, syncDayAction } from "@/app/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isDay(date)) notFound();
  const tz = config.timezone;
  const [convs, summaries, nav] = await Promise.all([getConversations(date), getSummaries(date), neighbourDays(date)]);
  const gen = summaries.find((s) => s.source === "generated");
  const lim = summaries.find((s) => s.source === "limitless");

  const anchors = new Set<number>();
  for (const c of convs) for (const l of c.lines) if (l.minute !== undefined && l.kind !== "heading") anchors.add(l.minute);
  const anchorList = [...anchors].sort((a, b) => a - b);
  const placed = new Set<number>();
  const isToday = date === todayIn(tz);

  return (
    <main className="page wide">
      <div className="pagehead">
        <div>
          <div className="navdays">
            {nav.prev ? <Link href={`/day/${nav.prev}`}>← {nav.prev}</Link> : <span />}
            {nav.next && <Link href={`/day/${nav.next}`}>{nav.next} →</Link>}
          </div>
          <h1>{prettyDay(date)}</h1>
          <p className="muted">
            {convs.length} conversations
            {gen && ` · summary by ${gen.model ?? "Claude"}${gen.is_partial ? " (day in progress)" : ""}`}
          </p>
        </div>
        <div className="actions">
          <form action={syncDayAction}>
            <input type="hidden" name="day" value={date} />
            <button type="submit" className="secondary">Sync</button>
          </form>
          <form action={regenerateAction}>
            <input type="hidden" name="day" value={date} />
            <input type="hidden" name="partial" value={isToday ? "1" : "0"} />
            <button type="submit">{gen ? "Regenerate summary" : "Generate summary"}</button>
          </form>
        </div>
      </div>

      <div className="split">
        <section className="col summary">
          {gen ? (
            <article className="card prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(linkTimestamps(gen.content_md, anchorList)) }} />
          ) : (
            <div className="card empty">No summary yet. Press “Generate summary” (takes about a minute).</div>
          )}
          {lim && (
            <details className="card">
              <summary>Limitless’s own daily summary</summary>
              <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(lim.content_md) }} />
            </details>
          )}
          {gen && (
            <details className="card">
              <summary>Edit summary</summary>
              <form action={saveSummaryEditAction} className="stack">
                <input type="hidden" name="day" value={date} />
                <textarea name="content" defaultValue={gen.content_md} rows={24} />
                <button type="submit">Save</button>
              </form>
            </details>
          )}
        </section>

        <section className="col transcript">
          <h2>Transcript</h2>
          {!convs.length && <div className="card empty">No recordings for this day yet.</div>}
          {convs.map((c) => (
            <details key={c.id} className="card conv" open>
              <summary>
                <span className="time">{formatTime(c.startTime, tz)}–{formatTime(c.endTime, tz)}</span> {c.title}
              </summary>
              {c.lines.map((l, i) => {
                let id: string | undefined;
                if (l.minute !== undefined && l.kind !== "heading" && !placed.has(l.minute)) {
                  placed.add(l.minute);
                  id = anchorId(l.minute);
                }
                if (l.kind === "heading") return l.text === c.title ? null : <h4 key={i}>{l.text}</h4>;
                return (
                  <p key={i} id={id} className={l.speaker?.endsWith("(me)") || l.speaker === "Me" ? "line me" : "line"}>
                    {l.clock && <span className="time">{l.clock}</span>}
                    {l.speaker && <strong>{l.speaker}: </strong>}
                    {l.text}
                  </p>
                );
              })}
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
