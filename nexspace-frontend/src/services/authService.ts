import { api } from './httpService'
import { ENDPOINTS } from '../constants/endpoints'
import type { WorkSpaceRole } from '../constants/enums'
import type { ApiEnvelope } from '../types/api'
import { isApiSuccess } from '../types/api'

export interface AuthenticatedUser {
  id?: string
  first_name?: string
  last_name?: string
  email?: string
  avatar?: string | null
}

export interface WorkspaceSummary {
  id: string
  uid: string
  name: string
  memberCount: number
  role: WorkSpaceRole
}

export interface MeResponse {
  isAuthenticated: boolean
  user?: AuthenticatedUser
  workspaces?: WorkspaceSummary[]
}

export const AuthService = {
  async checkEmail(email: string): Promise<boolean> {
    const { data } = await api.get<ApiEnvelope<{ exists: boolean }>>(ENDPOINTS.AUTH_CHECK_EMAIL, {
      params: { email },
    })
    return isApiSuccess(data) ? Boolean(data.data?.exists) : false
  },

  async signin(email: string, password: string): Promise<{ ok: boolean }> {
    const { data } = await api.post<ApiEnvelope<{ isAuthenticated: boolean }>>('/auth/signin', {
      email,
      password,
    })
    return { ok: isApiSuccess(data) }
  },

  async googleCallback(code: string, redirectUri?: string, next?: string | null): Promise<boolean> {
    const { data } = await api.post<ApiEnvelope<{ isAuthenticated: boolean }>>(
      ENDPOINTS.OAUTH_GOOGLE_CALLBACK,
      { code, redirectUri, next }
    )
    return isApiSuccess(data)
  },
}

export async function checkSession(): Promise<"authed" | "guest"> {
  try {
    const r = await api.head(ENDPOINTS.AUTH_SESSION);
    return r.status === 204 ? "authed" : "guest";
  } catch {
    return "guest";
  }
}

export async function getMe(): Promise<MeResponse | null> {
  try {
    const { data } = await api.get<ApiEnvelope<MeResponse>>(ENDPOINTS.AUTH_ME)
    return isApiSuccess(data) ? data.data : null
  } catch {
    return null;
  }
}
