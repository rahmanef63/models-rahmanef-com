// Serves the drop-in widget JS. A customer adds one line to any site:
//   <script src="https://<host>/api/embed/widget" data-token="pk_…" async></script>
// The script is served from THIS host but runs on the customer's page, so its fetch to /api/embed
// carries the customer's Origin (which the endpoint checks against the embed's allowlist).
import { embedWidgetJs } from "@/lib/embed-widget";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";

export function GET(req: Request) {
  let base = "";
  try { base = new URL(publicOrigin(req)).origin; } catch { base = new URL(req.url).origin; }
  return new Response(embedWidgetJs(base), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*", // the script itself is public; the /api/embed calls are gated
    },
  });
}
