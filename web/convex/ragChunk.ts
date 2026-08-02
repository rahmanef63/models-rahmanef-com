// Pure text chunker for RAG — ~1000-char chunks with ~150 overlap, breaking on a paragraph/sentence
// boundary near the end where one exists. No deps so it strip-types-tests standalone.
export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIM = 1536;

export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(i, end);
      const br = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (br > size - 250) end = i + br + 1; // snap to a nearby boundary
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1); // overlap, but always make progress (no infinite loop)
  }
  return chunks;
}
