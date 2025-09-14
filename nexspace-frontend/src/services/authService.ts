import { api } from './httpService'
import { ENDPOINTS } from '../constants/endpoints'

type ApiEnvelope<T> = { success: boolean; data: T; errors: any[] }

export const AuthService = {
  async checkEmail(email: string): Promise<boolean> {
    const { data } = await api.get<ApiEnvelope<{ exists: boolean }>>(ENDPOINTS.AUTH_CHECK_EMAIL, {
      params: { email },
    })
    return Boolean(data?.data?.exists)
  },

  async signin(email: string, password: string): Promise<{ ok: boolean }> {
    const { data } = await api.post<ApiEnvelope<{ isAuthenticated: boolean }>>('/auth/signin', {
      email,
      password,
    })
    return { ok: data?.success === true }
  },

  async googleCallback(code: string, redirectUri?: string): Promise<boolean> {
    const { data } = await api.post<ApiEnvelope<{ isAuthenticated: boolean }>>(
      ENDPOINTS.OAUTH_GOOGLE_CALLBACK,
      { code, redirectUri }
    )
    return data?.success === true
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

export type MeResponse = {
  isAuthenticated: boolean;
  user?: { id?: string; first_name?: string; last_name?: string; email?: string };
  workspaces?: Array<{ id: string; uid: string; name: string; memberCount: number; role: any }>;
};

export async function getMe(): Promise<MeResponse | null> {
  try {
    const { data } = await api.get(ENDPOINTS.AUTH_ME);
    return data?.data ?? null; // assumes { success, data, errors }
  } catch {
    return null;
  }
}
