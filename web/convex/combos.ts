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

// Edit a combo in place — name + refs + strategy (+ stickyLimit). Reuses validate(); resets the
// round_robin cursor since refs may shrink. Supersedes the old rename-only path.
export const updateCombo = mutation({
  args: { workspaceId: v.id("workspaces"), comboId: v.id("combos"), name: v.string(), refs: v.array(v.string()), strategy: v.string(), stickyLimit: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const row = await ctx.db.get(a.comboId);
    if (!row || row.workspaceId !== a.workspaceId) throw new ConvexError({ code: "not_found", detail: "combo not found" });
    const { slug, cleaned } = validate(a.name, a.refs, a.strategy);
    const clash = await ctx.db.query("combos").withIndex("by_ws_name", (q) => q.eq("workspaceId", a.workspaceId).eq("name", slug)).unique();
    if (clash && clash._id !== a.comboId) throw new ConvexError({ code: "conflict", detail: `A combo named "${slug}" already exists.` });
    await ctx.db.patch(a.comboId, { name: slug, refs: cleaned, strategy: a.strategy, stickyLimit: Math.max(1, a.stickyLimit ?? row.stickyLimit ?? 1), rotationIndex: 0, updatedAt: Date.now() });
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

// ── gateway-tool backends (explicit userId+workspaceId, pre-authorized by the caller like
// resolveCombo/checkSpendCap). combo_list is read-only; combo_write requires member+ because an MCP
// token can belong to a viewer whom mcpNode only membership-checks, not role-checks. ──
export const _forUser = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
  handler: async (ctx, a) =>
    (await ctx.db.query("combos").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(100))
      .map((c) => ({ name: c.name, refs: c.refs, strategy: c.strategy })),
});

export const _upsertForUser = internalMutation({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces"), name: v.string(), refs: v.array(v.string()), strategy: v.string() },
  handler: async (ctx, a): Promise<string> => {
    const m = await ctx.db.query("memberships").withIndex("by_ws_user", (q) => q.eq("workspaceId", a.workspaceId).eq("userId", a.userId)).unique();
    if (!m || m.role === "viewer") return "You need member access to write combos in this workspace.";
    const { slug, cleaned } = validate(a.name, a.refs, a.strategy);
    const existing = await ctx.db.query("combos").withIndex("by_ws_name", (q) => q.eq("workspaceId", a.workspaceId).eq("name", slug)).unique();
    if (existing) { await ctx.db.patch(existing._id, { refs: cleaned, strategy: a.strategy, rotationIndex: 0, updatedAt: Date.now() }); return `Updated combo "${slug}".`; }
    await ctx.db.insert("combos", { userId: a.userId, workspaceId: a.workspaceId, name: slug, refs: cleaned, strategy: a.strategy, rotationIndex: 0, stickyLimit: 1, createdAt: Date.now(), updatedAt: Date.now() });
    return `Created combo "${slug}" (${a.strategy}) → ${cleaned.join(", ")}. Target it as combo/${slug}.`;
  },
});

// ── resolution (internal; callForUser resolveModelRef calls this before the provider split) ──
// Returns { ref: "provider/model", comboId, strategy }, or null when the name is unknown.
//   fallback    → refs[0] (error-fallback across the rest is provider-pool 2.3, not yet wired).
//   round_robin → refs[rotationIndex % refs.length]; callForUser calls bumpRotation after the pick
//                 so the cursor actually advances (per-call rotation; stickyLimit reserved for later).
export const resolveCombo = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), name: v.string() },
  handler: async (ctx, a) => {
    const combo = a.workspaceId
      ? await ctx.db.query("combos").withIndex("by_ws_name", (q) => q.eq("workspaceId", a.workspaceId).eq("name", a.name)).unique()
      : (await ctx.db.query("combos").withIndex("by_user", (q) => q.eq("userId", a.userId)).take(100)).find((c) => c.name === a.name) ?? null;
    if (!combo || !combo.refs.length) return null;
    const ref = combo.strategy === "round_robin"
      ? combo.refs[(combo.rotationIndex ?? 0) % combo.refs.length]
      : combo.refs[0]; // fallback
    return { ref, comboId: combo._id, strategy: combo.strategy };
  },
});

// Advance a round_robin combo's cursor by one (mod refs.length). Separate from resolveCombo because
// an internalQuery can't write; callForUser wires this after EACH round_robin pick (per-call
// rotation; stickyLimit is stored but reserved). No-op for fallback combos. OCC-safe (single-row patch).
export const bumpRotation = internalMutation({
  args: { comboId: v.id("combos") },
  handler: async (ctx, a) => {
    const combo = await ctx.db.get(a.comboId);
    if (!combo || combo.strategy !== "round_robin" || !combo.refs.length) return;
    await ctx.db.patch(a.comboId, { rotationIndex: ((combo.rotationIndex ?? 0) + 1) % combo.refs.length, updatedAt: Date.now() });
  },
});
