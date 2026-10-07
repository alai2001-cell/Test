import Link from "next/link";
import { redirect } from "next/navigation";
import { listDays } from "@/lib/data";
import { config } from "@/lib/env";
import { formatTime, prettyDay, todayIn } from "@/lib/time";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ go?: string }> }) {
  const { go } = await searchParams;
  if (go) redirect(`/day/${go}`);
  const tz = config.timezone;
  const days = await listDays();
  return (
    <main className="page">
      <div className="pagehead">
        <h1>Days</h1>
        <form className="inline">
          <input type="date" name="go" defaultValue={todayIn(tz)} />
          <button type="submit">Open</button>
        </form>
      </div>
      {!days.length && (
        <div className="card empty">
          No data yet. Run <code>npm run backfill</code> locally (see README) or open{" "}
          <Link href={`/day/${todayIn(tz)}`}>today</Link> and press “Sync”.
        </div>
      )}
      <ul className="daylist">
        {days.map((d) => (
          <li key={d.day}>
            <Link href={`/day/${d.day}`} className="card dayrow">
              <div className="dayrow-head">
                <strong>{prettyDay(d.day)}</strong>
                <span className="muted">
                  {d.conversations} conversations
                  {d.first_start && d.last_end && ` · ${formatTime(d.first_start, tz)}–${formatTime(d.last_end, tz)}`}
                </span>
                <span className="badges">
                  {d.has_generated && <span className="badge">summary</span>}
                  {d.has_limitless && <span className="badge alt">limitless</span>}
                </span>
              </div>
              {d.tldr && <div className="tldr" dangerouslySetInnerHTML={{ __html: renderMarkdown(d.tldr) }} />}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
