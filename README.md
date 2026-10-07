# Limitless Daily

A Granola-style web app for your Limitless pendant. It keeps your full transcripts and Limitless's own daily summaries in your own database. Every night it writes **work and personal summaries with timestamps** using Claude, saves them to Obsidian, and sends you a Telegram recap at 9pm.

| Piece | What it does |
|---|---|
| **Web app** (`/`) | Day list → day view: summary on the left, transcript on the right. Click any `[10:42 AM]` to jump to that moment. |
| **Search** (`/search`) | Full-text search across every transcript and summary (`"exact phrase"`, `OR`, `-exclude`) |
| **Settings** (`/settings`) | Edit the summary and Telegram prompts, reuse the prompt Limitless used, run jobs by hand, see job history |
| **9pm job** (`/api/cron/nightly`) | Syncs today → summarizes the day so far → Obsidian → Telegram |
| **Finalize job** (`/api/cron/finalize`, ~6am ET) | Re-syncs yesterday in full, writes the final summary, imports new Limitless summaries |
| **Obsidian** | `Limitless/Daily/YYYY-MM-DD.md` (summary + tags) and `Limitless/Transcripts/YYYY-MM-DD transcript.md`. Timestamps link to the exact transcript line. |

## Setup (about 20 min)

1. **Keys**
   - Limitless: app → Settings → Developer → create API key
   - Anthropic: console.anthropic.com → API key
   - Telegram: message `@BotFather` → `/newbot` → token. Send your bot any message, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id`.
   - Obsidian: make your vault a private GitHub repo, install the **Obsidian Git** plugin (auto-pull on), and create a fine-grained token with *Contents: read/write* on that repo.
2. **Deploy to Vercel**: import this repo → Storage → add **Neon** Postgres (sets `DATABASE_URL`; use the pooled URL) → add the env vars from `.env.example` → Deploy.
3. **Create tables + import your history** (run on your machine):
   ```bash
   cp .env.example .env.local   # fill in the same values as Vercel
   npm install
   npm run db:migrate
   npm run probe                # sanity-check the Limitless API, raw output in exports/probe.json
   npm run backfill             # everything since day one (resumable)
   npm run summarize -- --missing           # dry run: shows day count + cost estimate
   npm run summarize -- --missing --yes     # generates them (and pushes to Obsidian)
   ```
4. Open the app, log in with `APP_PASSWORD`, and press **Run 9pm job now** in Settings to test Telegram.

Optional: `npm run export:obsidian -- --out ~/path/to/vault` writes every note straight into a local vault (no GitHub needed).

## Using Limitless's own prompt

`backfill` imports your **scheduled chats** (where Limitless's daily insights live). The prompt and output are saved, so:
- Each day's Limitless summary appears under the generated one (and in the Obsidian note)
- Settings → *Prompts found in your Limitless scheduled chats* → **Use this as my summary prompt**

## Notes

- Day boundaries and timestamps use `TIMEZONE` (default `America/New_York`).
- Vercel cron runs in UTC, so the 9pm job is scheduled at 01:00 and 02:00 UTC and only runs in the local 9pm hour. This keeps it correct across daylight saving.
- The 9pm summary is marked *day in progress*. The morning finalize job replaces it with the full-day version.
- The default model is `claude-opus-5-5` (`CLAUDE_MODEL` to change). A typical day costs a few cents to about $0.50 depending on how much you talk.
- Limitless was acquired by Meta and support for existing pendants is time-limited. Run the backfill early so you own a full copy.

## Dev

```bash
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run typecheck
```
