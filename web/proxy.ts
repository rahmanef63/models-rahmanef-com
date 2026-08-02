// Next 16 renamed middleware.ts -> proxy.ts. convexAuthNextjsMiddleware works verbatim.
import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// By default this middleware treats ANY GET+html request carrying a `?code=` param as ITS OWN
// OAuth/magic-link callback and tries to exchange it via Convex's `auth:signIn` — we only
// registered the Password provider, so that exchange always fails, which CLEARS the user's
// session cookies and short-circuits the response before our own route handler ever runs. Our
// OpenRouter connect flow also redirects back with `?code=` (a completely unrelated code, meant
// for /oauth/openrouter/callback to exchange with OpenRouter itself) — same query param name,
// direct collision. Exempt our own callback route so Convex Auth leaves its `code` alone.
export default convexAuthNextjsMiddleware(undefined, {
  shouldHandleCode: (request) => request.nextUrl.pathname !== "/oauth/openrouter/callback",
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
