export function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim() !== "") return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var ${name} (see .env.example)`);
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  get timezone() {
    return env("TIMEZONE", "America/New_York");
  },
  get telegramHour() {
    return Number(env("TELEGRAM_HOUR", "21"));
  },
  get model() {
    return env("CLAUDE_MODEL", "claude-opus-5-5");
  },
  get appUrl() {
    return optionalEnv("APP_URL");
  },
};
