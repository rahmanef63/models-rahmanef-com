/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _shared_auth from "../_shared/auth.js";
import type * as _shared_ssrf from "../_shared/ssrf.js";
import type * as admin from "../admin.js";
import type * as adminAnalytics from "../adminAnalytics.js";
import type * as adminSeed from "../adminSeed.js";
import type * as agentDefs from "../agentDefs.js";
import type * as agents from "../agents.js";
import type * as apiKeys from "../apiKeys.js";
import type * as apiV1 from "../apiV1.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as callForUser from "../callForUser.js";
import type * as channelDiscord from "../channelDiscord.js";
import type * as channelSlack from "../channelSlack.js";
import type * as channelTelegram from "../channelTelegram.js";
import type * as channelWhatsapp from "../channelWhatsapp.js";
import type * as channelsAccess from "../channelsAccess.js";
import type * as channelsCore from "../channelsCore.js";
import type * as channelsCrypto from "../channelsCrypto.js";
import type * as channelsDispatch from "../channelsDispatch.js";
import type * as channelsIngest from "../channelsIngest.js";
import type * as chat from "../chat.js";
import type * as chatErrors from "../chatErrors.js";
import type * as chatProviders from "../chatProviders.js";
import type * as chatTools from "../chatTools.js";
import type * as claudeLib from "../claudeLib.js";
import type * as codexLib from "../codexLib.js";
import type * as combos from "../combos.js";
import type * as credentials from "../credentials.js";
import type * as credsPool from "../credsPool.js";
import type * as crons from "../crons.js";
import type * as crypto from "../crypto.js";
import type * as fallbackRules from "../fallbackRules.js";
import type * as features_apiCompat_tables from "../features/apiCompat/tables.js";
import type * as features_auditLog_tables from "../features/auditLog/tables.js";
import type * as features_byok_index from "../features/byok/index.js";
import type * as features_channels_tables from "../features/channels/tables.js";
import type * as features_combos_tables from "../features/combos/tables.js";
import type * as features_mcpClient_tables from "../features/mcpClient/tables.js";
import type * as features_memory_tables from "../features/memory/tables.js";
import type * as features_scheduledAgents_tables from "../features/scheduledAgents/tables.js";
import type * as features_usageRollups_rates from "../features/usageRollups/rates.js";
import type * as features_usageRollups_tables from "../features/usageRollups/tables.js";
import type * as features_workspaces_tables from "../features/workspaces/tables.js";
import type * as http from "../http.js";
import type * as mcp from "../mcp.js";
import type * as mcpClientNode from "../mcpClientNode.js";
import type * as mcpNode from "../mcpNode.js";
import type * as mcpOauth from "../mcpOauth.js";
import type * as mcpOauthNode from "../mcpOauthNode.js";
import type * as mcpServers from "../mcpServers.js";
import type * as memory from "../memory.js";
import type * as memoryAutoSummary from "../memoryAutoSummary.js";
import type * as memoryCuration from "../memoryCuration.js";
import type * as memorySummarize from "../memorySummarize.js";
import type * as oauth from "../oauth.js";
import type * as providerPool from "../providerPool.js";
import type * as rateLimit from "../rateLimit.js";
import type * as scheduledAgents from "../scheduledAgents.js";
import type * as scheduledAgentsRun from "../scheduledAgentsRun.js";
import type * as settings from "../settings.js";
import type * as skillsRegistry from "../skillsRegistry.js";
import type * as spendCaps from "../spendCaps.js";
import type * as threads from "../threads.js";
import type * as toolHandlers from "../toolHandlers.js";
import type * as toolRegistry from "../toolRegistry.js";
import type * as usage from "../usage.js";
import type * as usageRollups from "../usageRollups.js";
import type * as workspaceInvites from "../workspaceInvites.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/auth": typeof _shared_auth;
  "_shared/ssrf": typeof _shared_ssrf;
  admin: typeof admin;
  adminAnalytics: typeof adminAnalytics;
  adminSeed: typeof adminSeed;
  agentDefs: typeof agentDefs;
  agents: typeof agents;
  apiKeys: typeof apiKeys;
  apiV1: typeof apiV1;
  audit: typeof audit;
  auth: typeof auth;
  callForUser: typeof callForUser;
  channelDiscord: typeof channelDiscord;
  channelSlack: typeof channelSlack;
  channelTelegram: typeof channelTelegram;
  channelWhatsapp: typeof channelWhatsapp;
  channelsAccess: typeof channelsAccess;
  channelsCore: typeof channelsCore;
  channelsCrypto: typeof channelsCrypto;
  channelsDispatch: typeof channelsDispatch;
  channelsIngest: typeof channelsIngest;
  chat: typeof chat;
  chatErrors: typeof chatErrors;
  chatProviders: typeof chatProviders;
  chatTools: typeof chatTools;
  claudeLib: typeof claudeLib;
  codexLib: typeof codexLib;
  combos: typeof combos;
  credentials: typeof credentials;
  credsPool: typeof credsPool;
  crons: typeof crons;
  crypto: typeof crypto;
  fallbackRules: typeof fallbackRules;
  "features/apiCompat/tables": typeof features_apiCompat_tables;
  "features/auditLog/tables": typeof features_auditLog_tables;
  "features/byok/index": typeof features_byok_index;
  "features/channels/tables": typeof features_channels_tables;
  "features/combos/tables": typeof features_combos_tables;
  "features/mcpClient/tables": typeof features_mcpClient_tables;
  "features/memory/tables": typeof features_memory_tables;
  "features/scheduledAgents/tables": typeof features_scheduledAgents_tables;
  "features/usageRollups/rates": typeof features_usageRollups_rates;
  "features/usageRollups/tables": typeof features_usageRollups_tables;
  "features/workspaces/tables": typeof features_workspaces_tables;
  http: typeof http;
  mcp: typeof mcp;
  mcpClientNode: typeof mcpClientNode;
  mcpNode: typeof mcpNode;
  mcpOauth: typeof mcpOauth;
  mcpOauthNode: typeof mcpOauthNode;
  mcpServers: typeof mcpServers;
  memory: typeof memory;
  memoryAutoSummary: typeof memoryAutoSummary;
  memoryCuration: typeof memoryCuration;
  memorySummarize: typeof memorySummarize;
  oauth: typeof oauth;
  providerPool: typeof providerPool;
  rateLimit: typeof rateLimit;
  scheduledAgents: typeof scheduledAgents;
  scheduledAgentsRun: typeof scheduledAgentsRun;
  settings: typeof settings;
  skillsRegistry: typeof skillsRegistry;
  spendCaps: typeof spendCaps;
  threads: typeof threads;
  toolHandlers: typeof toolHandlers;
  toolRegistry: typeof toolRegistry;
  usage: typeof usage;
  usageRollups: typeof usageRollups;
  workspaceInvites: typeof workspaceInvites;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
