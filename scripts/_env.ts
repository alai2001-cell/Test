import { config as dotenv } from "dotenv";

dotenv({ path: ".env.local", quiet: true });
dotenv({ path: ".env", quiet: true });

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}
export const flag = (name: string) => process.argv.includes(`--${name}`);
