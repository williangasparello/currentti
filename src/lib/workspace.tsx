import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { isMockMode } from "@/lib/backend";
import { getWorkspaceId, setWorkspaceId } from "@/lib/api/client";
import { listWorkspaces, createWorkspace as apiCreateWorkspace } from "@/lib/api/workspaces";
import type { Workspace } from "@/types/domain";

const DEMO_WS: Workspace = {
  id: "ws_demo",
  name: "Currentti (demo)",
  plan: "trial",
  subscription_status: "trialing",
  trial_ends_at: null,
  created_at: new Date(0).toISOString(),
  role: "owner",
};

interface WorkspaceState {
  loading: boolean;
  workspaces: Workspace[];
  active: Workspace | null;
  setActive: (id: string) => void;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<WorkspaceState | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(getWorkspaceId());

  const pickActive = useCallback((list: Workspace[]) => {
    const stored = getWorkspaceId();
    const chosen = list.find((w) => w.id === stored) || list[0] || null;
    if (chosen) {
      setWorkspaceId(chosen.id);
      setActiveId(chosen.id);
    } else {
      setWorkspaceId(null);
      setActiveId(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveId(null);
      return;
    }
    if (isMockMode) {
      setWorkspaces([DEMO_WS]);
      pickActive([DEMO_WS]);
      return;
    }
    const list = await listWorkspaces();
    setWorkspaces(list);
    pickActive(list);
  }, [user, pickActive]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const setActive = useCallback(
    (id: string) => {
      const ws = workspaces.find((w) => w.id === id);
      if (!ws) return;
      setWorkspaceId(id);
      setActiveId(id);
      // recarrega o app para todas as telas relerem os dados do novo workspace
      window.location.assign("/");
    },
    [workspaces],
  );

  const createWorkspace = useCallback(async (name: string) => {
    const ws = await apiCreateWorkspace(name);
    if (ws) {
      setWorkspaces((prev) => [...prev, ws]);
      setWorkspaceId(ws.id);
      setActiveId(ws.id);
    }
    return ws;
  }, []);

  const active = useMemo(
    () => workspaces.find((w) => w.id === activeId) || null,
    [workspaces, activeId],
  );

  const value = useMemo<WorkspaceState>(
    () => ({ loading, workspaces, active, setActive, createWorkspace, refresh }),
    [loading, workspaces, active, setActive, createWorkspace, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace deve ser usado dentro de <WorkspaceProvider>");
  return ctx;
}
