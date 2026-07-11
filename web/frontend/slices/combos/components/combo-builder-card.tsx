"use client";
// ComboBuilderCard — build "combo/<name>" model-ref aliases that map to several concrete
// "provider/model" refs. A client targets the one stable name; `strategy` picks which model at call
// time (fallback = first ref; round_robin = rotate). Workspace-scoped via useWorkspace().
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { useConfirm } from "@/app/app/_components/responsive-dialog";

type Combo = { id: string; name: string; refs: string[]; strategy: string; stickyLimit: number; createdAt: number };

export function ComboBuilderCard() {
  const { workspaceId } = useWorkspace();
  const combos = useQuery(api.combos.listCombos, workspaceId ? { workspaceId: workspaceId as never } : "skip") as Combo[] | undefined;
  const create = useMutation(api.combos.createCombo);
  const update = useMutation(api.combos.updateCombo);
  const remove = useMutation(api.combos.removeCombo);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState("fallback");
  const [refs, setRefs] = useState<string[]>([""]);
  const [err, setErr] = useState<string | null>(null);
  const { ask, confirmDialog } = useConfirm();

  const setRef = (i: number, val: string) => setRefs((r) => r.map((x, j) => (j === i ? val : x)));
  const addRef = () => setRefs((r) => (r.length < 5 ? [...r, ""] : r));
  const rmRef = (i: number) => setRefs((r) => r.filter((_, j) => j !== i));
  const reset = () => { setEditId(null); setName(""); setStrategy("fallback"); setRefs([""]); setErr(null); setOpen(false); };
  const edit = (c: Combo) => { setEditId(c.id); setName(c.name); setStrategy(c.strategy); setRefs(c.refs.length ? c.refs : [""]); setErr(null); setOpen(true); };

  const submit = async () => {
    if (!workspaceId) return;
    setErr(null);
    try {
      const payload = { workspaceId: workspaceId as never, name: name.trim(), refs: refs.map((r) => r.trim()).filter(Boolean), strategy };
      if (editId) await update({ ...payload, comboId: editId as never });
      else await create(payload);
      reset();
    } catch (e: any) {
      setErr(e?.data?.detail ?? e?.message ?? "Failed to save combo.");
    }
  };

  return (
    <section className="card">
      <h2>Combos</h2>
      <p className="sub">A combo is one stable name (<code>combo/&lt;name&gt;</code>) that maps to several models. Point a client at the combo; the strategy picks the model per call.</p>

      {open ? (
        <div className="col" style={{ gap: ".6rem", marginTop: "1rem" }}>
          <div className="row">
            <input placeholder="combo name (e.g. fast-cheap)" value={name} onChange={(e) => setName(e.target.value)} />
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <option value="fallback">fallback (first ref)</option>
              <option value="round_robin">round_robin (rotate)</option>
            </select>
          </div>
          {refs.map((r, i) => (
            <div className="row" key={i}>
              <input placeholder="provider/model (e.g. openai/gpt-4o-mini)" value={r} onChange={(e) => setRef(i, e.target.value)} />
              {refs.length > 1 && <button className="link danger" onClick={() => rmRef(i)}>remove</button>}
            </div>
          ))}
          {refs.length < 5 && <button className="link" onClick={addRef}>+ add model ref</button>}
          {err && <p className="sub danger" style={{ margin: 0 }}>{err}</p>}
          <div className="row" style={{ gap: ".5rem" }}>
            <button className="btn accent" disabled={!name.trim() || !refs.some((r) => r.trim())} onClick={() => void submit()}>{editId ? "Save" : "Create"}</button>
            <button className="btn" onClick={reset}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn accent" style={{ marginTop: "1rem" }} onClick={() => setOpen(true)}>+ new combo</button>
      )}

      {combos && combos.length > 0 ? (
        <ul className="creds" style={{ marginTop: "1rem" }}>
          {combos.map((c) => (
            <li key={c.id}>
              <span className="name" style={{ fontSize: ".85rem" }}>
                <code>combo/{c.name}</code> <span className="muted mono">· {c.strategy} · {c.refs.join(", ")}</span>
              </span>
              <span className="row" style={{ gap: ".5rem" }}>
                <button className="link" onClick={() => edit(c)}>edit</button>
                <button className="link danger" onClick={() => ask({ title: "Delete combo?", message: `Delete "combo/${c.name}"? Anything pointing at it stops resolving.`, run: () => workspaceId && remove({ workspaceId: workspaceId as never, comboId: c.id as never }) })}>delete</button>
              </span>
            </li>
          ))}
        </ul>
      ) : combos ? <p className="sub" style={{ marginTop: "1rem" }}>No combos yet — create one to alias several models behind a single name.</p> : <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>}
      {confirmDialog}
    </section>
  );
}
