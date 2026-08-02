"use client";
import { type Dispatch, type RefObject, type SetStateAction } from "react";
import { Paperclip, BookOpen, Send, X } from "lucide-react";
import { AgentMentionPicker, type MentionAgent } from "./agent-mention";
import { SkillMentionPicker } from "./skill-mention";

const MENTION_RE = /@(\w*)$/;
const SKILL_RE = /\/(\w*)$/;
type Skill = { id: string; label: string; description: string; instructions: string };
type Img = { id: string; preview: string };

// The chat composer footer: armed-skill/image chips, the @agent + /skill pickers, the textarea, and
// the attach / RAG-toggle / send controls. Extracted from WorkbenchCard to keep both under the 200-LOC
// cap (rr) and because the composer is a cohesive, self-contained unit.
export function WbComposer({
  input, setInput, onSend, busy, rebinding, fileRef, onFiles,
  useRag, setUseRag, pendingSkillIds, setPendingSkillIds, skillDefs,
  pendingImages, setPendingImages, mentionAgents, onPickMention, onPickSkill,
}: {
  input: string; setInput: Dispatch<SetStateAction<string>>; onSend: () => void; busy: boolean; rebinding: boolean;
  fileRef: RefObject<HTMLInputElement | null>; onFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  useRag: boolean; setUseRag: Dispatch<SetStateAction<boolean>>;
  pendingSkillIds: string[]; setPendingSkillIds: Dispatch<SetStateAction<string[]>>; skillDefs: Skill[] | undefined;
  pendingImages: Img[]; setPendingImages: Dispatch<SetStateAction<Img[]>>;
  mentionAgents: MentionAgent[]; onPickMention: (id: string) => void; onPickSkill: (id: string) => void;
}) {
  const mentionMatch = input.match(MENTION_RE);
  const skillMatch = input.match(SKILL_RE);
  const canSend = !!input.trim() || pendingImages.length > 0;
  return (
    <div className="wb-composer-wrap">
      {pendingSkillIds.length > 0 && (
        <div className="wb-skill-chips" style={{ display: "flex", gap: ".3rem", flexWrap: "wrap", marginBottom: ".4rem" }}>
          {pendingSkillIds.map((id) => {
            const s = skillDefs?.find((x) => x.id === id);
            return <button key={id} type="button" className="badge" onClick={() => setPendingSkillIds((ids) => ids.filter((x) => x !== id))}>/{s?.label ?? id} <X size={11} /></button>;
          })}
        </div>
      )}
      {pendingImages.length > 0 && (
        <div className="wb-img-chips">
          {pendingImages.map((img, i) => (
            <span key={img.id} className="wb-img-chip">
              <img src={img.preview} alt="" />
              <button type="button" onClick={() => setPendingImages((imgs) => imgs.filter((_, j) => j !== i))} aria-label="remove image"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="wb-composer" style={{ position: "relative" }}>
        {mentionMatch && mentionAgents.length > 0 && <AgentMentionPicker agents={mentionAgents} query={mentionMatch[1]} onPick={onPickMention} />}
        {skillMatch && (skillDefs?.length ?? 0) > 0 && <SkillMentionPicker skills={skillDefs!} query={skillMatch[1]} onPick={onPickSkill} />}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        <button type="button" className="wb-attach" title="Attach image (vision models)" aria-label="Attach image" onClick={() => fileRef.current?.click()}><Paperclip size={16} /></button>
        <button type="button" className={`wb-attach ${useRag ? "on" : ""}`} title="Use my Knowledge documents (RAG)" aria-pressed={useRag} onClick={() => setUseRag((v) => !v)}><BookOpen size={16} /></button>
        <textarea rows={2} placeholder="message  ·  @ agent  ·  / skill  ·  (⌘/Ctrl+Enter to send)" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend(); }} />
        <button className="btn accent wb-send" disabled={busy || rebinding || !canSend} onClick={onSend} aria-label="Send" title="Send (⌘/Ctrl+Enter)">{busy || rebinding ? "…" : <Send size={16} />}</button>
      </div>
    </div>
  );
}
