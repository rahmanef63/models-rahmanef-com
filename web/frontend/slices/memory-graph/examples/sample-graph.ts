// Static SAMPLE_GRAPH — same shape hooks/use-graph-data.ts assembles from Convex (core → 4 clusters
// → memory/skill/tool/agent leaves, agents cross-linking their skills+tools), but hardcoded so the
// portable <MemoryGraph> can render backend-free: landing preview, storybook, or another app's demo.
// Pure data export — exempt from the 200-line cap.
import type { GraphData, GraphNode, ClusterDef } from "../types";

const CLUSTERS: ClusterDef[] = [
  { id: "memories", label: "Memories", icon: "memory" },
  { id: "agents", label: "Agents", icon: "agent" },
  { id: "skills", label: "Skills", icon: "skill" },
  { id: "tools", label: "Tools", icon: "tool" },
];

const MEMORIES = [
  { t: "Prefers TypeScript strict everywhere", k: "fact", pin: true },
  { t: "Ships direct to main, no PRs (solo dev)", k: "fact" },
  { t: "Convex self-hosted · ≤200 lines per file", k: "fact" },
  { t: "Landing must reflect every shipped feature", k: "fact" },
  { t: "Summary: BYOK gateway across 22 providers", k: "summary" },
];
const SKILLS = [
  { id: "researcher", label: "researcher", d: "Find + cite sources" },
  { id: "code-reviewer", label: "code-reviewer", d: "Review a diff, hunt bugs" },
  { id: "planner", label: "planner", d: "Break a task into steps" },
];
const TOOLS = [
  { id: "get_my_usage", label: "get_my_usage", d: "Tokens + est. spend" },
  { id: "list_my_providers", label: "list_my_providers", d: "Connected providers" },
  { id: "get_model_catalog", label: "get_model_catalog", d: "models.dev catalog" },
];
const AGENTS = [
  { id: "a1", name: "Research bot", skills: ["researcher"], tools: ["get_model_catalog"] },
  { id: "a2", name: "Usage watcher", skills: ["planner"], tools: ["get_my_usage", "list_my_providers"] },
  { id: "a3", name: "PR reviewer", skills: ["code-reviewer"], tools: [] },
];

const nodes: GraphNode[] = [
  { id: "core", type: "core", title: "models", body: "The hub — everything the workspace knows, plus the agents, skills and tools that use it." },
  ...CLUSTERS.map((c): GraphNode => ({ id: c.id, type: "cluster", title: c.label, icon: c.icon, parent: "core", group: c.id })),
  ...MEMORIES.map((m, i): GraphNode => ({ id: `mem-${i}`, type: "memory", title: m.t, body: m.t, parent: "memories", group: "memories", tags: [m.k], existing: true, pinned: m.pin, attachment: m.k === "summary" })),
  ...SKILLS.map((s): GraphNode => ({ id: `skill-${s.id}`, type: "skill", title: s.label, body: s.d, parent: "skills", group: "skills", tags: ["skill"], existing: true })),
  ...TOOLS.map((t): GraphNode => ({ id: `tool-${t.id}`, type: "tool", title: t.label, body: t.d, parent: "tools", group: "tools", tags: ["tool"], existing: true })),
  ...AGENTS.map((a): GraphNode => ({ id: `agent-${a.id}`, type: "agent", title: a.name, body: `${a.skills.length} skill · ${a.tools.length} tool`, parent: "agents", group: "agents", tags: ["agent"], existing: true, links: [...a.skills.map((s) => `skill-${s}`), ...a.tools.map((t) => `tool-${t}`)] })),
];

export const SAMPLE_GRAPH: GraphData = { nodes, clusters: CLUSTERS };
