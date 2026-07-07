// Parse an imported memory file into a flat list of memory strings. Accepts a JSON array, a
// { memories: [...] } wrapper, a flat string→string object, or newline-delimited plain text.
// Objects fall back to title/text/JSON so a dump of records still yields something usable.
export function parseImport(text: string): string[] {
  const asString = (v: unknown): string =>
    typeof v === "string" ? v : (v && typeof v === "object" ? ((v as { title?: string; text?: string }).title ?? (v as { text?: string }).text ?? JSON.stringify(v)) : String(v));
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed.map(asString).filter(Boolean);
    if (parsed && typeof parsed === "object") {
      const mem = (parsed as { memories?: unknown }).memories;
      if (Array.isArray(mem)) return mem.map(asString).filter(Boolean);
      return Object.values(parsed as Record<string, unknown>).filter((v) => typeof v === "string") as string[];
    }
  } catch {
    // plain text / markdown: one memory per line, skip headings + blanks, strip list bullets
    return text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#"))
      .map((s) => s.replace(/^[-*+]\s+/, ""));
  }
  return [];
}
