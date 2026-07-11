// Pure-translation tests for the /v1 tool passthrough (outbound half). Run: node --experimental-strip-types apiV1Tools.test.mjs
import { parseOpenAITools, parseAnthropicTools, toOpenAIToolCalls, toAnthropicToolUse, toModelMessagesOpenAI, toModelMessagesAnthropic } from "./convex/apiV1Tools.ts";

const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };
const eq = (a, b, m) => A(JSON.stringify(a) === JSON.stringify(b), `${m} — got ${JSON.stringify(a)}`);

// --- OpenAI request parse ---
const oai = parseOpenAITools({
  tools: [{ type: "function", function: { name: "get_weather", description: "w", parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } } }],
  tool_choice: { type: "function", function: { name: "get_weather" } },
});
eq(oai.specs.length, 1, "openai: one spec");
eq(oai.specs[0].name, "get_weather", "openai: name");
eq(oai.specs[0].parameters.required, ["city"], "openai: schema preserved");
eq(oai.toolChoice, { type: "tool", toolName: "get_weather" }, "openai: named tool_choice → AI SDK");
eq(parseOpenAITools({ tool_choice: "required" }).toolChoice, "required", "openai: 'required' passthrough");
eq(parseOpenAITools({}).toolChoice, undefined, "openai: no tool_choice → undefined");
eq(parseOpenAITools({}).specs, [], "openai: no tools → []");

// --- Anthropic request parse ---
const ant = parseAnthropicTools({
  tools: [{ name: "search", description: "s", input_schema: { type: "object", properties: { q: { type: "string" } } } }],
  tool_choice: { type: "any" },
});
eq(ant.specs[0].name, "search", "anthropic: name");
eq(ant.specs[0].parameters.properties.q.type, "string", "anthropic: input_schema → parameters");
eq(ant.toolChoice, "required", "anthropic: 'any' → 'required'");
eq(parseAnthropicTools({ tool_choice: { type: "tool", name: "search" } }).toolChoice, { type: "tool", toolName: "search" }, "anthropic: named tool");
eq(parseAnthropicTools({ tool_choice: { type: "auto" } }).toolChoice, "auto", "anthropic: 'auto'");

// --- SDK tool-calls → wire ---
const calls = [{ toolCallId: "c1", toolName: "get_weather", input: { city: "NYC" } }];
eq(toOpenAIToolCalls(calls), [{ id: "c1", type: "function", function: { name: "get_weather", arguments: '{"city":"NYC"}' } }], "→ openai tool_calls (args is a JSON string)");
eq(toAnthropicToolUse(calls), [{ type: "tool_use", id: "c1", name: "get_weather", input: { city: "NYC" } }], "→ anthropic tool_use (input is an object)");

// legacy `args` field + missing id fallback
eq(toOpenAIToolCalls([{ toolName: "f", args: { a: 1 } }]), [{ id: "call_0", type: "function", function: { name: "f", arguments: '{"a":1}' } }], "→ openai: legacy args + id fallback");
eq(toAnthropicToolUse([]), [], "→ anthropic: empty");

// --- INBOUND: OpenAI history → ModelMessages ---
const oaiHist = toModelMessagesOpenAI([
  { role: "user", content: "weather in NYC?" },
  { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "get_weather", arguments: '{"city":"NYC"}' } }] },
  { role: "tool", tool_call_id: "c1", content: "72F sunny" },
]);
eq(oaiHist[0], { role: "user", content: "weather in NYC?" }, "oai inbound: plain user passthrough");
eq(oaiHist[1], { role: "assistant", content: [{ type: "tool-call", toolCallId: "c1", toolName: "get_weather", input: { city: "NYC" } }] }, "oai inbound: assistant tool_calls → tool-call parts (args parsed)");
eq(oaiHist[2], { role: "tool", content: [{ type: "tool-result", toolCallId: "c1", toolName: "get_weather", output: { type: "text", value: "72F sunny" } }] }, "oai inbound: tool msg → tool-result, name looked up by id");

// --- INBOUND: Anthropic history → ModelMessages ---
const antHist = toModelMessagesAnthropic([
  { role: "user", content: "weather?" },
  { role: "assistant", content: [{ type: "text", text: "checking" }, { type: "tool_use", id: "t1", name: "get_weather", input: { city: "NYC" } }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "72F" }, { type: "text", text: "thanks" }] },
]);
eq(antHist[0], { role: "user", content: "weather?" }, "ant inbound: string content passthrough");
eq(antHist[1], { role: "assistant", content: [{ type: "text", text: "checking" }, { type: "tool-call", toolCallId: "t1", toolName: "get_weather", input: { city: "NYC" } }] }, "ant inbound: tool_use → tool-call part");
// the tool_result user turn splits: a role:'tool' message (results) THEN a role:'user' message (text)
eq(antHist[2], { role: "tool", content: [{ type: "tool-result", toolCallId: "t1", toolName: "get_weather", output: { type: "text", value: "72F" } }] }, "ant inbound: tool_result → tool msg, name by id");
eq(antHist[3], { role: "user", content: [{ type: "text", text: "thanks" }] }, "ant inbound: trailing text stays a user msg");

console.log("OK — /v1 tool passthrough translation invariants hold");
