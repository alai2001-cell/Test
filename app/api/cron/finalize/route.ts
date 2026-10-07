import { cronAuthorized } from "@/lib/cron";
import { runFinalize } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const day = new URL(req.url).searchParams.get("day") ?? undefined;
  try {
    return Response.json(await runFinalize({ day }));
  } catch (e) {
    return Response.json({ status: "error", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
