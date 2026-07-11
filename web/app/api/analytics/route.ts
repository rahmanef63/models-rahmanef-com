// Cookieless visitor beacon ingest. The client posts via navigator.sendBeacon;
// we resolve geo from the caller IP (geoip-lite — offline, no MaxMind, no
// external call), hash the IP into a rate-limit bucket key, then DISCARD the raw
// IP (never sent to Convex, never stored). Fire-and-forget → always 204.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { clientIp, publicOrigin } from "@/lib/origin";
import { createHash } from "node:crypto";

export const runtime = "nodejs"; // geoip-lite reads its .dat data files via fs

// geoip-lite loads its .dat data files at MODULE-EVAL time and ships WITHOUT them (they need a
// postinstall fetch), so a top-level import crashes the Next build's page-data collection when the
// data is absent. Load it lazily + guarded so the route always builds and runs — geo just stays empty
// until the data files are present (page views still record fine without it).
type Geo = { country?: string; region?: string; city?: string; ll?: [number, number] } | null;
let geoip: { lookup: (ip: string) => Geo } | null | undefined;
async function lookupGeo(ip: string): Promise<Geo> {
  if (geoip === undefined) {
    // @types/geoip-lite uses `export =`, so the runtime shape is the namespace (or .default under interop)
    try { const m: any = await import("geoip-lite"); geoip = m.default ?? m; } catch { geoip = null; }
  }
  try { return geoip?.lookup(ip) ?? null; } catch { return null; }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
const VIEWPORTS = new Set(["mobile", "tablet", "desktop"]);
const str = (x: unknown, max: number): string | undefined =>
  typeof x === "string" && x ? x.slice(0, max) : undefined;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 204 });
  }

  const path = str(body?.path, 256);
  // Never track the signed-in console or API routes.
  if (!path || path.startsWith("/app") || path.startsWith("/api")) {
    return new Response(null, { status: 204 });
  }

  // referrer → host, dropping own-host self-referrals (SPA nav is same-origin).
  let referrerHost: string | undefined;
  const ref = str(body?.referrer, 300);
  if (ref) {
    try {
      const u = new URL(ref);
      const ownHost = new URL(publicOrigin(req)).host;
      if (u.host && u.host !== ownHost) referrerHost = u.host.slice(0, 80);
    } catch {
      /* malformed referrer — ignore */
    }
  }

  const ip = clientIp(req);
  const geo = ip && ip !== "?" ? await lookupGeo(ip) : null;
  const ipHash = ip && ip !== "?" ? createHash("sha256").update(ip).digest("hex") : undefined;

  const client = new ConvexHttpClient(CONVEX_URL);
  void client
    .mutation(api.pageviews.record, {
      path,
      referrerHost,
      viewport: VIEWPORTS.has(body?.viewport as string) ? (body.viewport as string) : undefined,
      eventType: str(body?.eventType, 40),
      sessionId: str(body?.sessionId, 64),
      utmSource: str(body?.utmSource, 120),
      utmMedium: str(body?.utmMedium, 120),
      utmCampaign: str(body?.utmCampaign, 120),
      utmTerm: str(body?.utmTerm, 120),
      utmContent: str(body?.utmContent, 120),
      country: geo?.country || undefined,
      region: geo?.region || undefined,
      city: geo?.city || undefined,
      lat: geo?.ll?.[0],
      lon: geo?.ll?.[1],
      properties: str(body?.properties, 2000),
      ipHash,
    })
    .catch(() => {});

  return new Response(null, { status: 204 });
}
