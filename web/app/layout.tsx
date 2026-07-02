import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/convex-provider";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600"], style: ["normal", "italic"] });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "models — bring your own key",
  description: "A bring-your-own-key model gateway. Sign in with OpenAI or OpenRouter, or paste any key, then call any model. Distilled from openclaw & hermes.",
  metadataBase: new URL("https://models.rahmanef.com"),
  openGraph: { title: "models — bring your own key", description: "Every model. Your keys. One dashboard.", url: "https://models.rahmanef.com", type: "website" },
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
