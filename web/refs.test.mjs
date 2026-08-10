// Guards the memory ↔ memory-graph split: parseRefs/resolveRef moved from memory-graph into the
// `memory` slice so the vault works without the graph installed. Resolution order is load-bearing
// (exact id → normalized title → id `-slug` suffix → title substring) — a reorder silently
// repoints every wikilink in the vault.
import { parseRefs, resolveRef } from "./frontend/slices/memory/lib/refs.ts";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };

// --- parseRefs: bracket forms only ---
A(parseRefs("see @[Convex] and /[Researcher] and [[Vault]]").join(",") === "Convex,Researcher,Vault", "all three bracket forms");
A(parseRefs("n/a, and/or, 12/25, me@example.com").length === 0, "bare @word and /word never link");
A(parseRefs("[[Dup]] then @[dup]").length === 1, "duplicates dropped case-insensitively");
A(parseRefs("@[x] [[y]]").length === 0, "1-char refs ignored");
A(parseRefs("").length === 0, "empty text → []");

// --- resolveRef: order matters, first hit wins ---
const nodes = [
  { id: "skill-researcher", title: "Researcher" },
  { id: "Convex", title: "Convex Backend" },
  { id: "note-1", title: "Convex" },
];
A(resolveRef("Convex", nodes) === "Convex", "exact id beats title match");
A(resolveRef("Convex Backend", nodes) === "Convex", "normalized-title equality");
A(resolveRef("Researcher", nodes) === "skill-researcher", "id ends with -slug");
A(resolveRef("Backend", nodes) === "Convex", "title substring is the last resort");
A(resolveRef("nothing here", nodes) === null, "unmatched → null");
A(resolveRef("convex backend", nodes) === "Convex", "resolution is case-insensitive");

console.log("OK — refs: bracket-only parsing, resolution order, no bare-@ false links");
