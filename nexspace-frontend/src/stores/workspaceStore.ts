import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { api } from "../services/httpService";
import { toast } from "./toastStore";
import type { WorkSpaceRole } from "../constants/enums";

export type Workspace = { id: string; name: string; role: WorkSpaceRole };
export type WorkspaceMember = { id: string; workspaceId?: string; name: string, role?: WorkSpaceRole };


type ApiOk = { success: true; data: Workspace[]; errors: [] };
type ApiErr = { success: false; data: null; errors: Array<{ message: string; code?: string }> };
type ApiRes = ApiOk | ApiErr;

type WorkspaceState = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspaceMembers: WorkspaceMember[] | null;
  loading: boolean;
  error: string | null;

  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  upsertWorkspace: (w: Workspace) => void; // handy for “Create workspace” flow
  deleteWorkspace: (uid: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace>;
  updateWorkspace: (id: string, name: string | null) => Promise<Workspace>
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
          const newActiveWorkspaceId = stillValid ? current : (list[0]?.id ?? null);

          // Fetch members for the active workspace if we have one
          let activeWorkspaceMembers = [];
          if (newActiveWorkspaceId) {
            try {
              const workspaceMembersRes = await api.get(
                `/workspace/${newActiveWorkspaceId}/members`,
                { params: { q: "%" }, withCredentials: true }
              );
              activeWorkspaceMembers = workspaceMembersRes.data?.data || [];
            } catch (membersError: any) {
              console.error("Failed to fetch workspace members:", membersError);
              // Don't fail the entire operation if member fetching fails
              toast.error("Failed to load workspace members");
            }
          }

          set({
            workspaces: list,
            activeWorkspaceId: newActiveWorkspaceId,
            activeWorkspaceMembers: activeWorkspaceMembers,
            loading: false,
            error: null,
          });
        } else {
          set({
            workspaces: [],
            activeWorkspaceId: null,
            activeWorkspaceMembers: [],
            loading: false,
            error: res.data?.errors?.[0]?.message ?? "Failed to load workspaces",
          });
          toast.error(res.data?.errors?.[0]?.message ?? "Failed to load workspaces");
        }
      } catch (e: any) {
        set({
          workspaces: [],
          activeWorkspaceId: null,
          activeWorkspaceMembers: [],
          loading: false,
          error: e?.message ?? "Network error",
        });
        toast.error(e?.message ?? "Network error while loading workspaces");
      }
    },

    setActiveWorkspace: async (id) => {
      //fetch active workspace members
      const workspaceMembers = await api.get(`/workspace/${get().activeWorkspaceId}/members`, { params: { q: "%" }, withCredentials: true });
      set({ activeWorkspaceId: id, activeWorkspaceMembers: workspaceMembers.data.data });
    },

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

    createWorkspace: async (name: string) => {
      const clean = String(name || '').trim();
      if (!clean) { toast.warning('Enter a workspace name'); return null; }
      try {
        const res = await api.post('/workspace', { name: clean }, { withCredentials: true });
        if ((res.data as any)?.success && (res.data as any)?.data) {
          const w: Workspace = (res.data as any).data;
          const existing = get().workspaces;
          const idx = existing.findIndex(x => x.id === w.id);
          const next = [...existing];
          if (idx >= 0) next[idx] = w; else next.unshift(w);
          set({ workspaces: next, activeWorkspaceId: w.id });
          toast.success('Workspace created');
          return w;
        }
        const msg = (res.data as any)?.errors?.[0]?.message ?? 'Failed to create workspace';
        toast.error(msg);
        return null;
      } catch (e: any) {
        const code = e?.response?.status;
        if (code === 409) toast.error('Workspace already exists'); else toast.error(e?.message ?? 'Failed to create workspace');
        return null;
      }
    },

    // added the function to update workspace from panel options (09/29/2025)
    updateWorkspace: async (id: string, name: string) => {
      debugger
      const clean = String(name || '').trim();
      if (!clean) { toast.warning('Enter a workspace name'); return null; }

      try {
        const res = await api.put(`/workspace/${id}`, { name: clean }, { withCredentials: true });

        if ((res.data as any)?.success && (res.data as any)?.data) {
          const w: Workspace = (res.data as any).data;
          const existing = get().workspaces;
          const idx = existing.findIndex(x => x.id === w.id);
          const next = [...existing];
          if (idx >= 0) next[idx] = w;
          set({ workspaces: next, activeWorkspaceId: w.id });
          toast.success('Workspace updated');
          return w;
        }

        const msg = (res.data as any)?.errors?.[0]?.message ?? 'Failed to update workspace';
        toast.error(msg);
        return null;

      } catch (e: any) {
        const code = e?.response?.status;
        if (code === 404) toast.error('Workspace not found');
        else toast.error(e?.message ?? 'Failed to update workspace');
        return null;
      }
    },
  }))
);
