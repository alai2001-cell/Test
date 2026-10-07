import Link from "next/link";
import { HL_END, HL_START, search } from "@/lib/data";
import { config } from "@/lib/env";
import { escapeHtml } from "@/lib/markdown";
import { formatTime, prettyDay } from "@/lib/time";

export const dynamic = "force-dynamic";

function highlight(snippet: string) {
  return escapeHtml(snippet).split(HL_START).join("<mark>").split(HL_END).join("</mark>");
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const hits = q.trim() ? await search(q.trim()) : [];
  const tz = config.timezone;
  return (
    <main className="page">
      <div className="pagehead">
        <h1>Search</h1>
      </div>
      <form className="inline big">
        <input name="q" type="search" defaultValue={q} placeholder={`e.g. "term sheet" OR hiring -recruiter`} autoFocus />
        <button type="submit">Search</button>
      </form>
      {q && <p className="muted">{hits.length} results</p>}
      <ul className="hits">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.id}-${h.day}`} className="card">
            <Link href={`/day/${h.day}`}>
              <span className={`badge ${h.kind === "summary" ? "" : "alt"}`}>{h.kind}</span>{" "}
              <strong>{prettyDay(h.day)}</strong>
              {h.start_time && <span className="muted"> · {formatTime(h.start_time, tz)}</span>} · {h.title}
            </Link>
            <p className="snippet" dangerouslySetInnerHTML={{ __html: highlight(h.snippet) }} />
          </li>
        ))}
      </ul>
    </main>
  );
}
