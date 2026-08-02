"use client";
import { type ChangeEvent, type RefObject } from "react";
import { ICONS } from "../config/icons";
import { type GraphLabels } from "../types";

// Top-left brand + top-right actions (toggle controls panel, import a memory file).
export function GraphTopbar({ labels, controlsOn, onToggleControls, fileRef, onFile }: {
  labels: GraphLabels;
  controlsOn: boolean;
  onToggleControls: () => void;
  fileRef: RefObject<HTMLInputElement | null>;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <header className="mg-topbar">
      <div className="mg-brand">{labels.brand}</div>
      <div className="mg-actions">
        <button className={`mg-icon-btn ${controlsOn ? "on" : ""}`} type="button" onClick={onToggleControls} aria-label={labels.filters} aria-pressed={controlsOn}>{ICONS.controls}</button>
        <button className="mg-import-btn" type="button" onClick={() => fileRef.current?.click()} aria-label={labels.importLabel}>
          {ICONS.import}<span>{labels.importLabel}</span>
        </button>
        <input ref={fileRef} type="file" hidden accept=".json,.txt" onChange={onFile} />
      </div>
    </header>
  );
}
