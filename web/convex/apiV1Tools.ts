// Tool passthrough for the /v1 gateway: translate client tool declarations (OpenAI + Anthropic
// request shapes) into a neutral ToolSpec, and translate the AI SDK's returned tool-calls back into
// each wire format. PURE — no 'ai'/Convex imports — so it strip-types-tests standalone. The SDK-tool
// wrapping (tool()+jsonSchema()) and the model call live in apiV1.ts; this file only reshapes JSON.
//
// OUTBOUND ONLY (increment 1): the model can EMIT tool-calls to the client. Feeding client tool
// RESULTS back through callForUser (inbound) is increment 2 — it needs the shared message pipeline
// to carry tool-call/tool-result parts, which also touches the codex/claude OAuth sub-paths.

export type ToolSpec = { name: string; description?: string; parameters: Record<string, any> };
// AI SDK ≥v5 tool-call item: { toolCallId, toolName, input }. Older shapes used `args` — accept both.
type SdkToolCall = { toolCallId?: string; toolName?: string; input?: unknown; args?: unknown; id?: string; name?: string };

const EMPTY_SCHEMA = { type: "object", properties: {} };
const callArgs = (c: SdkToolCall) => (c.input ?? c.args ?? {});
const callId = (c: SdkToolCall, i: number) => String(c.toolCallId ?? c.id ?? `call_${i}`);
const callName = (c: SdkToolCall) => String(c.toolName ?? c.name ?? "");

// OpenAI request: tools:[{type:'function',function:{name,description,parameters}}], tool_choice:
// 'auto'|'none'|'required'|{type:'function',function:{name}}
export function parseOpenAITools(body: any): { specs: ToolSpec[]; toolChoice?: any } {
  const raw = Array.isArray(body?.tools) ? body.tools : [];
  const specs: ToolSpec[] = [];
  for (const t of raw) {
    const fn = t?.function ?? t;
    if (!fn?.name) continue;
    specs.push({ name: String(fn.name), description: fn.description ? String(fn.description) : undefined, parameters: fn.parameters ?? EMPTY_SCHEMA });
  }
  return { specs, toolChoice: normalizeOpenAIChoice(body?.tool_choice) };
}

function normalizeOpenAIChoice(tc: any): any {
  if (tc == null) return undefined;
  if (tc === "auto" || tc === "none" || tc === "required") return tc;
  const name = tc?.function?.name ?? tc?.name;
  if (tc?.type === "function" && name) return { type: "tool", toolName: String(name) };
  return undefined;
}

// Anthropic request: tools:[{name,description,input_schema}], tool_choice:{type:'auto'|'any'|'tool'|'none',name}
export function parseAnthropicTools(body: any): { specs: ToolSpec[]; toolChoice?: any } {
  const raw = Array.isArray(body?.tools) ? body.tools : [];
  const specs: ToolSpec[] = [];
  for (const t of raw) {
    if (!t?.name) continue;
    specs.push({ name: String(t.name), description: t.description ? String(t.description) : undefined, parameters: t.input_schema ?? EMPTY_SCHEMA });
  }
  return { specs, toolChoice: normalizeAnthropicChoice(body?.tool_choice) };
}

function normalizeAnthropicChoice(tc: any): any {
  if (tc == null) return undefined;
  if (tc.type === "auto") return "auto";
  if (tc.type === "any") return "required";
  if (tc.type === "none") return "none";
  if (tc.type === "tool" && tc.name) return { type: "tool", toolName: String(tc.name) };
  return undefined;
}

// SDK tool-calls → OpenAI message.tool_calls (arguments is a JSON *string*, per the OpenAI schema).
export function toOpenAIToolCalls(calls: SdkToolCall[]): any[] {
  return (calls ?? []).map((c, i) => ({ id: callId(c, i), type: "function", function: { name: callName(c), arguments: JSON.stringify(callArgs(c)) } }));
}

// SDK tool-calls → Anthropic content tool_use blocks (input is a JSON *object*).
export function toAnthropicToolUse(calls: SdkToolCall[]): any[] {
  return (calls ?? []).map((c, i) => ({ type: "tool_use", id: callId(c, i), name: callName(c), input: callArgs(c) }));
}

// ── INBOUND: client conversation history → AI-SDK ModelMessage[] ──────────────
// So a multi-turn tool loop completes: the client sends back the assistant's prior tool-calls plus
// the tool RESULTS it computed, and the model can continue. AI-SDK wants tool-calls as assistant
// parts and tool-results in a role:'tool' message; both wire formats identify a result only by the
// call id, so we first index id→toolName from the tool-calls (a result part requires the name).
const asText = (c: any): string => (typeof c === "string" ? c : c == null ? "" : JSON.stringify(c));
const parseArgs = (s: any): any => { if (s == null) return {}; if (typeof s !== "string") return s; try { return JSON.parse(s); } catch { return {}; } };

