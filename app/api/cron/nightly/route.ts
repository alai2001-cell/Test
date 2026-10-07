import { cronAuthorized } from "@/lib/cron";
import { runNightly } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  try {
    const result = await runNightly({ force: url.searchParams.has("force"), day: url.searchParams.get("day") ?? undefined });
    return Response.json(result);
  } catch (e) {
    return Response.json({ status: "error", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
