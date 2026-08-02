"use client";
// CredStatusBadge — pure, props-driven pool-health chip for a single BYOK credential. Shows the
// pool status ('ok' | 'exhausted' | 'dead') and, while cooling, a live "back in Xs" countdown from
// cooldownUntil. No Convex, no consumer-specific copy — feed it the modelCreds pool fields. Style
// hooks are className-only ("pool-badge pool-<status>") so the consumer's CSS owns the look.
import { useEffect, useState } from "react";

export type CredPoolStatus = "ok" | "exhausted" | "dead";
const LABEL: Record<CredPoolStatus, string> = { ok: "live", exhausted: "cooling", dead: "disabled" };

function remaining(until: number | undefined, now: number): string | null {
  if (!until || until <= now) return null;
  const s = Math.ceil((until - now) / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}s`;
}

export function CredStatusBadge({ status, cooldownUntil, lastErrorCode }: {
  status?: string; cooldownUntil?: number; lastErrorCode?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const cooling = !!cooldownUntil && cooldownUntil > now;
  useEffect(() => {
    if (!cooling) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooling]);

  const s: CredPoolStatus = status === "dead" ? "dead" : cooling ? "exhausted" : status === "exhausted" ? "exhausted" : "ok";
  const left = remaining(cooldownUntil, now);
  const title = s === "dead" ? `Disabled until re-auth${lastErrorCode ? ` (${lastErrorCode})` : ""}` : s === "exhausted" ? `Cooling down${lastErrorCode ? ` after ${lastErrorCode}` : ""}` : "Live in the pool";
  return (
    <span className={`pool-badge pool-${s}`} title={title}>
      {LABEL[s]}{s === "exhausted" && left ? ` · ${left}` : ""}
    </span>
  );
}
