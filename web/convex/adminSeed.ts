// Admin bulk-seed: import a JSON bundle of agent presets into the admin's own account.
// SUPER-ADMIN ONLY. Idempotent — upserts by name (patch on match, insert on miss), so it's safe to
// re-run after editing the JSON. Mirrors CareerPack's EngineSeedPanel seed pattern; the closest
// catalog-shaped table here is agentDefs (no global preset table exists).
// ponytail: seeds into the admin's account (agentDefs is per-user). If shared "system" presets are
// ever needed, add a visibility:"system" agentDefs row + a global read — not built until asked.
import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./_shared/auth";
import { AGENT_TOOL_IDS } from "./toolRegistry";
import { SKILL_IDS } from "./skillsRegistry";

const MAX_PRESETS = 50;

const clampSteps = (n: number | undefined) => {
  const v = n === undefined || !Number.isFinite(n) ? 8 : Math.round(n);
  return Math.min(20, Math.max(1, v));
};
const clampTemp = (n: number | undefined) =>
  n === undefined || !Number.isFinite(n) ? undefined : Math.min(2, Math.max(0, n));

export const adminSeedAgentPresets = mutation({
  args: {
    overwrite: v.optional(v.boolean()), // patch existing same-name presets (default true); false = skip them
    presets: v.array(
      v.object({
        name: v.string(),
        model: v.string(), // "provider/model"
        instructions: v.optional(v.string()),
        tools: v.optional(v.array(v.string())),
        skills: v.optional(v.array(v.string())),
        maxSteps: v.optional(v.number()),
        temperature: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, a) => {
    const userId = await requireAdmin(ctx);
    if (a.presets.length > MAX_PRESETS)
      throw new ConvexError({ code: "invalid_request", detail: `Max ${MAX_PRESETS} presets per seed` });
    const overwrite = a.overwrite ?? true;

    // admin's own agents, keyed by name for upsert. Bounded — an operator won't have thousands.
    const existing = await ctx.db.query("agentDefs").withIndex("by_user", (q) => q.eq("userId", userId)).take(500);
    const byName = new Map(existing.map((r) => [r.name.trim().toLowerCase(), r._id]));

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    const now = Date.now();

    for (const p of a.presets) {
      const name = p.name.trim().slice(0, 60);
      if (!name) { errors.push("(unnamed preset skipped)"); continue; }
      const model = p.model.trim();
      const slash = model.indexOf("/");
      if (slash < 1 || slash === model.length - 1) { errors.push(`${name}: model must be "provider/model"`); continue; }
      const badTool = (p.tools ?? []).find((t) => !AGENT_TOOL_IDS.includes(t));
      if (badTool) { errors.push(`${name}: unknown tool "${badTool}"`); continue; }
      const badSkill = (p.skills ?? []).find((s) => !SKILL_IDS.includes(s));
      if (badSkill) { errors.push(`${name}: unknown skill "${badSkill}"`); continue; }

      const fields = {
        model,
        instructions: p.instructions?.trim() ? p.instructions.trim().slice(0, 4000) : undefined,
        tools: [...new Set(p.tools ?? [])],
        skills: [...new Set(p.skills ?? [])],
        maxSteps: clampSteps(p.maxSteps),
        temperature: clampTemp(p.temperature),
        updatedAt: now,
      };
      const hit = byName.get(name.toLowerCase());
      if (hit) {
        if (!overwrite) { skipped++; continue; }
        await ctx.db.patch(hit, fields);
        updated++;
      } else {
        const id = await ctx.db.insert("agentDefs", { userId, name, createdAt: now, ...fields });
        byName.set(name.toLowerCase(), id);
        inserted++;
      }
    }
    return { inserted, updated, skipped, errors };
  },
});
