// Static per-1k-token USD rate map. Ponytail: a static map, NOT a table — rates aren't user-editable
// here, so a code constant is the laziest thing that works (swap to a table only if consumers must
// edit rates at runtime). Keyed by full "provider/model" ref; a bare "provider/*" wildcard is the
// per-provider fallback. estCostUsd is an ESTIMATE, not a bill — a missing model floors cost to 0
// and flags hasRate=false so the UI can surface "rate unknown".
export type Rate = { inputPer1kUsd: number; outputPer1kUsd: number };

export const RATES: Record<string, Rate> = {
  // OpenAI
  "openai/gpt-4o": { inputPer1kUsd: 0.0025, outputPer1kUsd: 0.01 },
  "openai/gpt-4o-mini": { inputPer1kUsd: 0.00015, outputPer1kUsd: 0.0006 },
  "openai/gpt-4.1": { inputPer1kUsd: 0.002, outputPer1kUsd: 0.008 },
  "openai/gpt-4.1-mini": { inputPer1kUsd: 0.0004, outputPer1kUsd: 0.0016 },
  "openai/o1-mini": { inputPer1kUsd: 0.0011, outputPer1kUsd: 0.0044 },
  // Anthropic
  "anthropic/claude-3-5-sonnet": { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 },
  "anthropic/claude-3-5-haiku": { inputPer1kUsd: 0.0008, outputPer1kUsd: 0.004 },
  "anthropic/claude-3-opus": { inputPer1kUsd: 0.015, outputPer1kUsd: 0.075 },
  // per-provider fallbacks (wildcard "provider/*")
  "openai/*": { inputPer1kUsd: 0.0005, outputPer1kUsd: 0.0015 },
  "anthropic/*": { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 },
};

// Resolve a rate for a "provider/model" ref: exact match → "provider/*" wildcard → null.
export function rateFor(ref: string): Rate | null {
  if (RATES[ref]) return RATES[ref];
  const i = ref.indexOf("/");
  if (i > 0) { const w = ref.slice(0, i) + "/*"; if (RATES[w]) return RATES[w]; }
  return null;
}

// est = prompt/1000*inputRate + completion/1000*outputRate. hasRate=false → cost 0 (unknown model).
export function estCostUsd(ref: string, promptTokens: number, completionTokens: number): { cost: number; hasRate: boolean } {
  const r = rateFor(ref);
  if (!r) return { cost: 0, hasRate: false };
  return { cost: (promptTokens / 1000) * r.inputPer1kUsd + (completionTokens / 1000) * r.outputPer1kUsd, hasRate: true };
}
