// Generic display formatters shared across dashboard cards — compact numbers + relative/absolute
// time. No domain, no deps. Part of the `core` slice so any feature can use them copy-clean.

export const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

// relative "3m ago" — admin lists (users, activity) show elapsed time next to the absolute instant.
export const ago = (t: number) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// absolute local "2026-07-10 14:32" — the "detail the exact hour a user signed up" ask.
export const dt = (t: number) => {
  const d = new Date(t), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
