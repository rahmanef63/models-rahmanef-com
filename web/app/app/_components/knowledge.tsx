"use client";
// Knowledge (RAG) — add documents that get chunked + embedded, then retrieved into chat when the
// composer's "use documents" toggle is on. Embeddings run on the user's OpenAI key (fixed model).
import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { ErrorLine } from "./shared";
import { ResponsiveDialog, useConfirm } from "./responsive-dialog";

type Doc = { _id: string; title: string; charCount: number; chunkCount: number; status: string; createdAt: number };

export function KnowledgeCard() {
  const docs = useQuery(api.rag.listDocs) as Doc[] | undefined;
  const createDoc = useAction(api.ragNode.createDoc);
  const deleteDoc = useMutation(api.rag.deleteDoc);
  const { workspaceId } = useWorkspace();
  const { ask, confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      await createDoc({ title: title.trim() || text.slice(0, 40), text, workspaceId: (workspaceId ?? undefined) as never });
      setTitle(""); setText(""); setOpen(false);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  return (
    <section className="card">
      <h2>Knowledge (RAG)</h2>
      <p className="sub">Add documents; when you turn on <b>use documents</b> in the chat composer, the most relevant chunks are retrieved and grounded into the answer (cited as [n]). Embeddings use your <b>OpenAI</b> key (text-embedding-3-small).</p>
      <button className="btn accent" onClick={() => { setTitle(""); setText(""); setErr(null); setOpen(true); }}>+ Add document</button>

      {docs === undefined ? (
        <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>
      ) : docs.length === 0 ? (
        <p className="sub" style={{ marginTop: "1rem" }}>No documents yet — add one, then toggle “use documents” in the chat composer.</p>
      ) : (
        <ul className="creds" style={{ marginTop: "1rem" }}>
          {docs.map((d) => (
            <li key={d._id}>
              <span className="name">{d.title}</span>
              <span className="cred-actions">
                <span className="badge">{d.chunkCount} chunk{d.chunkCount === 1 ? "" : "s"}</span>
                <span className="mono muted" style={{ fontSize: ".72rem" }}>{(d.charCount / 1000).toFixed(1)}k chars</span>
                <button className="link danger" onClick={() => ask({ title: "Delete document?", message: `Delete "${d.title}"? It won't be retrievable anymore.`, run: () => deleteDoc({ docId: d._id as never }) })}>delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add document"
        size="md"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn accent" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? "embedding…" : "Add"}</button>
          </>
        }
      >
        <input placeholder="title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: ".6rem" }} />
        <textarea placeholder="paste the text to index…" value={text} onChange={(e) => setText(e.target.value)} rows={10} style={{ width: "100%" }} />
        {err != null && <ErrorLine e={err} isAdmin={false} />}
      </ResponsiveDialog>
      {confirmDialog}
    </section>
  );
}
