"use client";
// SchedulesCard — run a saved agent on a recurring interval. Pick one of your agents, a prompt, and
// an interval (minutes, floored at 15), then the cron fires it AS you, spending this workspace's creds.
// The list shows each schedule's last-run status + output, with enable/disable and remove. Only the
// creator (or a ws admin) can toggle/remove — enforced server-side in convex/scheduledAgents.ts.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { useConfirm } from "@/app/app/_components/responsive-dialog";

const MIN_INTERVAL = 15;
type Sched = { id: string; agentId: string; prompt: string; everyMinutes: number; enabled: boolean; lastRunAt?: number; lastStatus?: string; lastResult?: string; createdAt: number };
type Agent = { _id: string; name: string; model: string };

const fmt = (t?: number) => (t ? new Date(t).toLocaleString() : "never");

export function SchedulesCard() {
  const { workspaceId } = useWorkspace();
  const wsArg = workspaceId ? { workspaceId: workspaceId as never } : "skip";
  const schedules = useQuery(api.scheduledAgents.list, wsArg) as Sched[] | undefined;
  const agents = useQuery(api.agentDefs.list, {}) as Agent[] | undefined;
  const create = useMutation(api.scheduledAgents.create);
  const update = useMutation(api.scheduledAgents.update);
  const toggle = useMutation(api.scheduledAgents.toggle);
  const remove = useMutation(api.scheduledAgents.remove);

  const [editId, setEditId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [every, setEvery] = useState(60);
  const [err, setErr] = useState<string | null>(null);
  const { ask, confirmDialog } = useConfirm();

  const nameOf = (id: string) => agents?.find((x) => x._id === id)?.name ?? "(deleted agent)";
  const resetForm = () => { setEditId(null); setAgentId(""); setPrompt(""); setEvery(60); setErr(null); };
  const edit = (s: Sched) => { setEditId(s.id); setAgentId(s.agentId); setPrompt(s.prompt); setEvery(s.everyMinutes); setErr(null); };

  const submit = async () => {
    if (!workspaceId || !agentId || !prompt.trim()) return;
    setErr(null);
    try {
      const base = { workspaceId: workspaceId as never, agentId: agentId as never, prompt: prompt.trim(), everyMinutes: Math.max(MIN_INTERVAL, every) };
      if (editId) { await update({ ...base, scheduleId: editId as never }); resetForm(); }
      else { await create(base); setPrompt(""); }
    } catch (e: any) {
      setErr(e?.data?.detail ?? e?.message ?? "Failed to save schedule.");
    }
  };

  return (
    <section className="card">
      <h2>Schedules</h2>
      <p className="sub">Run one of your saved agents on a repeating interval. It runs as you, spending this workspace&apos;s credentials — so keep the interval sane (min {MIN_INTERVAL} min).</p>

      {agents && agents.length === 0 ? (
        <p className="sub" style={{ marginTop: "1rem" }}>Create an agent first, then you can schedule it.</p>
      ) : (
        <div className="col" style={{ gap: ".6rem", marginTop: "1rem" }}>
          <div className="row">
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">select an agent…</option>
              {agents?.map((ag) => (
                <option key={ag._id} value={ag._id}>{ag.name} · {ag.model}</option>
              ))}
            </select>
            <input type="number" min={MIN_INTERVAL} step={5} value={every} onChange={(e) => setEvery(Number(e.target.value))} style={{ width: "7rem" }} title="interval in minutes" />
            <span className="muted mono" style={{ fontSize: ".8rem", alignSelf: "center" }}>min</span>
          </div>
          <textarea placeholder="prompt to run each interval (e.g. summarize today's new issues)" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
          {err && <p className="sub danger" style={{ margin: 0 }}>{err}</p>}
          <div className="row" style={{ gap: ".5rem" }}>
            <button className="btn accent" disabled={!agentId || !prompt.trim()} onClick={() => void submit()}>{editId ? "Save" : "+ schedule"}</button>
            {editId && <button className="btn" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      )}

      {schedules && schedules.length > 0 ? (
        <ul className="creds" style={{ marginTop: "1rem" }}>
          {schedules.map((s) => (
            <li key={s.id} style={{ alignItems: "flex-start" }}>
              <span className="name" style={{ fontSize: ".85rem", display: "flex", flexDirection: "column", gap: ".2rem" }}>
                <span><b>{nameOf(s.agentId)}</b> <span className="muted mono">· every {s.everyMinutes}m · {s.enabled ? "enabled" : "paused"}</span></span>
                <span className="muted mono" style={{ fontSize: ".78rem" }}>{s.prompt.slice(0, 100)}</span>
                <span className="muted mono" style={{ fontSize: ".76rem" }}>
                  last: {fmt(s.lastRunAt)}{s.lastStatus ? ` · ${s.lastStatus}` : ""}{s.lastResult ? ` — ${s.lastResult.slice(0, 80)}` : ""}
                </span>
              </span>
              <span className="row" style={{ gap: ".5rem" }}>
                <button className="link" onClick={() => edit(s)}>edit</button>
                <button className="link" onClick={() => workspaceId && void toggle({ workspaceId: workspaceId as never, scheduleId: s.id as never, enabled: !s.enabled })}>{s.enabled ? "pause" : "resume"}</button>
                <button className="link danger" onClick={() => ask({ title: "Delete schedule?", message: `Stop running "${nameOf(s.agentId)}" on its schedule? This can't be undone.`, run: () => workspaceId && remove({ workspaceId: workspaceId as never, scheduleId: s.id as never }) })}>delete</button>
              </span>
            </li>
          ))}
        </ul>
      ) : schedules ? (
        <p className="sub" style={{ marginTop: "1rem" }}>No schedules yet — pick an agent above to run it on a repeating interval.</p>
      ) : (
        <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>
      )}
      {confirmDialog}
    </section>
  );
}
