import { limitlessPrompts, stats } from "@/lib/data";
import { config } from "@/lib/env";
import { summaryPrompt, telegramPrompt } from "@/lib/summarize";
import { DEFAULT_SUMMARY_PROMPT, DEFAULT_TELEGRAM_PROMPT } from "@/lib/prompts";
import { telegramConfigured } from "@/lib/telegram";
import { obsidianGithubConfigured } from "@/lib/obsidian";
import { runNightlyNowAction, savePromptAction, syncChatsAction } from "@/app/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function SettingsPage() {
  const [s, sp, tp, found] = await Promise.all([stats(), summaryPrompt(), telegramPrompt(), limitlessPrompts()]);
  return (
    <main className="page">
      <div className="pagehead">
        <h1>Settings</h1>
      </div>

      <section className="card">
        <h2>Status</h2>
        <table className="kv">
          <tbody>
            <tr><td>Transcripts</td><td>{s.lifelogs} conversations over {s.days} days ({s.first_day ?? "—"} → {s.last_day ?? "—"})</td></tr>
            <tr><td>Summaries</td><td>{s.generated} generated · {s.limitless} imported from Limitless</td></tr>
            <tr><td>Limitless chats</td><td>{s.chats}</td></tr>
            <tr><td>Timezone</td><td>{config.timezone} · Telegram at {config.telegramHour}:00</td></tr>
            <tr><td>Model</td><td>{config.model}</td></tr>
            <tr><td>Telegram</td><td>{telegramConfigured() ? "configured" : "not configured"}</td></tr>
            <tr><td>Obsidian (GitHub)</td><td>{obsidianGithubConfigured() ? "configured" : "not configured"}</td></tr>
          </tbody>
        </table>
        <div className="actions">
          <form action={syncChatsAction}><button className="secondary">Import Limitless summaries &amp; chats</button></form>
          <form action={runNightlyNowAction}><button className="secondary">Run 9pm job now</button></form>
        </div>
      </section>

      <section className="card">
        <h2>Daily summary prompt</h2>
        <p className="muted">Placeholders: <code>{"{{date}}"}</code>, <code>{"{{timezone}}"}</code>. Timestamps in the form <code>**[10:42 AM]**</code> become links into the transcript. Clear the box and save to restore the default.</p>
        <form action={savePromptAction} className="stack">
          <input type="hidden" name="key" value="summary_prompt" />
          <textarea name="value" defaultValue={sp === DEFAULT_SUMMARY_PROMPT ? DEFAULT_SUMMARY_PROMPT : sp} rows={22} />
          <button type="submit">Save prompt</button>
        </form>
      </section>

      <section className="card">
        <h2>Prompts found in your Limitless scheduled chats</h2>
        {!found.length ? (
          <p className="muted">None imported yet. Press “Import Limitless summaries &amp; chats”.</p>
        ) : (
          found.map((p, i) => (
            <details key={i}>
              <summary>Used {p.uses}× — {p.prompt.slice(0, 90)}…</summary>
              <pre className="prompt">{p.prompt}</pre>
              <form action={savePromptAction}>
                <input type="hidden" name="key" value="summary_prompt" />
                <input type="hidden" name="value" value={`${p.prompt}\n\nFormat: split into "## 💼 Work" and "## 🧑 Personal" sections, and start every bullet with its timestamp like **[10:42 AM]**.`} />
                <button type="submit" className="secondary">Use this as my summary prompt</button>
              </form>
            </details>
          ))
        )}
      </section>

      <section className="card">
        <h2>Telegram recap prompt</h2>
        <form action={savePromptAction} className="stack">
          <input type="hidden" name="key" value="telegram_prompt" />
          <textarea name="value" defaultValue={tp === DEFAULT_TELEGRAM_PROMPT ? DEFAULT_TELEGRAM_PROMPT : tp} rows={10} />
          <button type="submit">Save prompt</button>
        </form>
      </section>

      <section className="card">
        <h2>Recent jobs</h2>
        <table className="kv">
          <tbody>
            {s.jobs.map((j: any, i: number) => (
              <tr key={i}>
                <td>{new Date(j.ran_at).toLocaleString("en-US", { timeZone: config.timezone })}</td>
                <td>{j.job} {j.day} — <span className={j.status === "error" ? "error" : ""}>{j.status}</span> {j.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
