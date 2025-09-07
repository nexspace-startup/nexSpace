// src/services/authService.ts

import { ENDPOINTS } from "../constants/endpoints";
import { api } from "./httpService";

export async function checkSession(): Promise<"authed" | "guest"> {
  try {
    const r = await api.head(ENDPOINTS.AUTH_SESSION);
    return r.status === 204  ? "authed" : "guest";
  } catch {
    return "guest";
  }
}

export type MeResponse = {
  isAuthenticated: boolean;
  user?: { id?: string; first_name?: string; last_name?: string; email?: string };
};

export async function getMe(): Promise<MeResponse | null> {
  try {
    const { data } = await api.get(ENDPOINTS.AUTH_ME);
    return data?.data ?? null; // assumes { success, data, errors }
  } catch {
    return null;
  }
}
