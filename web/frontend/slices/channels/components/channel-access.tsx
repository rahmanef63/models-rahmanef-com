"use client";
// Per-channel access policy control. 'allowlist' (default) = only approved senders may spend the
// owner's provider keys; 'open' = anyone who can reach the bot. Lists recent senders (from
// channelIdentities) so the owner click-adds the ones they trust. Admin-only writes are enforced
// server-side (channelsAccess.setAccessPolicy / setSenderAllowed via requireChannelAdmin).
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Sender = { id: string; externalUserId: string; displayName: string | null; allowed: boolean; createdAt: number };

export function ChannelAccess({ channelId }: { channelId: string }) {
  const data = useQuery(api.channelsAccess.listSenders, { channelId: channelId as never }) as
    | { policy: "open" | "allowlist"; senders: Sender[] }
    | undefined;
  const setPolicy = useMutation(api.channelsAccess.setAccessPolicy);
  const setAllowed = useMutation(api.channelsAccess.setSenderAllowed);
  if (!data) return null;
  const senders = [...data.senders].sort((a, b) => Number(b.allowed) - Number(a.allowed) || b.createdAt - a.createdAt);

  return (
    <div style={{ flexBasis: "100%", marginTop: ".4rem", paddingTop: ".4rem", borderTop: "1px solid var(--border, #333)" }}>
      <div className="row" style={{ gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="sub" style={{ fontSize: ".78rem" }}>Access</span>
        <select value={data.policy} onChange={(e) => void setPolicy({ id: channelId as never, policy: e.target.value as never })}>
          <option value="allowlist">allowlist (only approved senders)</option>
          <option value="open">open (anyone can use)</option>
        </select>
      </div>
      {data.policy === "allowlist" && (
        senders.length > 0 ? (
          <ul className="creds" style={{ marginTop: ".4rem" }}>
            {senders.map((s) => (
              <li key={s.id} style={{ gap: ".4rem" }}>
                <span className="name mono" style={{ fontSize: ".78rem" }}>
                  {s.allowed ? "✅" : "•"} {s.displayName || s.externalUserId}
                  <span className="muted" style={{ marginLeft: ".3rem" }}>({s.externalUserId})</span>
                </span>
                <button className="link" onClick={() => void setAllowed({ channelId: channelId as never, identityId: s.id as never, allowed: !s.allowed })}>
                  {s.allowed ? "remove" : "allow"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sub" style={{ marginTop: ".4rem", fontSize: ".76rem" }}>No senders yet — once someone messages the bot they appear here to approve.</p>
        )
      )}
    </div>
  );
}
