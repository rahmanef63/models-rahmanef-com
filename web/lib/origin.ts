// Public origin resolver. Behind a proxy (Dokploy/Traefik) the Next standalone server sees
// http://0.0.0.0:3000, so `new URL(req.url).origin` is wrong there. Prefer SITE_URL, then the
// proxy's forwarded host, then the request origin (correct on Vercel).
export function publicOrigin(req: Request): string {
  const site = process.env.SITE_URL;
  if (site) return site.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://models.rahmanef.com";
  }
}
