// /v1 OpenAI-compatible gateway (thin proxy → api.apiV1.handle, same shape as /mcp). Auth is the
// sk-rr-… API key (Authorization: Bearer OR x-api-key); the Convex action validates + scopes it.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { clientIp } from "@/lib/origin";

export const runtime = "nodejs";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";

function extractKey(req: Request): string | undefined {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : (req.headers.get("x-api-key") || undefined);
}
const errJson = (status: number, code: string, message: string) =>
  Response.json({ error: { message, type: code, code } }, { status, headers: { "Cache-Control": "no-store" } });

async function call(req: Request, method: string, params: { path?: string[] }): Promise<Response> {
  const key = extractKey(req);
  let body: unknown = undefined;
  if (method === "POST") {
    try { body = await req.json(); } catch { return errJson(400, "invalid_request", "Request body must be JSON."); }
  }
  const path = "v1/" + (params.path ?? []).join("/");
  const client = new ConvexHttpClient(CONVEX_URL);
  const r: any = await client.action(api.apiV1.handle, { method, path, key, ip: clientIp(req), body });

  if (r.kind === "error") return errJson(r.status, r.code, r.message);
  if (r.kind === "models") return Response.json({ object: "list", data: r.data });

  if (r.kind === "anthropic") {
    const id = "msg_" + Math.random().toString(36).slice(2, 14);
    const body = { id, type: "message", role: "assistant", model: r.model, content: [{ type: "text", text: r.text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: r.promptTokens, output_tokens: r.completionTokens } };
    if (!r.stream) return Response.json(body);
    const enc = new TextEncoder();
    const ev = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(ev("message_start", { type: "message_start", message: { ...body, content: [], stop_reason: null, usage: { input_tokens: r.promptTokens, output_tokens: 0 } } }));
        c.enqueue(ev("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }));
        c.enqueue(ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: r.text } }));
        c.enqueue(ev("content_block_stop", { type: "content_block_stop", index: 0 }));
        c.enqueue(ev("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: r.completionTokens } }));
        c.enqueue(ev("message_stop", { type: "message_stop" }));
        c.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
  }

  // chat completion (OpenAI)
  const id = "chatcmpl-" + Math.random().toString(36).slice(2, 14);
  const created = Math.floor(Date.now() / 1000);
  if (r.stream) {
    const enc = new TextEncoder();
    const chunk = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
    const base = { id, object: "chat.completion.chunk", created, model: r.model };
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(chunk({ ...base, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] }));
        c.enqueue(chunk({ ...base, choices: [{ index: 0, delta: { content: r.text }, finish_reason: null }] }));
        c.enqueue(chunk({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
  }
  return Response.json({
    id, object: "chat.completion", created, model: r.model,
    choices: [{ index: 0, message: { role: "assistant", content: r.text }, finish_reason: "stop" }],
    usage: { prompt_tokens: r.promptTokens, completion_tokens: r.completionTokens, total_tokens: r.promptTokens + r.completionTokens },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return call(req, "POST", await ctx.params); }
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) { return call(req, "GET", await ctx.params); }
