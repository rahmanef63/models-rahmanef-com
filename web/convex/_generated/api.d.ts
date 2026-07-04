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
import type * as admin from "../admin.js";
import type * as agentDefs from "../agentDefs.js";
import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as callForUser from "../callForUser.js";
import type * as chat from "../chat.js";
import type * as chatErrors from "../chatErrors.js";
import type * as chatProviders from "../chatProviders.js";
import type * as chatTools from "../chatTools.js";
import type * as claudeLib from "../claudeLib.js";
import type * as codexLib from "../codexLib.js";
import type * as credentials from "../credentials.js";
import type * as crons from "../crons.js";
import type * as crypto from "../crypto.js";
import type * as features_byok_index from "../features/byok/index.js";
import type * as features_workspaces_tables from "../features/workspaces/tables.js";
import type * as http from "../http.js";
import type * as mcp from "../mcp.js";
import type * as mcpNode from "../mcpNode.js";
import type * as mcpOauth from "../mcpOauth.js";
import type * as mcpOauthNode from "../mcpOauthNode.js";
import type * as oauth from "../oauth.js";
import type * as rateLimit from "../rateLimit.js";
import type * as settings from "../settings.js";
import type * as skillsRegistry from "../skillsRegistry.js";
import type * as threads from "../threads.js";
import type * as toolHandlers from "../toolHandlers.js";
import type * as toolRegistry from "../toolRegistry.js";
import type * as usage from "../usage.js";
import type * as workspaceInvites from "../workspaceInvites.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/auth": typeof _shared_auth;
  admin: typeof admin;
  agentDefs: typeof agentDefs;
  agents: typeof agents;
  auth: typeof auth;
  callForUser: typeof callForUser;
  chat: typeof chat;
  chatErrors: typeof chatErrors;
  chatProviders: typeof chatProviders;
  chatTools: typeof chatTools;
  claudeLib: typeof claudeLib;
  codexLib: typeof codexLib;
  credentials: typeof credentials;
  crons: typeof crons;
  crypto: typeof crypto;
  "features/byok/index": typeof features_byok_index;
  "features/workspaces/tables": typeof features_workspaces_tables;
  http: typeof http;
  mcp: typeof mcp;
  mcpNode: typeof mcpNode;
  mcpOauth: typeof mcpOauth;
  mcpOauthNode: typeof mcpOauthNode;
  oauth: typeof oauth;
  rateLimit: typeof rateLimit;
  settings: typeof settings;
  skillsRegistry: typeof skillsRegistry;
  threads: typeof threads;
  toolHandlers: typeof toolHandlers;
  toolRegistry: typeof toolRegistry;
  usage: typeof usage;
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
