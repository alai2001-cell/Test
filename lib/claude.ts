import Anthropic from "@anthropic-ai/sdk";
import { config } from "./env";

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface CompletionResult {
  text: string;
  model: string;
  stopReason: string | null;
}

/**
 * One streamed completion. Streaming keeps long day-transcripts from hitting
 * HTTP timeouts; server-side fallbacks re-run the request on another model if
 * a safety classifier declines (personal audio can trip false positives).
 */
export async function complete(opts: {
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<CompletionResult> {
  const stream = client().beta.messages.stream({
    model: config.model,
    max_tokens: opts.maxTokens ?? 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "medium" },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    const reason = msg.stop_details?.explanation ?? msg.stop_details?.category ?? "no detail";
    throw new Error(`Claude declined to summarise this content (${reason}).`);
  }
  const text = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error(`Empty response from Claude (stop_reason=${msg.stop_reason}).`);
  return { text, model: msg.model, stopReason: msg.stop_reason };
}
