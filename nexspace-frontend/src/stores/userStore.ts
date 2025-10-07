import { create } from "zustand";
import { checkSession, getMe } from "../services/authService";
import type { MeResponse } from "../services/authService";
import { api } from "../services/httpService";
import { ENDPOINTS } from "../constants/endpoints";
import { useMeetingStore } from "./meetingStore";

export type AuthStatus = "idle" | "checking" | "authed" | "guest";

export interface User {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  avatar?: string;
  // OAuth fields (optional): present when authenticating via Google/Microsoft before DB user exists
  sub?: string;
  provider?: "google" | "microsoft" | "local";
  token?: string; // keep if you plan to store non-sensitive tokens (not needed for httpOnly cookie sessions)
}

interface UserState {
  user: User | null;
  status: AuthStatus;
  // existing APIs — unchanged
  setUser: (user: User | null) => void;
  clearUser: () => void;

  // new helpers
  init: () => Promise<void>; // run once on app-load to determine auth
  logout: () => Promise<void>; // call from Sign Out button
  setStatus: (s: AuthStatus) => void;

  // internal guard to avoid duplicate inits
  _inflight?: Promise<void> | null;
}

const mapUser = (payload: MeResponse | null): User | null => {
  if (!payload?.user) return null;

  const { user } = payload;
  const first = user.first_name?.trim() ?? "";
  const last = user.last_name?.trim() ?? "";
  const name = [first, last].filter(Boolean).join(" ");

  return {
    id: user.id,
    firstName: first || undefined,
    lastName: last || undefined,
    name: name || undefined,
    email: user.email,
    avatar: user.avatar ?? undefined,
  };
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  status: "idle",
  _inflight: null,

  setUser: (user) => set({ user, status: user ? "authed" : "guest" }),
  clearUser: () => set({ user: null, status: "guest" }),
  setStatus: (s) => set({ status: s }),

  init: async () => {
    // idempotent: prevent duplicate network calls during mount/rerenders
    const inflight = get()._inflight;
    if (inflight) return inflight;

    const p = (async () => {
      set({ status: "checking" });

      // Fast probe: HEAD /auth/session → uses Redis EXISTS, no DB
      const session = await checkSession(); // "authed" | "guest"
      if (session === "guest") {
        set({ status: "guest", user: null, _inflight: null });
        return;
      }

      // Minimal identity: GET /auth/me (no heavy expansions by default)
      const me: MeResponse | null = await getMe();
      set({ status: me ? "authed" : "guest", user: mapUser(me), _inflight: null });
    })();

    set({ _inflight: p });
    return p;
  },

  logout: async () => {
    try {
      const leave = useMeetingStore.getState().leave;
      await leave();
      await api.post(ENDPOINTS.AUTH_LOGOUT); // revoke session + clear cookie
    } catch {
      /* ignore network hiccups */
    } finally {
      set({ user: null, status: "guest", _inflight: null });
      // optional: cross-tab sync if you want
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const channel = new BroadcastChannel("auth");
        channel.postMessage({ type: "logout" });
        channel.close?.();
      }
    }
  },
}));
