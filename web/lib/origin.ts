// Public origin resolver. Behind a proxy (Dokploy/Traefik) the Next standalone server sees
// http://0.0.0.0:3000, so `new URL(req.url).origin` is wrong there. Prefer SITE_URL, then the
// proxy's forwarded host, then the request origin (correct on Vercel), then whatever this
// deployment's own env says its public origin is — no hardcoded domain, so this stays correct
// if this app is ever deployed under a different host.
export function publicOrigin(req: Request): string {
  const site = process.env.SITE_URL;
  if (site) return site.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  }
}

// Caller IP for rate-limiting. SECURITY: never trust the LEFTMOST x-forwarded-for hop — a client
// can prepend a forged value and the trusted proxy only APPENDS the real peer after it, so [0] is
// attacker-controlled (rotate it → a fresh rate-limit bucket every request → limiter defeated).
// Trust x-real-ip (the reverse proxy overwrites it; not client-appendable) or the RIGHTMOST XFF
// entry (the hop our own proxy added). "?" groups header-less callers into one conservative bucket.
// ponytail: assumes ONE trusted proxy (Traefik/Dokploy). If a CDN (Cloudflare) ever fronts this,
// switch to its trusted client header (CF-Connecting-IP) or a fixed trusted-hop count from the right.
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "?";
}
