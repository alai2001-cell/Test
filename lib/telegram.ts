import { optionalEnv } from "./env";

export function telegramConfigured() {
  return !!(optionalEnv("TELEGRAM_BOT_TOKEN") && optionalEnv("TELEGRAM_CHAT_ID"));
}

/** Sends plain text, split into Telegram's 4096-char message limit. */
export async function sendTelegram(text: string) {
  const token = optionalEnv("TELEGRAM_BOT_TOKEN");
  const chatId = optionalEnv("TELEGRAM_CHAT_ID");
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set");
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 4000) {
    const cut = rest.lastIndexOf("\n", 4000) > 2000 ? rest.lastIndexOf("\n", 4000) : 4000;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  chunks.push(rest);
  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
