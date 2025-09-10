import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { api } from "../services/httpService";


export type Workspace = { id: string; name: string };

type ApiOk = { success: true; data: Workspace[]; errors: [] };
type ApiErr = { success: false; data: null; errors: Array<{ message: string; code?: string }> };
type ApiRes = ApiOk | ApiErr;

type WorkspaceState = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  loading: boolean;
  error: string | null;

  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  upsertWorkspace: (w: Workspace) => void; // handy for “Create workspace” flow
};

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools((set, get) => ({
    workspaces: [],
    activeWorkspaceId: null,

    loading: false,
    error: null,

    fetchWorkspaces: async () => {
      // prevent duplicate loads (optional)
      if (get().loading) return;
      set({ loading: true, error: null });

      try {
        const res = await api.get<ApiRes>("/workspace", { withCredentials: true });

        if (res.data?.success && Array.isArray(res.data?.data)) {
          const list = res.data.data;
          // keep current selection if still valid; otherwise pick first
          const current = get().activeWorkspaceId;
          const stillValid = current ? list.some(w => w.id === current) : false;
          set({
            workspaces: list,
            activeWorkspaceId: stillValid ? current : (list[0]?.id ?? null),
            loading: false,
            error: null,
          });
        } else {
          set({
            workspaces: [],
            activeWorkspaceId: null,
            loading: false,
            error: res.data?.errors?.[0]?.message ?? "Failed to load workspaces",
          });
        }
      } catch (e: any) {
        set({
          workspaces: [],
          activeWorkspaceId: null,
          loading: false,
          error: e?.message ?? "Network error",
        });
      }
    },

    setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

    upsertWorkspace: (w) => {
      const existing = get().workspaces;
      const idx = existing.findIndex(x => x.id === w.id);
      const next = [...existing];
      if (idx >= 0) next[idx] = w; else next.unshift(w);
      set({ workspaces: next, activeWorkspaceId: w.id });
    },
  }))
);