// VISION IN: widen an OpenAI content array (text + image_url/input_image parts) into AI-SDK content
// parts, so a client POSTing images to /v1 keeps them (same {type:'image',image:url} shape threads.ts
// builds). A data: URL or https URL both work as `image`.
function openAIParts(content: any[]): any[] {
  return content.map((p: any) => {
    if (p?.type === "image_url") return { type: "image", image: typeof p.image_url === "string" ? p.image_url : p.image_url?.url };
    if (p?.type === "input_image") return { type: "image", image: p.image_url?.url ?? p.image_url ?? p.image };
    return { type: "text", text: String(p?.text ?? (p?.type === "input_text" ? p?.text : "") ?? "") };
  });
}
// Anthropic image block → AI-SDK image part (source is {type:'url',url} or {type:'base64',media_type,data}).
function anthPart(b: any): any {
  if (b?.type === "image") {
    const s = b.source ?? {};
    if (s.type === "url" && s.url) return { type: "image", image: s.url };
    if (s.data) return { type: "image", image: `data:${s.media_type || "image/png"};base64,${s.data}` };
  }
  return { type: "text", text: String(b?.text ?? "") };
}

// OpenAI: assistant.tool_calls[{id,function:{name,arguments}}] + {role:'tool',tool_call_id,content}
export function toModelMessagesOpenAI(messages: any[]): any[] {
  const nameById = new Map<string, string>();
  for (const m of messages ?? []) for (const tc of m?.tool_calls ?? []) if (tc?.id && tc?.function?.name) nameById.set(String(tc.id), String(tc.function.name));
  const out: any[] = [];
  for (const m of messages ?? []) {
    const role = String(m?.role ?? "user");
    if (role === "tool") {
      const id = String(m?.tool_call_id ?? "");
      out.push({ role: "tool", content: [{ type: "tool-result", toolCallId: id, toolName: nameById.get(id) ?? "tool", output: { type: "text", value: asText(m?.content) } }] });
    } else if (role === "assistant" && Array.isArray(m?.tool_calls) && m.tool_calls.length) {
      const parts: any[] = [];
      if (m.content) parts.push({ type: "text", text: asText(m.content) });
      for (const tc of m.tool_calls) parts.push({ type: "tool-call", toolCallId: String(tc?.id ?? ""), toolName: String(tc?.function?.name ?? ""), input: parseArgs(tc?.function?.arguments) });
      out.push({ role: "assistant", content: parts });
    } else if (Array.isArray(m?.content)) {
      out.push({ role, content: openAIParts(m.content) }); // vision: keep image_url parts
    } else {
      out.push({ role, content: asText(m?.content) });
    }
  }
  return out;
}

// Anthropic: content blocks — assistant {type:'tool_use',id,name,input}; user {type:'tool_result',
// tool_use_id,content}. A user turn's tool_result blocks split out into a leading role:'tool' message.
export function toModelMessagesAnthropic(messages: any[]): any[] {
  const nameById = new Map<string, string>();
  for (const m of messages ?? []) if (Array.isArray(m?.content)) for (const b of m.content) if (b?.type === "tool_use" && b?.id && b?.name) nameById.set(String(b.id), String(b.name));
  const out: any[] = [];
  for (const m of messages ?? []) {
    const role = String(m?.role ?? "user");
    const content = m?.content;
    if (typeof content === "string" || !Array.isArray(content)) { out.push({ role, content: asText(content) }); continue; }
    if (role === "assistant") {
      out.push({ role: "assistant", content: content.map((b: any) => (b?.type === "tool_use" ? { type: "tool-call", toolCallId: String(b.id), toolName: String(b.name), input: b.input ?? {} } : { type: "text", text: String(b?.text ?? "") })) });
    } else {
      const results = content.filter((b: any) => b?.type === "tool_result");
      const texts = content.filter((b: any) => b?.type !== "tool_result");
      if (results.length) out.push({ role: "tool", content: results.map((b: any) => ({ type: "tool-result", toolCallId: String(b.tool_use_id), toolName: nameById.get(String(b.tool_use_id)) ?? "tool", output: { type: "text", value: anthResultText(b.content) } })) });
      if (texts.length) out.push({ role: "user", content: texts.map(anthPart) }); // vision: keep image blocks
    }
  }
  return out;
}

// an Anthropic tool_result's content is a string OR an array of {type:'text',text} blocks.
function anthResultText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b) => (b?.type === "text" ? b.text : typeof b === "string" ? b : asText(b))).join("");
  return asText(content);
}
