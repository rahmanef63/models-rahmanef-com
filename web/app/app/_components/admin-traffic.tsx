"use client";
// Admin · Traffic — cookieless visitor analytics from the self-hosted beacon:
// page views + referrers + geo (country/city via geoip). Two windows (7d/30d)
// off one query; charts are the shared pure-SVG/CSS primitives. SUPER-ADMIN only.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { fmt } from "./shared";
import { MiniBars, HBarList } from "./charts";

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="admin-block">
      <h3>{title}</h3>
      {sub && <p className="muted mono" style={{ fontSize: ".72rem", margin: "-.2rem 0 .5rem" }}>{sub}</p>}
      {children}
    </div>
  );
}

const WEEK = 7 * 24 * 60 * 60 * 1000;
const MONTH = 30 * 24 * 60 * 60 * 1000;

export function AdminTrafficCard() {
  const d7 = useQuery(api.pageviews.summary, { sinceMs: WEEK });
  const d30 = useQuery(api.pageviews.summary, { sinceMs: MONTH });
  return (
    <section className="card">
      <h2>Traffic <span className="badge oauth">SUPER</span></h2>
      <p className="sub">Cookieless, self-hosted beacon — page views + referrer + geo (kota via geoip). Tanpa cookie, tanpa IP tersimpan.</p>
      {d7 === undefined || d30 === undefined ? (
        <p className="muted mono">…</p>
      ) : (
        <>
          <section className="overview" style={{ marginTop: "1rem" }}>
            <div className="ov-tile"><div className="ov-num">{fmt(d7.total)}</div><div className="ov-lbl">views · 7d</div></div>
            <div className="ov-tile"><div className="ov-num">{fmt(d7.uniqueSessions)}</div><div className="ov-lbl">unique · 7d</div></div>
            <div className="ov-tile"><div className="ov-num">{fmt(d30.total)}</div><div className="ov-lbl">views · 30d</div></div>
            <div className="ov-tile"><div className="ov-num">{d30.topCountries[0]?.key ?? "—"}</div><div className="ov-lbl">top country</div></div>
          </section>

          <Panel title="Volume · 30d" sub={`${fmt(d30.total)} views`}>
            {d30.perDay.length ? (
              <MiniBars values={d30.perDay.map((p) => p.count)} labels={d30.perDay.map((p) => p.day)} />
            ) : (
              <p className="muted mono">Belum ada data.</p>
            )}
          </Panel>

          {d7.topPaths.length > 0 && (
            <Panel title="Top paths · 7d">
              <HBarList items={d7.topPaths.map((p) => ({ label: p.key, value: p.count }))} unit="×" />
            </Panel>
          )}
          {d7.topReferrers.length > 0 && (
            <Panel title="Top referrers · 7d">
              <HBarList items={d7.topReferrers.map((p) => ({ label: p.key, value: p.count }))} />
            </Panel>
          )}
          {d30.topCountries.length > 0 && (
            <Panel title="Top countries · 30d">
              <HBarList items={d30.topCountries.map((p) => ({ label: p.key, value: p.count }))} />
            </Panel>
          )}
          {d30.topCities.length > 0 && (
            <Panel title="Top cities · 30d">
              <HBarList items={d30.topCities.map((p) => ({ label: p.key, value: p.count }))} />
            </Panel>
          )}
          {(d7.capped || d30.capped) && (
            <p className="muted mono" style={{ fontSize: ".7rem", marginTop: ".75rem" }}>
              ⚠ Hard cap {fmt(10000)} baris tercapai — angka under-count. Tambah agregasi harian kalau trafik tumbuh.
            </p>
          )}
        </>
      )}
    </section>
  );
}
