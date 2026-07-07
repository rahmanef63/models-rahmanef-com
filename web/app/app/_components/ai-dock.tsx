"use client";

// Docked AI assistant panel from the wireframe's RightPanel (Home-only, hidden <900px via CSS).
// It's a launcher, not a second chat impl — the prompt bar + button both hand off to the Workbench
// section. ponytail: hand-off to the real chat instead of rebuilding a mini chat here; wire a
// prompt prefill into WorkbenchCard only if users actually want the text carried over.
export function AiDock({ modelCount, go }: { modelCount: number; go: (s: string) => void }) {
  return (
    <aside className="ai-dock" aria-label="AI assistant">
      <div className="ai-dock-head">
        <span className="eyebrow">Asisten AI</span>
        <button className="link" onClick={() => go("chat")}>buka →</button>
      </div>
      <p className="ai-dock-pitch">
        Tanya apa saja, jalankan agent, bandingkan model. {modelCount > 0 ? `${modelCount} model siap dipakai.` : "Sambungkan provider dulu untuk mulai."}
      </p>
      <button className="ai-dock-prompt" onClick={() => go("chat")}>
        <span className="dot" aria-hidden />
        Ada yang bisa saya bantu?
      </button>
      <button className="btn accent ai-dock-cta" onClick={() => go("chat")}>Buka Workbench</button>
      <p className="ai-dock-disc mono">AI bisa salah — periksa kembali hasilnya.</p>
    </aside>
  );
}
