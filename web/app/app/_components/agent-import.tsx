"use client";
import { useRef, useState } from "react";
import { buildGeneratePrompt, parseImportedAgent } from "./agent-io";
import type { AgentPrefill, SkillMeta, ToolMeta } from "./agent-form";

// Dropdown next to "+ New agent": paste a previously-exported (or AI-generated) agent JSON, or
// copy a ready-to-paste prompt that asks any AI chat to draft one for you.
export function ImportMenu({ toolRegistry, skillRegistry, onImport }: {
  toolRegistry: ToolMeta[];
  skillRegistry: SkillMeta[];
  onImport: (prefill: AgentPrefill) => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details className="dropdown" ref={detailsRef}>
      <summary className="btn">Import ▾</summary>
      <div className="dropdown-menu">
        <button className="link" onClick={() => setPasting((v) => !v)}>{pasting ? "cancel paste" : "Paste JSON…"}</button>
        <button
          className="link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(buildGeneratePrompt(toolRegistry, skillRegistry));
              setCopied(true);
              setErr("");
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setErr("couldn't copy — your browser blocked clipboard access");
            }
          }}
        >
          {copied ? "copied — paste into any AI chat" : "Copy AI-generate prompt"}
        </button>
      </div>
      {pasting && (
        <div className="agent-form" style={{ marginTop: "0.6rem" }}>
          <textarea rows={6} placeholder="paste agent JSON here" value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} />
          {err && <p className="err">{err}</p>}
          <button
            className="btn accent"
            disabled={!text.trim()}
            onClick={() => {
              try {
                onImport(parseImportedAgent(text));
                setText("");
                setPasting(false);
                if (detailsRef.current) detailsRef.current.open = false;
              } catch (e) {
                setErr(e instanceof Error ? `invalid JSON — ${e.message}` : "invalid JSON");
              }
            }}
          >
            Use this
          </button>
        </div>
      )}
    </details>
  );
}
