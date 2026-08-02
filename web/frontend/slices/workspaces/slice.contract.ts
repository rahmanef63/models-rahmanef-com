/**
 * Slice contract for `workspaces` — v0.1.0. The tenant boundary every other rr AI slice scopes by.
 * Convex registered functions (workspaces.ts, workspaceInvites.ts) declared in-place via
 * slice.json rootPaths — the frontend (WorkspaceProvider/switcher/Members) lives here.
 * defineSliceContract inlined (identity) until the rr CLI is vendored — mirrors command-menu.
 */
type SliceContract = {
  id: string;
  version: string;
  requires: { deps: string[] };
  provides: { components?: string[]; convex?: string[]; tables?: string[] };
  bidir: {
    syncPolicy: "manual" | "auto";
    generalization: { level: "consumer-locked" | "portable" | "generic"; forbiddenTerms: string[]; requiredProps: string[] };
  };
};
const defineSliceContract = <T extends SliceContract>(c: T): T => c;

export const contract = defineSliceContract({
  id: "workspaces",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["WorkspaceProvider", "WorkspaceSwitcher", "MembersCard"],
    convex: ["workspaces.myWorkspaces", "workspaces.create", "workspaces.ensurePersonal", "workspaceInvites.acceptInvite"],
    tables: ["workspaces", "memberships", "invites"],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: {
      // consumer-locked: the Members UI + invite copy are app-specific; the switcher assumes this
      // app's shell classes. Generalize the UI (labels/props, shadcn primitives) before an UP push.
      level: "consumer-locked",
      forbiddenTerms: ["models-rahmanef", "rahmanef"],
      requiredProps: [],
    },
  },
});
