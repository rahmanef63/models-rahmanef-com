// Pure-translation tests for the /v1 tool passthrough (outbound half). Run: node --experimental-strip-types apiV1Tools.test.mjs
import { parseOpenAITools, parseAnthropicTools, toOpenAIToolCalls, toAnthropicToolUse } from "./convex/apiV1Tools.ts";

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

console.log("OK — /v1 tool passthrough translation invariants hold");
