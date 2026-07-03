// Saved, reusable AI Agent configs — name × model × instructions × tools × maxSteps × temperature.
// The actual run loop lives in chat.ts (runAgent); this file is the deterministic CRUD half,
// mirroring credentials.ts's ownership pattern (userId always from getAuthUserId, never the client).
import { query, mutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./_shared/auth";
import { TOOL_REGISTRY, TOOL_IDS } from "./toolRegistry";

const MAX_STEPS_MIN = 1;
const MAX_STEPS_MAX = 20;
const MAX_STEPS_DEFAULT = 8;

// `??` doesn't catch NaN (only null/undefined) and Math.min/max/round all propagate it — a NaN
// maxSteps would silently defeat stepCountIs()'s stop condition (n === NaN is always false).
function clampMaxSteps(n: number | undefined): number {
  const v = n === undefined || !Number.isFinite(n) ? MAX_STEPS_DEFAULT : Math.round(n);
  return Math.min(MAX_STEPS_MAX, Math.max(MAX_STEPS_MIN, v));
}
function clampTemperature(n: number | undefined): number | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined;
  return Math.min(2, Math.max(0, n));
}
function validateName(name: string): string {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new ConvexError({ code: "invalid_request", detail: "name required" });
  return trimmed;
}
function validateModel(model: string): string {
  const trimmed = model.trim();
  const i = trimmed.indexOf("/");
  if (i < 1 || i === trimmed.length - 1) throw new ConvexError({ code: "invalid_request", detail: 'model must be "provider/model"' });
  return trimmed;
}
function validateTools(tools: string[]): string[] {
  const bad = tools.filter((t) => !TOOL_IDS.includes(t));
  if (bad.length) throw new ConvexError({ code: "invalid_request", detail: `Unknown tool(s): ${bad.join(", ")}` });
  return [...new Set(tools)];
}

export const listToolRegistry = query({
  args: {},
  handler: () => TOOL_REGISTRY,
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("agentDefs").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    instructions: v.optional(v.string()),
    tools: v.array(v.string()),
    maxSteps: v.optional(v.number()),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    return ctx.db.insert("agentDefs", {
      userId,
      name: validateName(a.name),
      model: validateModel(a.model),
      instructions: a.instructions?.trim() ? a.instructions.trim().slice(0, 4000) : undefined,
      tools: validateTools(a.tools),
      maxSteps: clampMaxSteps(a.maxSteps),
      temperature: clampTemperature(a.temperature),
      createdAt: now,
      updatedAt: now,
    });
  },
});

// instructions/temperature use `v.null()` as an explicit "clear this field" sentinel — Convex's
// client-side arg serializer silently DROPS any key whose value is `undefined` before it reaches
// the wire, so "field omitted" (leave unchanged) and "field cleared" are otherwise indistinguishable.
export const update = mutation({
  args: {
    id: v.id("agentDefs"),
    name: v.optional(v.string()),
    model: v.optional(v.string()),
    instructions: v.optional(v.union(v.string(), v.null())),
    tools: v.optional(v.array(v.string())),
    maxSteps: v.optional(v.number()),
    temperature: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(a.id);
    if (!row || row.userId !== userId) throw new ConvexError({ code: "not_found", detail: "Agent not found" });
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (a.name !== undefined) patch.name = validateName(a.name);
    if (a.model !== undefined) patch.model = validateModel(a.model);
    if (a.instructions !== undefined) patch.instructions = a.instructions === null || !a.instructions.trim() ? undefined : a.instructions.trim().slice(0, 4000);
    if (a.tools !== undefined) patch.tools = validateTools(a.tools);
    if (a.maxSteps !== undefined) patch.maxSteps = clampMaxSteps(a.maxSteps);
    if (a.temperature !== undefined) patch.temperature = a.temperature === null ? undefined : clampTemperature(a.temperature);
    await ctx.db.patch(a.id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("agentDefs") },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(a.id);
    if (!row || row.userId !== userId) return; // idempotent delete, matches deleteCredential
    await ctx.db.delete(a.id);
  },
});

// internal: ownership-checked fetch for chat.ts's runAgent (userId comes from its own auth check).
export const getOwned = internalQuery({
  args: { userId: v.id("users"), id: v.id("agentDefs") },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row || row.userId !== a.userId) return null;
    return row;
  },
});
