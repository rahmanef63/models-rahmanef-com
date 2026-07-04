"use client";
// WorkspaceProvider — the active-workspace context every scoped surface reads. Bootstraps the
// caller's personal workspace (idempotent) and picks the active one from settings.activeWorkspaceId,
// falling back to personal. `switchTo` persists + optimistically overrides. Consumers gate on `ready`.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export type WS = { id: string; name: string; slug: string; personal: boolean; role: string; credPolicy: string };
type Ctx = { workspaceId: string | null; role: string | null; personal: boolean; workspaces: WS[]; switchTo: (id: string) => void; ready: boolean };

const WorkspaceCtx = createContext<Ctx | null>(null);
export function useWorkspace(): Ctx {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return c;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspaces = useQuery(api.workspaces.myWorkspaces) as WS[] | undefined;
  const settings = useQuery(api.settings.mySettings) as { activeWorkspaceId?: string } | null | undefined;
  const ensurePersonal = useMutation(api.workspaces.ensurePersonal);
  const setActive = useMutation(api.settings.setActiveWorkspace);
  const [override, setOverride] = useState<string | null>(null); // optimistic switch target

  // bootstrap: a signed-in user with no membership yet gets a personal workspace (idempotent, OCC-safe)
  useEffect(() => {
    if (workspaces !== undefined && workspaces.length === 0) void ensurePersonal({});
  }, [workspaces, ensurePersonal]);

  const list = workspaces ?? [];
  const personal = list.find((w) => w.personal) ?? null;
  const savedId = settings?.activeWorkspaceId;
  const active = list.find((w) => w.id === override) ?? list.find((w) => w.id === savedId) ?? personal ?? null;

  const switchTo = (id: string) => {
    setOverride(id);
    void setActive({ workspaceId: id as never });
  };

  const value: Ctx = {
    workspaceId: active?.id ?? null,
    role: active?.role ?? null,
    personal: active?.personal ?? true,
    workspaces: list,
    switchTo,
    ready: workspaces !== undefined && !!active,
  };
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}
