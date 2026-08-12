"use client";
/* A value the user has to get out of the page and into somewhere else: a device
   code to type at a vendor's site, a bearer shown exactly once, a webhook URL.
   Six of these existed and not one was copyable — every user was select-dragging
   a 1.7rem letter-spaced code by hand.
 *
 * Not a button ON a value but a value that IS copyable, so the affordance can
 * never drift away from the thing it copies. */
import { useEffect, useRef, useState } from "react";

export function CopyField({
  value,
  className = "devicecode",
  style,
  label = "copy",
}: {
  value: string;
  className?: string;
  style?: React.CSSProperties;
  /** Announced to screen readers as "copy <label>" — say what, not just "copy". */
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  // A pending "copied" reset must not fire into an unmounted component — these
  // live inside flows that disappear the moment the sign-in completes.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (s: "copied" | "failed") => {
    setState(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  };

  async function copy() {
    try {
      // Absent on insecure origins and when the user denies the permission.
      // Falling back to selecting the text beats a dead button: the value is
      // still one Ctrl+C away and the user can see that it worked.
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      flash("copied");
    } catch {
      const node = valueRef.current;
      if (node && window.getSelection) {
        const r = document.createRange();
        r.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      flash("failed");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", ...style }}>
      <span ref={valueRef} className={className}>{value}</span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`copy ${label}`}
        title={`copy ${label}`}
        style={{
          padding: ".3rem .6rem", borderRadius: 3, cursor: "pointer",
          border: "1px solid var(--line-2)", background: "var(--bg-3)",
          color: state === "copied" ? "var(--accent)" : "var(--muted)",
          fontSize: ".72rem", letterSpacing: ".04em", whiteSpace: "nowrap",
        }}
      >
        {state === "copied" ? "copied ✓" : state === "failed" ? "select + ⌘C" : "copy"}
      </button>
      {/* the visual flash is not enough on its own for a screen reader */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? `${label} copied` : state === "failed" ? `${label} selected — press control C` : ""}
      </span>
    </div>
  );
}
