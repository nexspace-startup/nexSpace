import { create } from "zustand";
import { checkSession, getMe } from "../services/authService";
import { api } from "../services/httpService";

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
  setUser: (user: User) => void;
  clearUser: () => void;

  // new helpers
  init: () => Promise<void>;     // run once on app-load to determine auth
  logout: () => Promise<void>;   // call from Sign Out button
  setStatus: (s: AuthStatus) => void;

  // internal guard to avoid duplicate inits
  _inflight?: Promise<void> | null;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  status: "idle",
  _inflight: null,

  setUser: (user) => set({ user, status: "authed" }),
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
      const me = await getMe(); // returns MeResponse | null (your wrapper’s .data)
      const first = me?.user?.first_name ?? "";
      const last = me?.user?.last_name ?? "";
      const name = [first, last].filter(Boolean).join(" ") || undefined;

      set({
        status: "authed",
        user: me?.user ? { id: me.user.id, name, email: me.user.email } : null,
        _inflight: null,
      });
    })();

    set({ _inflight: p });
    return p;
  },

  logout: async () => {
    try {
      await api.post("/auth/logout"); // your API should revoke session + clear cookie
    } catch {
      /* ignore network hiccups */
    } finally {
      set({ user: null, status: "guest", _inflight: null });
      // optional: cross-tab sync if you want
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        new BroadcastChannel("auth").postMessage({ type: "logout" });
      }
    }
  },
}));
