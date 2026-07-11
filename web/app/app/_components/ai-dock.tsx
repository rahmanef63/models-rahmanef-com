"use client";
import { useState } from "react";

// A REAL one-line assistant composer — type a prompt and it starts a chat with the text prefilled.
// Was a dead <button> styled like an input that only navigated to an empty chat. Shared by the
// desktop AiDock (docked on Overview) and the mobile FAB compose sheet, so both actually let you type.
export function AiComposer({ onSubmit, modelCount, autoFocus }: { onSubmit: (text: string) => void; modelCount?: number; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const send = () => { const t = text.trim(); if (t) { onSubmit(t); setText(""); } };
  const loading = modelCount === undefined; // distinct from "0 models" so we don't cry "connect a provider" mid-load
  return (
    <div className="ai-composer">
      <textarea
        className="ai-composer-input"
        rows={3}
        autoFocus={autoFocus}
        placeholder="Tanya apa saja — Enter untuk mulai chat"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
      />
      <button className="btn accent ai-composer-send" disabled={!text.trim()} onClick={send}>Mulai chat</button>
      <p className="ai-dock-disc mono">
        {loading ? "Menyiapkan…" : modelCount! > 0 ? `${modelCount} model siap · AI bisa salah — periksa hasilnya.` : "Sambungkan provider dulu untuk mulai."}
      </p>
    </div>
  );
}

// Docked assistant panel (Overview-only, hidden <900px via CSS). Now hosts the real composer + one
// link to the full Workbench — the three redundant "go to chat" CTAs are gone.
export function AiDock({ modelCount, onCompose, openWorkbench }: { modelCount?: number; onCompose: (text: string) => void; openWorkbench: () => void }) {
  return (
    <aside className="ai-dock" aria-label="AI assistant">
      <div className="ai-dock-head">
        <span className="eyebrow">Asisten AI</span>
        <button className="link" onClick={openWorkbench}>buka Workbench →</button>
      </div>
      <AiComposer onSubmit={onCompose} modelCount={modelCount} />
    </aside>
  );
}
