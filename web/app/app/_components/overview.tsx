"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Cred, fmt, SUPPORTED } from "./shared";

export function Overview({ providers, models, go }: { providers: Cred[] | undefined; models: string[]; go: (s: string) => void }) {
  const u = useQuery(api.usage.myUsage);
  const tiles = [
    { n: providers === undefined ? "—" : String(providers.length), l: "connected" },
    { n: providers === undefined ? "—" : fmt(models.length), l: "models ready" },
    { n: u ? fmt(u.requests) : "—", l: "requests" },
    { n: u ? fmt(u.totalTokens) : "—", l: "tokens" },
  ];
  const quick = [
    { id: "chat", t: "Workbench", d: "chat any model" },
    { id: "agents", t: "Agents", d: "run a task loop" },
    { id: "providers", t: "Providers", d: `${SUPPORTED} to connect` },
    { id: "mcp", t: "MCP server", d: "expose your tools" },
  ];
  return (
    <>
      <section className="overview">
        {tiles.map((t) => (
          <div className="ov-tile" key={t.l}>
            <div className="ov-num">{t.n}</div>
            <div className="ov-lbl">{t.l}</div>
          </div>
        ))}
      </section>
      <div className="quicklinks">
        {quick.map((q) => (
          <button className="qlink" key={q.id} onClick={() => go(q.id)}>
            <strong>{q.t}</strong>
            <span>{q.d}</span>
          </button>
        ))}
      </div>
      {providers !== undefined && providers.length === 0 && (
        <div className="banner">No providers connected yet — <button className="link" onClick={() => go("providers")}>connect one →</button></div>
      )}
    </>
  );
}
