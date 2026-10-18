type Metadata = {
  limit?: { context?: unknown; output?: unknown }; cost?: { input?: unknown; output?: unknown };
  tool_call?: unknown; reasoning?: unknown; modalities?: { input?: unknown }; knowledge?: unknown; release_date?: unknown;
};
const number = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const tokens = (n: unknown) => number(n) ? `${n} tok` : "unknown";
const price = (n: unknown) => number(n) ? `$${n}` : "unknown";
const capability = (value: unknown) => value === true ? "yes" : value === false ? "no" : "unknown";

// Missing catalog facts stay unknown; zero price and explicit false are meaningful values.
export function catalogMetadata(value: unknown): [string, string][] {
  if (!value || typeof value !== "object") return [];
  const m = value as Metadata;
  const cells: [string, string][] = [
    ["context", tokens(m.limit?.context)], ["max out", tokens(m.limit?.output)],
    ["in $/M", price(m.cost?.input)], ["out $/M", price(m.cost?.output)],
    ["tools", capability(m.tool_call)], ["reasoning", capability(m.reasoning)],
  ];
  if (Array.isArray(m.modalities?.input) && m.modalities.input.every((s) => typeof s === "string") && m.modalities.input.length) cells.push(["input", m.modalities.input.join(" · ")]);
  if (typeof m.knowledge === "string" && m.knowledge) cells.push(["knowledge", m.knowledge]);
  if (typeof m.release_date === "string" && m.release_date) cells.push(["released", m.release_date]);
  return cells;
}
