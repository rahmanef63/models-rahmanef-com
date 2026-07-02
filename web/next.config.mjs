/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    // App-wide defense-in-depth. frame-ancestors 'none' + DENY make the OAuth consent screen
    // (and everything else) un-iframeable — kills the clickjacking path to /oauth/authorize.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
