import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/convex-provider";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600"], style: ["normal", "italic"] });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "700"] });

// Server-only env — never inlined into the client bundle, safe to read directly here. A
// misconfigured SITE_URL (e.g. missing the scheme) must NOT crash metadata evaluation for the
// whole app — this runs at module scope, so an unguarded `new URL()` here fails every request.
function siteUrl(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  try { return new URL(raw).toString(); } catch { return "http://localhost:3000"; }
}
const SITE_URL = siteUrl();

export const metadata: Metadata = {
  title: "models — bring your own key",
  description: "A multi-tenant bring-your-own-key AI gateway. Sign in with OpenAI, Claude, or OpenRouter — or paste any key — then chat, run agents, and expose your own MCP server. 23 providers, distilled from openclaw & hermes.",
  metadataBase: new URL(SITE_URL),
  openGraph: { title: "models — bring your own key", description: "Every model. Your keys. One dashboard.", url: SITE_URL, type: "website" },
  twitter: { card: "summary_large_image", title: "models — bring your own key", description: "Every model. Your keys. One dashboard.", images: ["/opengraph-image.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
