"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

// The ONE overlay primitive for the whole app: a centered modal on desktop, a bottom-sheet drawer on
// mobile (≤640px, via CSS). Built on the native <dialog> — showModal() gives the ::backdrop scrim,
// focus-trap, Escape-to-close and inert background FOR FREE, so there's no hand-rolled scroll-lock or
// keydown listener. Every create / edit / confirm flow routes through this so they look + behave the
// same everywhere and reflow to a single column on mobile.
export function ResponsiveDialog({ open, onClose, title, children, footer, size = "sm", labelledBy }: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  // unmount the subtree when closed so create/edit forms mount fresh (reset) on each open
  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="rd"
      data-size={size}
      aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} // click on the backdrop area (dialog itself, not the panel)
    >
      <div className="rd-panel" role="document">
        <span className="rd-grab" aria-hidden />
        {title != null && (
          <div className="rd-head">
            <strong>{title}</strong>
            <button type="button" className="more-x" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
          </div>
        )}
        <div className="rd-body">{children}</div>
        {footer != null && <div className="rd-foot">{footer}</div>}
      </div>
    </dialog>
  );
}

// Hook so a card gets a confirm flow in 3 lines instead of hand-rolling state + a dialog each time:
//   const { ask, confirmDialog } = useConfirm();
//   <button onClick={() => ask({ title: "Delete?", message: "…", run: () => remove(id) })}>…</button>
//   {confirmDialog}
type ConfirmOpts = { title: ReactNode; message?: ReactNode; confirmLabel?: string; danger?: boolean; run: () => unknown };
export function useConfirm() {
  const [state, setState] = useState<ConfirmOpts | null>(null);
  const ask = useCallback((opts: ConfirmOpts) => setState(opts), []);
  const confirmDialog = (
    <ConfirmDialog
      open={!!state}
      onClose={() => setState(null)}
      onConfirm={() => { void state?.run(); }}
      title={state?.title ?? ""}
      message={state?.message}
      confirmLabel={state?.confirmLabel}
      danger={state?.danger}
    />
  );
  return { ask, confirmDialog };
}

// Confirm variant — retires one-click no-undo deletes and the app's stray native confirm() calls.
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Hapus", danger = true }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button type="button" className={danger ? "btn danger" : "btn accent"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </>
      }
    >
      {message != null && <p className="sub" style={{ margin: 0 }}>{message}</p>}
    </ResponsiveDialog>
  );
}
