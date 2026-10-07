// Default prompts. Both are editable in the app (Settings) and stored in the DB,
// so you can swap in the exact prompt Limitless uses once the import finds it.

export const DEFAULT_SUMMARY_PROMPT = `You are writing my end-of-day "Daily Limitless Pendant Summary" from the full transcript of everything my Limitless pendant recorded on {{date}} ({{timezone}}).

Who I am: the transcript speaker marked "(me)" or "Me" is me. Everyone else is someone I talked to, or background audio (TV, podcasts, videos, other people's conversations). Ignore background media unless I engaged with it.

Your job: give me the salient points of my day, split into WORK and PERSONAL, so that I can search them later and jump back into the transcript. Be specific: names, numbers, companies, products, dates, amounts, decisions. Skip filler and small talk. Never invent anything that is not in the transcript; if something is ambiguous, say so briefly.

Classify each item as work (my companies, colleagues, investors, deals, hiring, product, meetings, business calls) or personal (family, friends, health, errands, hobbies, home, personal finance, entertainment). If it is genuinely mixed, put it in the section it matters most to.

Every bullet MUST start with the timestamp of when it happened, copied from the transcript, in the form **[h:mm AM]** — for example **[10:42 AM]**. Use the time the point was actually said, not the start of the conversation.

Output Markdown in exactly this structure (omit a subsection only if it would be empty, and write "Nothing notable." for an empty top-level section):

# Daily Limitless Pendant Summary — {{date}}

## TL;DR
3–5 bullets: the most important things that happened today, across work and personal.

## 💼 Work

### Key moments
Chronological bullets of meaningful conversations, meetings and topics. One line each, lead with who and what.

### Decisions
Bullets for decisions made or agreed, with who decided.

### Action items & follow-ups
Checkbox bullets: - [ ] **[h:mm AM]** what — owner — due date if mentioned. Include commitments I made to others and things others owe me.

### People & companies
Who I interacted with and the one-line gist of each.

### Ideas & insights
Notable ideas, opinions, numbers or insights worth remembering.

## 🧑 Personal

### Key moments
### Action items & follow-ups
### People
### Health, mood & energy
Only if there is evidence in the transcript (sleep, exercise, food, stress, how I sounded).

## 🔁 Open loops
Unresolved questions or threads to pick up tomorrow.

## 🏷️ Tags
One line of 5–15 lowercase #tags (people, companies, projects, topics) to make this day easy to find.`;

export const DEFAULT_TELEGRAM_PROMPT = `Condense the daily summary below into a short Telegram message recapping my day. Plain text only, no Markdown syntax except "•" bullets. Max ~1200 characters.

Structure:
💼 Work — the 3–6 most important items (timestamp first, e.g. "10:42 AM —")
🧑 Personal — the 1–4 most important items
✅ Follow-ups — up to 5 open action items with owners
Finish with one line on anything I should prepare for tomorrow, if any.`;

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}
