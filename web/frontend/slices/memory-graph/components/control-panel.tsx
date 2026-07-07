"use client";

import { useState } from "react";
import type { GraphFilters, GraphSettings, GraphLabels, ClusterDef } from "../types";
import { ICONS } from "../config/icons";

// Right-side graph controls panel. Presentational only — all state lives above and flows in via
// props; user intent flows out via the on* callbacks. Section collapse is the one bit of local UI
// state (which drawers are open), which never needs to leave the component.

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mg-row">
      <span>{label}</span>
      <span className="mg-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="mg-slider" />
      </span>
    </label>
  );
}

function Range({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mg-range">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function ControlPanel({ labels, filters, settings, clusters, open, onClose, onReset, onFilters, onSettings, onToggleGroup }: {
  labels: GraphLabels;
  filters: GraphFilters;
  settings: GraphSettings;
  clusters: ClusterDef[];
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onFilters: (patch: Partial<GraphFilters>) => void;
  onSettings: (patch: Partial<GraphSettings>) => void;
  onToggleGroup: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState({ groups: true, display: false, forces: false });
  const toggle = (k: "groups" | "display" | "forces") => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  return (
    <aside className={`mg-panel ${open ? "" : "closed"}`} aria-label={labels.filters}>
      <div className="mg-panel-scroll">
        <div className="mg-panel-top">
          <div className="mg-panel-title">
            <span className="mg-chev">{ICONS.chevron}</span>
            {labels.filters}
          </div>
          <div className="mg-panel-actions">
            <button className="mg-panel-icon-btn" onClick={onReset} aria-label={labels.reset}>{ICONS.reset}</button>
            <button className="mg-panel-icon-btn" onClick={onClose} aria-label={labels.inspectClose}>{ICONS.close}</button>
          </div>
        </div>

        <div className="mg-search">
          {ICONS.search}
          <input
            className="mg-filter-input"
            value={filters.query}
            onChange={(e) => onFilters({ query: e.target.value })}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
          />
          <button className="mg-clear" onClick={() => onFilters({ query: "" })} aria-label="clear">×</button>
        </div>

        <section className="mg-section">
          <div className="mg-section-content">
            <Toggle label={labels.tags} checked={filters.tags} onChange={(v) => onFilters({ tags: v })} />
            <Toggle label={labels.attachments} checked={filters.attachments} onChange={(v) => onFilters({ attachments: v })} />
            <Toggle label={labels.existingOnly} checked={filters.existingOnly} onChange={(v) => onFilters({ existingOnly: v })} />
            <Toggle label={labels.orphans} checked={filters.orphans} onChange={(v) => onFilters({ orphans: v })} />
          </div>
        </section>

        <section className={`mg-section ${collapsed.groups ? "collapsed" : ""}`}>
          <button className="mg-section-head" onClick={() => toggle("groups")}>
            <span className="mg-chev">{ICONS.chevron}</span>
            {labels.groups}
          </button>
          <div className="mg-section-content">
            <div className="mg-group-grid">
              {clusters.map((c) => (
                <button
                  key={c.id}
                  className={`mg-group-chip ${filters.groups[c.id] !== false ? "active" : ""}`}
                  onClick={() => onToggleGroup(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={`mg-section ${collapsed.display ? "collapsed" : ""}`}>
          <button className="mg-section-head" onClick={() => toggle("display")}>
            <span className="mg-chev">{ICONS.chevron}</span>
            {labels.display}
          </button>
          <div className="mg-section-content">
            <Toggle label={labels.arrows} checked={settings.arrows} onChange={(v) => onSettings({ arrows: v })} />
            <Range label={labels.textFade} min={0} max={100} value={settings.textFade} onChange={(v) => onSettings({ textFade: v })} />
            <Range label={labels.nodeSize} min={70} max={145} value={settings.nodeSize} onChange={(v) => onSettings({ nodeSize: v })} />
            <Range label={labels.linkThickness} min={60} max={240} value={settings.linkThickness} onChange={(v) => onSettings({ linkThickness: v })} />
            <button
              className={`mg-animate ${settings.animate ? "on" : ""}`}
              onClick={() => onSettings({ animate: !settings.animate })}
            >
              {settings.animate ? labels.animateStop : labels.animate}
            </button>
          </div>
        </section>

        <section className={`mg-section ${collapsed.forces ? "collapsed" : ""}`}>
          <button className="mg-section-head" onClick={() => toggle("forces")}>
            <span className="mg-chev">{ICONS.chevron}</span>
            {labels.forces}
          </button>
          <div className="mg-section-content">
            <Range label={labels.centerForce} min={0} max={100} value={settings.centerForce} onChange={(v) => onSettings({ centerForce: v })} />
            <Range label={labels.repelForce} min={0} max={100} value={settings.repelForce} onChange={(v) => onSettings({ repelForce: v })} />
            <Range label={labels.linkForce} min={0} max={100} value={settings.linkForce} onChange={(v) => onSettings({ linkForce: v })} />
            <Range label={labels.linkDistance} min={80} max={260} value={settings.linkDistance} onChange={(v) => onSettings({ linkDistance: v })} />
          </div>
        </section>
      </div>
    </aside>
  );
}
