// src/store/uiStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type UIState = {
  isWorkspacePanelOpen: boolean;
  toggleWorkspacePanel: (open?: boolean) => void;

  isNavbarOpen: boolean;
  toggleNavbar: (open?: boolean) => void;

  isTopWidgetOpen: boolean;
  toggleTopWidget: (open?: boolean) => void;

  isWorkspaceControlsOpen: boolean;
  toggleWorkspaceControls: (open?: boolean) => void;

  activeNavId: string;
  setActiveNav: (id: string) => void;

  setMeetingControlsVisible: (v: boolean) => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  toggleTheme: () => void;
};

export const useUIStore = create<UIState>()(
  devtools((set, get) => ({
    // Theme initialization
    theme: (() => {
      if (typeof window === 'undefined') return 'dark';
      try {
        const v = window.localStorage.getItem('theme');
        return v === 'light' ? 'light' : 'dark';
      } catch {
        return 'dark';
      }
    })(),
    setTheme: (t) => {
      try { localStorage.setItem('theme', t); } catch {}
      set({ theme: t });
    },
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch {}
      set({ theme: next });
    },
    isWorkspacePanelOpen: true,
    toggleWorkspacePanel: (open) =>
      set({ isWorkspacePanelOpen: typeof open === "boolean" ? open : !get().isWorkspacePanelOpen }),

    isNavbarOpen: false,
    toggleNavbar: (open) => set({ isNavbarOpen: typeof open === 'boolean' ? open : !get().isNavbarOpen }),

    activeNavId: 'workspace',
    setActiveNav: (id) => set({ activeNavId: id }),

    setMeetingControlsVisible: (v) => {
      set({
        isTopWidgetOpen: v,
        isWorkspaceControlsOpen: v,
        isWorkspacePanelOpen: v,
      })
    },

    isTopWidgetOpen: true,
    toggleTopWidget: (open) =>
      set({ isTopWidgetOpen: typeof open === "boolean" ? open : !get().isTopWidgetOpen }),

    isWorkspaceControlsOpen: true,
    toggleWorkspaceControls: (open) =>
      set({ isWorkspaceControlsOpen: typeof open === "boolean" ? open : !get().isWorkspaceControlsOpen }),
  }))
);
