// Wikilink/mention reference parsing + resolution. Lives in `memory` (not `memory-graph`) because
// the vault editor needs it with or without the graph installed — memory-graph imports it from
// here, which is the direction both slice manifests already declare.
//
// Link syntax inside a memory's body text — BRACKET FORM ONLY:
//   @[Convex]        → resolves to the node titled/ided "Convex"
//   /[Researcher]    → same, `/` sigil (mirrors the composer's @// mention picker)
//   [[Convex]]       → Obsidian-style wikilink (same resolution)
// Bracket-only is deliberate: bare `@word` / `/word` appears constantly in prose (n/a, and/or,
// URLs, dates like 12/25, emails) and must NOT create edges. The composer always inserts brackets.
// Pure TS — no deps, no React. Resolution is best-effort: unmatched refs are dropped.

// Structural, NOT memory-graph's GraphNode — importing that type here would recreate the cycle.
// GraphNode satisfies this shape, so graph-links can keep passing its own nodes straight in.
export type RefNode = { id: string; title: string };

// group 1 = @[…] / /[…] sigil form; group 2 = [[…]] Obsidian wikilink form.
const REF_RE = /(?:[@/]\[([^\]]+)\]|\[\[([^\]]+)\]\])/g;

// lowercase, non-alphanumerics → single space, trimmed + collapsed
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// lowercase, non-alphanumerics → "-", collapsed + edge-trimmed (id-slug form)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract every `@`/`/` reference token from `text`. Brackets are stripped and the
 * inner ref trimmed; empty refs are dropped; duplicates removed (case-insensitive).
 */
export function parseRefs(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(REF_RE)) {
    const ref = (match[1] ?? match[2]).trim();
    if (ref.length < 2) continue; // ignore 1-char refs (too ambiguous for substring resolution)
    const key = ref.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

/**
 * Resolve a ref string to a node id. Tries, in order: exact id → normalized-title
 * equality → id ends with `-<slug>` → normalized-title substring. First hit wins.
 */
export function resolveRef(ref: string, nodes: RefNode[]): string | null {
  // a) exact id equality
  for (const n of nodes) {
    if (n.id === ref) return n.id;
  }
  const normRef = normalize(ref);
  // b) normalized-title equality
  for (const n of nodes) {
    if (normalize(n.title) === normRef) return n.id;
  }
  // c) id ends with `-<slug>`  (e.g. "Researcher" → id "skill-researcher")
  const slug = slugify(ref);
  if (slug) {
    const suffix = `-${slug}`;
    for (const n of nodes) {
      if (n.id.toLowerCase().endsWith(suffix)) return n.id;
    }
  }
  // d) normalized-title substring
  if (normRef) {
    for (const n of nodes) {
      if (normalize(n.title).includes(normRef)) return n.id;
    }
  }
  return null;
}
