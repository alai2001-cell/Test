export const SESSION_COOKIE = "ld_session";

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:limitless-daily`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish string compare. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
