// Reusable instruction-bundles an agent can pick up, alongside its own free-form `instructions`
// and its `tools`. Same shape convention as toolRegistry.ts's plain-metadata pattern — deliberately
// NOT coupled to specific tools (unlike rr's assistant-slice Skill type) so the existing tools
// picker stays independent and unchanged; a skill here is purely a system-prompt snippet.
export const SKILLS_REGISTRY = [
  { id: "researcher", label: "Researcher", description: "Cites sources, notes confidence, prefers primary sources.", instructions: "When researching or answering factual questions, cite sources where possible and note your confidence. Prefer primary sources over secondhand summaries." },
  { id: "terse", label: "Terse", description: "Short, direct answers — no filler.", instructions: "Be terse and direct. Skip pleasantries and hedging. Short sentences. Say what you mean, nothing more." },
  { id: "code-reviewer", label: "Code reviewer", description: "Structured findings: file, issue, severity, fix.", instructions: "When reviewing code, report findings as a list: file, the specific issue, its severity, and a concrete suggested fix. Be specific — quote the exact line when possible, not a paraphrase." },
  { id: "planner", label: "Planner", description: "Breaks multi-step tasks into a numbered plan first.", instructions: "For multi-step or ambiguous tasks, write a short numbered plan before executing. If the scope is genuinely ambiguous, ask one clarifying question rather than guessing." },
  { id: "explainer", label: "Explainer", description: "Plain language, concrete examples over jargon.", instructions: "Explain technical concepts in plain language. Prefer a concrete example over an abstract description. Define jargon the first time you use it." },
  { id: "data-analyst", label: "Data analyst", description: "Shows reasoning, notes caveats, quantifies uncertainty.", instructions: "When analyzing data, show your reasoning, note sample size and caveats, and quantify uncertainty rather than stating a single number with false precision." },
] as const;

export type SkillId = (typeof SKILLS_REGISTRY)[number]["id"];
export const SKILL_IDS: readonly string[] = SKILLS_REGISTRY.map((s) => s.id);
