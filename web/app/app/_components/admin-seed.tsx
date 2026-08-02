"use client";
// Admin · Seed — bulk-import agent presets from a JSON bundle. Download the template to learn the
// shape, edit it, upload to seed. Idempotent by name (re-upload after edits is safe). Mirrors
// CareerPack's EngineSeedPanel. Seeds into the admin's own account (agentDefs is per-user).
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { downloadJson, readJsonFile } from "./download-json";
import { errData } from "./shared";

// Downloadable schema/example. `_note` lives only at envelope level — preset objects must carry
// ONLY the fields the mutation's v.object accepts (extra keys are rejected server-side).
const TEMPLATE = {
  _note: "Agent presets seed bundle. Edit and re-upload via Admin › Seed. Idempotent by name (same name = updated, not duplicated). Valid skills: researcher, terse, code-reviewer, planner, explainer, data-analyst.",
  presets: [
    { name: "Researcher", model: "anthropic/claude-sonnet-4", instructions: "Cite sources and note your confidence.", tools: [], skills: ["researcher"], maxSteps: 8, temperature: 0.7 },
    { name: "Terse Coder", model: "openai/gpt-4o-mini", instructions: "", tools: [], skills: ["terse", "code-reviewer"], maxSteps: 6 },
    { name: "Planner", model: "google/gemini-2.0-flash", instructions: "Plan before acting.", tools: [], skills: ["planner"], maxSteps: 10, temperature: 0.4 },
  ],
};

type P = Record<string, unknown>;
// keep ONLY the allowed keys — a JSON file can carry anything; the mutation's strict validator rejects extras.
const pick = (p: P) => ({
  name: String(p?.name ?? ""),
  model: String(p?.model ?? ""),
  ...(p?.instructions != null ? { instructions: String(p.instructions) } : {}),
  ...(Array.isArray(p?.tools) ? { tools: (p.tools as unknown[]).map(String) } : {}),
  ...(Array.isArray(p?.skills) ? { skills: (p.skills as unknown[]).map(String) } : {}),
  ...(typeof p?.maxSteps === "number" ? { maxSteps: p.maxSteps } : {}),
  ...(typeof p?.temperature === "number" ? { temperature: p.temperature } : {}),
});

type Result = { inserted: number; updated: number; skipped: number; errors: string[] };

export function AdminSeedCard() {
  const seed = useMutation(api.adminSeed.adminSeedAgentPresets);
  const fileRef = useRef<HTMLInputElement>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const raw = await readJsonFile(file);
      const list = Array.isArray(raw) ? raw : (raw as { presets?: unknown })?.presets;
      if (!Array.isArray(list)) throw new Error('Expected a JSON array or { "presets": [...] }.');
      setResult(await seed({ presets: list.map((p) => pick(p as P)), overwrite }));
    } catch (e2) {
      const d = errData(e2);
      setErr(typeof d === "string" ? d : d.detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Seed <span className="badge oauth">SUPER</span></h2>
      <p className="sub">Bootstrap agent presets from a JSON bundle. Download the template for the exact shape, edit it, upload to seed. Idempotent — same name updates in place, never duplicates.</p>

      <div className="row" style={{ gap: ".7rem", marginTop: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" onClick={() => downloadJson("models-agent-presets-template.json", TEMPLATE)}>↓ Download template schema</button>
        <button className="btn accent" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "seeding…" : "↑ Seed from JSON"}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <label className="row mono muted" style={{ gap: ".4rem", fontSize: ".78rem", cursor: "pointer" }}>
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> overwrite existing
        </label>
      </div>

      {err && <p className="err" style={{ marginTop: ".8rem" }}>{err}</p>}
      {result && (
        <div className="admin-block">
          <h3>Result</h3>
          <div className="row mono" style={{ gap: "1.5rem" }}>
            <span className="accent">{result.inserted} inserted</span>
            <span>{result.updated} updated</span>
            <span className="muted">{result.skipped} skipped</span>
          </div>
          {result.errors.length > 0 && (
            <ul className="creds" style={{ marginTop: ".6rem" }}>
              {result.errors.map((m, i) => (
                <li key={i}><span className="name mono" style={{ fontSize: ".78rem", color: "var(--danger)" }}>{m}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
