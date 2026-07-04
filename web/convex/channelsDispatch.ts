"use node";
// Shared channel model-turn. Resolve the bound agent (or the channel's fallback model) → callForUser
// (the ONE cred/spend pipeline) → reply text. Every adapter (telegram/slack/whatsapp/discord) calls
// this so their model paths can't diverge. `cx` is channelsIngest._getDispatchContext's return shape.
import { internal } from "./_generated/api";
import { callForUser } from "./callForUser";
import { gatewayTools } from "./chatTools";
import { SKILLS_REGISTRY } from "./skillsRegistry";

const NOT_CONFIGURED =
  "This channel isn't configured yet — bind an agent or set a model in the workspace admin.";

// one-time hint for a sender the allowlist doesn't cover — includes their id so the owner can add it.
export const notAuthorizedText = (externalUserId: string) =>
  `You're not authorized to use this bot yet. Ask the owner to add you — your id is: ${externalUserId}`;

// Returns { configured:false } when nothing is bound (caller sends the hint but skips the out-log),
// else { configured:true, reply } with the model text (or a friendly error string on model failure).
export async function computeReply(
  ctx: any,
  cx: any,
  channelId: any,
): Promise<{ configured: boolean; reply: string }> {
  let modelRef: string | undefined = cx.model;
  let agentOpts: any = undefined;
  if (cx.agent) {
    modelRef = cx.agent.model;
    const skillText = (cx.agent.skills ?? [])
      .map((id: string) => SKILLS_REGISTRY.find((s) => s.id === id)?.instructions)
      .filter(Boolean)
      .join("\n\n");
    const system = [cx.agent.instructions, skillText].filter(Boolean).join("\n\n") || undefined;
    agentOpts = { system, tools: gatewayTools(ctx, cx.userId, cx.agent.tools), maxSteps: cx.agent.maxSteps, temperature: cx.agent.temperature };
  }
  if (!modelRef) return { configured: false, reply: NOT_CONFIGURED };
  try {
    const r = await callForUser(ctx, cx.userId, cx.workspaceId, modelRef, cx.history, agentOpts);
    return { configured: true, reply: r.text || "(no reply)" };
  } catch (e: any) {
    const detail = e?.data && typeof e.data === "object" ? e.data.detail ?? e.data.code : String(e?.message ?? e);
    await ctx.runMutation(internal.channelsIngest._setChannelError, { channelId, error: String(detail) });
    return { configured: true, reply: `Sorry — couldn't reach the model (${String(detail).slice(0, 120)}).` };
  }
}
