"use client";
import { useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type GraphData, type GraphNode, type ClusterDef } from "../types";

// CONSUMER-SPECIFIC ADAPTER (this is the copy-source layer — swap it per project). Assembles the
// graph from this app's existing queries: personal memories + agents + the built-in skill/tool
// registries. Agents cross-link to the skills + tools they actually use, so the picture is a real
// knowledge graph, not just four disconnected lists. The pure <MemoryGraph> stays Convex-free.
const CLUSTERS: ClusterDef[] = [
  { id: "memories", label: "Memories", icon: "memory" },
  { id: "agents", label: "Agents", icon: "agent" },
  { id: "skills", label: "Skills", icon: "skill" },
  { id: "tools", label: "Tools", icon: "tool" },
];
const clip = (s: string) => (s.length > 24 ? s.slice(0, 24).trim() + "…" : s);

export function useGraphData(brand = "Memory") {
  const memory = useQuery(api.memory.listMemories, { scope: "user" });
  const agents = useQuery(api.agentDefs.list);
  const skills = useQuery(api.agentDefs.listSkillsRegistry);
  const tools = useQuery(api.agentDefs.listToolRegistry);
  const addMem = useMutation(api.memory.addMemory);

  const data: GraphData = useMemo(() => {
    const nodes: GraphNode[] = [
      { id: "core", type: "core", title: brand, body: "Pusat memory — semua yang model pelajari, plus agent, skill & tool yang menyusunnya." },
      ...CLUSTERS.map((c): GraphNode => ({ id: c.id, type: "cluster", title: c.label, icon: c.icon, parent: "core", group: c.id })),
    ];
    for (const m of memory?.items ?? [])
      nodes.push({ id: `mem-${m.id}`, type: "memory", title: clip(m.text), body: m.text, parent: "memories", group: "memories", tags: [m.kind], existing: true, attachment: m.kind === "summary" });
    for (const s of skills ?? [])
      nodes.push({ id: `skill-${s.id}`, type: "skill", title: s.label, body: s.description, parent: "skills", group: "skills", tags: ["skill"], existing: true });
    for (const t of tools ?? [])
      nodes.push({ id: `tool-${t.id}`, type: "tool", title: t.label, body: t.description, parent: "tools", group: "tools", tags: ["tool"], existing: true });
    const skillIds = new Set<string>((skills ?? []).map((s) => s.id));
    const toolIds = new Set<string>((tools ?? []).map((t) => t.id));
    for (const a of agents ?? []) {
      const links = [
        ...(a.skills ?? []).filter((id) => skillIds.has(id)).map((id) => `skill-${id}`),
        ...(a.tools ?? []).filter((id) => toolIds.has(id)).map((id) => `tool-${id}`),
      ];
      nodes.push({ id: `agent-${a._id}`, type: "agent", title: a.name, body: a.instructions || `Model: ${a.model}`, parent: "agents", group: "agents", tags: ["agent"], links, existing: true });
    }
    return { nodes, clusters: CLUSTERS };
  }, [memory, agents, skills, tools, brand]);

  const onAddMemory = useMemo(() => (text: string) => { void addMem({ text }); }, [addMem]);
  const onImport = useMemo(() => async (items: string[]) => { for (const text of items) await addMem({ text }); }, [addMem]);

  return { data, onAddMemory, onImport };
}
