"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function TokenSaverCard() {
  const s = useQuery(api.settings.mySettings);
  const set = useMutation(api.settings.setSettings);
  if (!s) return null;
  return (
    <section className="card">
      <h2>Chat settings</h2>
      <p className="sub">Agent mode lets the model inspect your setup. Token savers cut output tokens.</p>
      <label className="toggle">
        <input type="checkbox" checked={!!s.agentMode} onChange={(e) => void set({ agentMode: e.target.checked })} />
        <span><strong>Agent mode</strong> <span className="muted">— model can call tools (your providers, usage). Needs a tool-capable model.</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={!!s.cavemanEnabled} onChange={(e) => void set({ cavemanEnabled: e.target.checked })} />
        <span><strong>Caveman</strong> <span className="muted">— terse output, keeps all technical substance</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={!!s.ponytailEnabled} onChange={(e) => void set({ ponytailEnabled: e.target.checked })} />
        <span><strong>Ponytail</strong> <span className="muted">— lazy / YAGNI, minimal answers</span></span>
      </label>
    </section>
  );
}
