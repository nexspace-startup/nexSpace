import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { api } from "../services/httpService";
import { toast } from "./toastStore";


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
  deleteWorkspace: (uid: string) => Promise<void>;
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
          toast.error(res.data?.errors?.[0]?.message ?? "Failed to load workspaces");
        }
      } catch (e: any) {
        set({
          workspaces: [],
          activeWorkspaceId: null,
          loading: false,
          error: e?.message ?? "Network error",
        });
        toast.error(e?.message ?? "Network error while loading workspaces");
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

    deleteWorkspace: async (uid) => {
      try {
        await api.delete(`/workspace/${uid}`, { withCredentials: true });
        const cur = get().workspaces;
        const next = cur.filter((w) => w.id !== uid);
        const nextActive = get().activeWorkspaceId === uid ? (next[0]?.id ?? null) : get().activeWorkspaceId;
        set({ workspaces: next, activeWorkspaceId: nextActive });
        toast.success("Workspace deleted");
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 403) toast.error("Only owners can delete a workspace");
        else if (status === 404) toast.warning("Workspace not found");
        else toast.error(e?.message ?? "Failed to delete workspace");
      }
    },
  }))
);
