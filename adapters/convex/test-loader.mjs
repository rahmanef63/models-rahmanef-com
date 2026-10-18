// Test-only resolution for Convex's extensionless TypeScript imports; no codegen or deployment.
export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes("/adapters/convex/")) {
    if (specifier === "./_generated/server") return nextResolve(new URL("../../web/convex/_generated/server.js", context.parentURL).href, context);
    if (specifier.startsWith("convex/")) return nextResolve(specifier, { ...context, parentURL: new URL("../../web/package.json", context.parentURL).href });
  }
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
    for (const extension of [".ts", ".js"]) {
      try { return await nextResolve(specifier + extension, context); } catch { /* next extension */ }
    }
    throw error;
  }
}
