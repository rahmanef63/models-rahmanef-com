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
