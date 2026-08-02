// workspaces slice public barrel (workspaces v0.1.0). Consumers import ONLY from `@/features/workspaces`.
export { WorkspaceProvider, useWorkspace, type WS } from "./context";
export { WorkspaceSwitcher } from "./components/workspace-switcher";
export { MembersCard } from "./components/members-card";
