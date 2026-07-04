// combos — model-ref indirection. A client targets one stable `combo/<name>` that maps to several
// concrete "provider/model" refs; `strategy` picks which at call time. CRUD is workspace-scoped
// ('member' to write, 'viewer' to read); resolveCombo is the internal read callForUser uses.
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";

const STRATEGIES = new Set(["fallback", "round_robin"]);
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
// a valid ref is "provider/model" — a "/" that is neither first nor last char.
const isRef = (r: string) => { const i = r.indexOf("/"); return i > 0 && i < r.length - 1; };

function validate(name: string, refs: string[], strategy: string) {
  const slug = slugify(name);
  if (!slug) throw new ConvexError({ code: "invalid_request", detail: "name required" });
  const cleaned = refs.map((r) => r.trim()).filter(Boolean);
  if (!cleaned.length) throw new ConvexError({ code: "invalid_request", detail: "at least one model ref required" });
  if (cleaned.length > 5) throw new ConvexError({ code: "invalid_request", detail: "at most 5 model refs" });
  const bad = cleaned.find((r) => !isRef(r));
  if (bad) throw new ConvexError({ code: "invalid_request", detail: `ref must be "provider/model": "${bad}"` });
  if (!STRATEGIES.has(strategy)) throw new ConvexError({ code: "invalid_request", detail: "strategy must be fallback|round_robin" });
  return { slug, cleaned };
}

const view = (c: any) => ({ id: c._id, name: c.name, refs: c.refs, strategy: c.strategy, stickyLimit: c.stickyLimit ?? 1, createdAt: c.createdAt });

// ── CRUD ──
export const listCombos = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "viewer");
    const rows = await ctx.db.query("combos").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(100);
    return rows.sort((x, y) => y.createdAt - x.createdAt).map(view);
  },
});

export const createCombo = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string(), refs: v.array(v.string()), strategy: v.string(), stickyLimit: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const { userId } = await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const { slug, cleaned } = validate(a.name, a.refs, a.strategy);
    const existing = await ctx.db.query("combos").withIndex("by_ws_name", (q) => q.eq("workspaceId", a.workspaceId).eq("name", slug)).unique();
    if (existing) throw new ConvexError({ code: "conflict", detail: `A combo named "${slug}" already exists.` });
    const now = Date.now();
    return await ctx.db.insert("combos", { userId, workspaceId: a.workspaceId, name: slug, refs: cleaned, strategy: a.strategy, rotationIndex: 0, stickyLimit: Math.max(1, a.stickyLimit ?? 1), createdAt: now, updatedAt: now });
  },
});

export const renameCombo = mutation({
  args: { workspaceId: v.id("workspaces"), comboId: v.id("combos"), name: v.string() },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const row = await ctx.db.get(a.comboId);
    if (!row || row.workspaceId !== a.workspaceId) throw new ConvexError({ code: "not_found", detail: "combo not found" });
    const slug = slugify(a.name);
    if (!slug) throw new ConvexError({ code: "invalid_request", detail: "name required" });
    const clash = await ctx.db.query("combos").withIndex("by_ws_name", (q) => q.eq("workspaceId", a.workspaceId).eq("name", slug)).unique();
    if (clash && clash._id !== a.comboId) throw new ConvexError({ code: "conflict", detail: `A combo named "${slug}" already exists.` });
    await ctx.db.patch(a.comboId, { name: slug, updatedAt: Date.now() });
  },
});

export const removeCombo = mutation({
  args: { workspaceId: v.id("workspaces"), comboId: v.id("combos") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const row = await ctx.db.get(a.comboId);
    if (!row || row.workspaceId !== a.workspaceId) return; // idempotent delete
    await ctx.db.delete(a.comboId);
  },
});

// ── resolution (internal; callForUser resolveModelRef calls this before the provider split) ──
// Returns a concrete "provider/model", or null when the name is unknown.
//   fallback    → refs[0] (error-fallback across the rest is provider-pool 2.3, not yet wired).
//   round_robin → refs[rotationIndex % refs.length]. Advance via internal.combos.bumpRotation.
export const resolveCombo = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), name: v.string() },
  handler: async (ctx, a) => {
    const combo = a.workspaceId
      ? await ctx.db.query("combos").withIndex("by_ws_name", (q) => q.eq("workspaceId", a.workspaceId).eq("name", a.name)).unique()
      : (await ctx.db.query("combos").withIndex("by_user", (q) => q.eq("userId", a.userId)).take(100)).find((c) => c.name === a.name) ?? null;
    if (!combo || !combo.refs.length) return null;
    if (combo.strategy === "round_robin") return combo.refs[(combo.rotationIndex ?? 0) % combo.refs.length];
    return combo.refs[0]; // fallback
  },
});

// Advance a round_robin combo's cursor by one (mod refs.length). Separate from resolveCombo because
// an internalQuery can't write; a caller wires this after a successful round_robin pick when the
// stickyLimit window elapses. No-op for fallback combos. OCC-safe (single-row patch).
export const bumpRotation = internalMutation({
  args: { comboId: v.id("combos") },
  handler: async (ctx, a) => {
    const combo = await ctx.db.get(a.comboId);
    if (!combo || combo.strategy !== "round_robin" || !combo.refs.length) return;
    await ctx.db.patch(a.comboId, { rotationIndex: ((combo.rotationIndex ?? 0) + 1) % combo.refs.length, updatedAt: Date.now() });
  },
});
