// Export/import/generate-prompt helpers for agent configs. Pure functions, no Convex calls —
// export/import both reuse the EXISTING create mutation (via AgentForm's prefill path), so
// there's no new backend surface here, just serialization.
import type { AgentDef, AgentPrefill, SkillMeta, ToolMeta } from "./agent-form";

const SCHEMA_TAG = "models-rahmanef-agent/v1";

type ExportedAgent = {
  schema: string;
  name: string;
  model: string;
  modelHint?: string;
  instructions: string;
  tools: string[];
  skills: string[];
  maxSteps: number;
  temperature: number | null;
};

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent";

export function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// `template: true` strips the concrete model (a template is meant to be reused by someone with
// DIFFERENT providers connected) and adds a hint instead of a hardcoded model ref.
export function exportAgentPayload(a: AgentDef, template: boolean): ExportedAgent {
  return {
    schema: SCHEMA_TAG,
    name: a.name,
    model: template ? "" : a.model,
    ...(template ? { modelHint: a.tools.length > 0 ? "pick any tool-capable model you have connected" : "pick any chat model you have connected" } : {}),
    instructions: a.instructions ?? "",
    tools: a.tools,
    skills: a.skills ?? [],
    maxSteps: a.maxSteps,
    temperature: a.temperature ?? null,
  };
}

export function exportAgentFile(a: AgentDef, template: boolean) {
  downloadJson(exportAgentPayload(a, template), `${slugify(a.name)}${template ? ".template" : ""}.json`);
}

// Tolerant of missing/extra fields (schema tag and modelHint are informational, not required) —
// AgentForm's own validation (name required, model must be "provider/model") gates actual saving.
export function parseImportedAgent(raw: string): AgentPrefill {
  const j = JSON.parse(raw);
  if (!j || typeof j !== "object") throw new Error("not a JSON object");
  return {
    name: typeof j.name === "string" ? j.name : "",
    model: typeof j.model === "string" ? j.model : "",
    instructions: typeof j.instructions === "string" && j.instructions ? j.instructions : undefined,
    tools: Array.isArray(j.tools) ? j.tools.filter((t: unknown) => typeof t === "string") : [],
    skills: Array.isArray(j.skills) ? j.skills.filter((s: unknown) => typeof s === "string") : [],
    maxSteps: typeof j.maxSteps === "number" ? j.maxSteps : 8,
    temperature: typeof j.temperature === "number" ? j.temperature : undefined,
  };
}

// Copy-pasteable into ANY AI chat (ChatGPT, Claude.ai, etc.) — built from the live registries so
// it never lists a tool/skill id that doesn't actually exist in this deployment.
export function buildGeneratePrompt(toolRegistry: ToolMeta[], skillRegistry: SkillMeta[]): string {
  const toolLines = toolRegistry.map((t) => `- "${t.id}": ${t.description}`).join("\n");
  const skillLines = skillRegistry.map((s) => `- "${s.id}": ${s.description}`).join("\n");
  return `I'm setting up an AI agent on a BYOK AI gateway app. Generate ONE JSON object — nothing else, no markdown fences, no commentary — matching this exact shape:

{
  "schema": "${SCHEMA_TAG}",
  "name": "<short name, e.g. 'Research Assistant'>",
  "model": "<\\"provider/model\\", e.g. \\"anthropic/claude-sonnet-4-5\\" — leave as \\"\\" if you don't know what I have connected>",
  "instructions": "<system prompt — what this agent's job is, how it should behave>",
  "tools": [<zero or more tool ids from the list below>],
  "skills": [<zero or more skill ids from the list below>],
  "maxSteps": <integer 1-20, how many tool-call rounds it gets — 8 is a reasonable default>,
  "temperature": <optional number 0-2, omit or null for provider default>
}

Available tools:
${toolLines}

Available skills (reusable instruction bundles):
${skillLines}

What I want this agent to do: <describe the agent's job here>`;
}
