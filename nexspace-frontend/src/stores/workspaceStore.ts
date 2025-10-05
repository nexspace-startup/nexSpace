import { isAxiosError } from "axios"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { api } from "../services/httpService"
import { toast } from "./toastStore"
import type { WorkSpaceRole } from "../constants/enums"
import { ENDPOINTS } from "../constants/endpoints"
import type { ApiEnvelope } from "../types/api"
import { firstApiError, isApiSuccess } from "../types/api"

export type Workspace = { id: string; name: string; role: WorkSpaceRole }
export type WorkspaceMember = { id: string; workspaceId?: string; name: string; role?: WorkSpaceRole }

type WorkspaceListResponse = Workspace[]
type WorkspaceMembersResponse = WorkspaceMember[]

type WorkspaceState = {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  activeWorkspaceMembers: WorkspaceMember[]
  loading: boolean
  error: string | null

  fetchWorkspaces: () => Promise<void>
  setActiveWorkspace: (id: string | null) => Promise<void>
  upsertWorkspace: (w: Workspace) => void
  deleteWorkspace: (uid: string) => Promise<void>
  createWorkspace: (name: string) => Promise<Workspace | null>
}

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const envelope = error.response?.data as ApiEnvelope<unknown> | undefined
    return firstApiError(envelope) ?? error.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}

const fetchWorkspaceMembers = async (workspaceId: string): Promise<WorkspaceMember[]> => {
  const { data } = await api.get<ApiEnvelope<WorkspaceMembersResponse>>(
    ENDPOINTS.WORKSPACE_MEMBERS(workspaceId),
    { params: { q: "%" }, withCredentials: true }
  )

  return isApiSuccess(data) ? data.data : []
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools((set, get) => ({
    workspaces: [],
    activeWorkspaceId: null,
    activeWorkspaceMembers: [],
    loading: false,
    error: null,

    fetchWorkspaces: async () => {
      if (get().loading) return
      set({ loading: true, error: null })

      try {
        const { data } = await api.get<ApiEnvelope<WorkspaceListResponse>>(ENDPOINTS.WORKSPACES, {
          withCredentials: true,
        })

        if (!isApiSuccess(data)) {
          const message = firstApiError(data) ?? "Failed to load workspaces"
          set({
            workspaces: [],
            activeWorkspaceId: null,
            activeWorkspaceMembers: [],
            loading: false,
            error: message,
          })
          toast.error(message)
          return
        }

        const list = data.data
        const currentId = get().activeWorkspaceId
        const stillValid = currentId ? list.some((w) => w.id === currentId) : false
        const nextActiveId = stillValid ? currentId : list[0]?.id ?? null

        let members: WorkspaceMember[] = []
        if (nextActiveId) {
          try {
            members = await fetchWorkspaceMembers(nextActiveId)
          } catch (memberError) {
            const message = extractErrorMessage(memberError, "Failed to load workspace members")
            toast.error(message)
          }
        }

        set({
          workspaces: list,
          activeWorkspaceId: nextActiveId,
          activeWorkspaceMembers: members,
          loading: false,
          error: null,
        })
      } catch (error) {
        const message = extractErrorMessage(error, "Network error while loading workspaces")
        set({
          workspaces: [],
          activeWorkspaceId: null,
          activeWorkspaceMembers: [],
          loading: false,
          error: message,
        })
        toast.error(message)
      }
    },

    setActiveWorkspace: async (id) => {
      if (id === get().activeWorkspaceId) return
      if (!id) {
        set({ activeWorkspaceId: null, activeWorkspaceMembers: [] })
        return
      }

      set({ activeWorkspaceId: id })
      try {
        const members = await fetchWorkspaceMembers(id)
        set({ activeWorkspaceId: id, activeWorkspaceMembers: members })
      } catch (error) {
        const message = extractErrorMessage(error, "Failed to load workspace members")
        toast.error(message)
        set({ activeWorkspaceMembers: [] })
      }
    },

    upsertWorkspace: (workspace) => {
      const existing = get().workspaces
      const index = existing.findIndex((w) => w.id === workspace.id)
      const next = [...existing]
      if (index >= 0) next[index] = workspace
      else next.unshift(workspace)
      set({ workspaces: next, activeWorkspaceId: workspace.id })
    },

    deleteWorkspace: async (uid) => {
      try {
        await api.delete(ENDPOINTS.WORKSPACE_DETAIL(uid), { withCredentials: true })
        const remaining = get().workspaces.filter((workspace) => workspace.id !== uid)
        const currentActive = get().activeWorkspaceId
        const nextActive = currentActive === uid ? remaining[0]?.id ?? null : currentActive
        set({ workspaces: remaining, activeWorkspaceId: nextActive })
        toast.success("Workspace deleted")
      } catch (error) {
        if (isAxiosError(error)) {
          const status = error.response?.status
          if (status === 403) {
            toast.error("Only owners can delete a workspace")
            return
          }
          if (status === 404) {
            toast.warning("Workspace not found")
            return
          }
        }

        toast.error(extractErrorMessage(error, "Failed to delete workspace"))
      }
    },

    createWorkspace: async (name: string) => {
      const clean = name.trim()
      if (!clean) {
        toast.warning("Enter a workspace name")
        return null
      }

      try {
        const { data } = await api.post<ApiEnvelope<Workspace>>(ENDPOINTS.WORKSPACES, { name: clean }, {
          withCredentials: true,
        })

        if (!isApiSuccess(data)) {
          const message = firstApiError(data) ?? "Failed to create workspace"
          toast.error(message)
          return null
        }

        const workspace = data.data
        const existing = get().workspaces
        const index = existing.findIndex((w) => w.id === workspace.id)
        const next = [...existing]
        if (index >= 0) next[index] = workspace
        else next.unshift(workspace)

        set({ workspaces: next, activeWorkspaceId: workspace.id })
        toast.success("Workspace created")
        return workspace
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 409) {
          toast.error("Workspace already exists")
          return null
        }

        toast.error(extractErrorMessage(error, "Failed to create workspace"))
        return null
      }
    },
  }))
)
