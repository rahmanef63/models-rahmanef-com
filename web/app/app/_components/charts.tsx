"use client";
// Pure-SVG/CSS chart primitives — no chart library (ponytail: a dependency for what ~80 lines of
// inline SVG does). Theme-aware via currentColor / --accent tokens. All take plain number arrays.
import { fmt } from "./shared";

// Filled area + line over a series. Great for signups / requests over time.
export function Sparkline({ values, labels, height = 44, unit = "" }: { values: number[]; labels?: string[]; height?: number; unit?: string }) {
  const w = 100, n = values.length;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [n <= 1 ? 0 : (i / (n - 1)) * w, height - (v / max) * (height - 4) - 2] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height }} role="img" aria-label={`series, max ${max}`}>
      <path className="spark-area" d={area} />
      <path className="spark-line" d={line} />
      {labels && (
        <title>{labels.map((l, i) => `${l}: ${fmt(values[i])}${unit}`).join("\n")}</title>
      )}
    </svg>
  );
}

// Vertical bars (reuses the .bars/.bar CSS from the usage card). Hover shows label + value.
export function MiniBars({ values, labels, unit = "" }: { values: number[]; labels: string[]; unit?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="bars" role="img" aria-label={`${values.length} bars`}>
      {values.map((v, i) => (
        <div key={i} className="bar" style={{ height: `${Math.round((v / max) * 100)}%` }} title={`${labels[i]}: ${fmt(v)}${unit}`} />
      ))}
    </div>
  );
}

// Horizontal proportional bar list — name · bar · value. For top-models / provider-mix breakdowns.
export function HBarList({ items, unit = "" }: { items: { label: string; value: number }[]; unit?: string }) {
  if (items.length === 0) return null;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="hbars">
      {items.map((it) => (
        <li key={it.label} className="hbar">
          <span className="hbar-label mono" title={it.label}>{it.label}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(it.value / max) * 100}%` }} /></span>
          <span className="hbar-val mono muted">{fmt(it.value)}{unit}</span>
        </li>
      ))}
    </ul>
  );
}
