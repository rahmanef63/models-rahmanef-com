// Pure-parse tests for the custom-provider JSON config. Run: node --experimental-strip-types web/customProviderConfig.test.mjs
import { parseCustomProviderConfig, parseModelList } from "./frontend/slices/byok/components/custom-provider-config.ts";

const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };
const eq = (a, b, m) => A(JSON.stringify(a) === JSON.stringify(b), `${m} — got ${JSON.stringify(a)}`);

// field aliases: slug/base_url/api_key + models as an array
let c = parseCustomProviderConfig(JSON.stringify({ slug: "ai-hub", base_url: "https://h/v1", api_key: "sk-x", models: ["minimax-m3", "gemini-3.5"] }));
eq([c.name, c.baseURL, c.apiKey], ["ai-hub", "https://h/v1", "sk-x"], "aliases (slug/base_url/api_key) map through");
eq(c.models, ["minimax-m3", "gemini-3.5"], "array models preserved");

// canonical fields + models as a delimited string
c = parseCustomProviderConfig(JSON.stringify({ name: "x", baseURL: "https://h", apiKey: "k", protocol: "anthropic", models: "a, b\nc" }));
eq(c.models, ["a", "b", "c"], "string models split on comma/newline");
A(c.protocol === "anthropic", "protocol carried through");

// missing essentials → throws (server would reject anyway, but fail fast in the UI)
let threw = false; try { parseCustomProviderConfig(JSON.stringify({ name: "x" })); } catch { threw = true; }
A(threw, "missing baseURL/apiKey throws");

// bad JSON → throws (surfaced via ErrorLine)
threw = false; try { parseCustomProviderConfig("{not json"); } catch { threw = true; }
A(threw, "malformed JSON throws");

// models omitted → undefined (never wipes a saved list on a key-only re-connect)
c = parseCustomProviderConfig(JSON.stringify({ name: "x", baseURL: "https://h", apiKey: "k" }));
A(c.models === undefined, "no models key → undefined");

eq(parseModelList(" a , b ,,c \n d "), ["a", "b", "c", "d"], "parseModelList trims + drops empties");

console.log("OK — custom-provider JSON config parse");
