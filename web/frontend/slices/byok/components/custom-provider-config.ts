export type CustomConfig = { name: string; baseURL: string; apiKey: string; protocol?: string; models?: string[] };
export const parseModelList = (s: string): string[] => [...new Set(s.split(/[\n,]/).map((m) => m.trim()).filter(Boolean))];

// JSON parse errors can quote the input (including its key), so never expose the native error.
export function parseCustomProviderConfig(json: string): CustomConfig {
  let o;
  try { o = JSON.parse(json); } catch { throw new Error("Enter valid JSON with name, baseURL and apiKey."); }
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("Config must be a JSON object.");
  const name = o.name ?? o.slug, baseURL = o.baseURL ?? o.base_url ?? o.endpoint, apiKey = o.apiKey ?? o.api_key ?? o.key;
  if ([name, baseURL, apiKey].some((s) => typeof s !== "string" || !s.trim())) throw new Error("Config needs non-empty name, baseURL and apiKey strings.");
  if (o.protocol !== undefined && o.protocol !== "openai" && o.protocol !== "anthropic") throw new Error("Protocol must be openai or anthropic.");
  if (o.models !== undefined && typeof o.models !== "string" && (!Array.isArray(o.models) || o.models.some((m: unknown) => typeof m !== "string"))) throw new Error("Models must be strings or a comma-separated list.");
  const models = Array.isArray(o.models) ? [...new Set<string>(o.models.map((m: string) => m.trim()).filter(Boolean))] : typeof o.models === "string" ? parseModelList(o.models) : undefined;
  return { name: name.trim(), baseURL: baseURL.trim(), apiKey, protocol: o.protocol, models };
}
