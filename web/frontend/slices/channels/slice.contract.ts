/**
 * Slice contract for `channels` — v0.1.0. Inbound messaging surfaces (Telegram in wave 1). Convex
 * functions (channelsCore/channelsIngest/channelTelegram) + the Next /channels/[kind]/[slug] webhook
 * route declared in-place via slice.json rootPaths. defineSliceContract inlined until the rr CLI is vendored.
 */
type SliceContract = {
  id: string;
  version: string;
  requires: { deps: string[] };
  provides: { components?: string[]; convex?: string[]; tables?: string[]; routes?: string[] };
  bidir: {
    syncPolicy: "manual" | "auto";
    generalization: { level: "consumer-locked" | "portable" | "generic"; forbiddenTerms: string[]; requiredProps: string[] };
  };
};
const defineSliceContract = <T extends SliceContract>(c: T): T => c;

export const contract = defineSliceContract({
  id: "channels",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["ChannelsCard"],
    convex: ["channelsCore.listChannels", "channelsCore.createChannel", "channelsCore.setEnabled", "channelsCore.bindAgent", "channelsCore.deleteChannel", "channelTelegram.setWebhook"],
    tables: ["channels", "channelIdentities", "channelEvents"],
    routes: ["/channels/[kind]/[slug]"],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
