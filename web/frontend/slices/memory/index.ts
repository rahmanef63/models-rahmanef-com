// memory slice public barrel (memory v0.1.0). Curated cross-session memory for agents.
export { MemoryPanel } from "./components/memory-panel";
// the md/json vault — data-structure tree (secondary sidebar) + editor (main region)
export { NoteTree } from "./components/note-tree";
export { MemoryVault } from "./components/memory-vault";
// wikilink/mention refs — shared with memory-graph (which imports them from here)
export { parseRefs, resolveRef, type RefNode } from "./lib/refs";
