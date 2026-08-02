import { chunkText } from "./convex/ragChunk.ts";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };

A(chunkText("").length === 0, "empty → []");
A(chunkText("   \n  ").length === 0, "whitespace → []");
A(chunkText("hello world").length === 1, "short → 1 chunk");
A(chunkText("hi")[0] === "hi", "short chunk preserves text");

// long text → multiple chunks, each within a sane bound, covering the whole input
const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} with some filler words to add length. `).join("");
const cs = chunkText(long, 300, 60);
A(cs.length > 1, "long → multiple chunks");
A(cs.every((c) => c.length <= 300 + 5), "each chunk within size bound");
A(cs.join(" ").includes("Sentence number 59"), "coverage reaches the end");

// no infinite loop on a boundary-less blob larger than size
const blob = "x".repeat(5000);
const cb = chunkText(blob, 1000, 150);
A(cb.length >= 5 && cb.length < 8, "boundary-less blob chunks finitely, got " + cb.length);

console.log("OK — chunkText: empty/short/long/blob all chunk correctly, no infinite loop");
