// src/store/uiStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type UIState = {
  isWorkspacePanelOpen: boolean;
  toggleWorkspacePanel: (open?: boolean) => void;
};

export const useUIStore = create<UIState>()(
  devtools((set, get) => ({
    isWorkspacePanelOpen: true,
    toggleWorkspacePanel: (open) =>
      set({ isWorkspacePanelOpen: typeof open === "boolean" ? open : !get().isWorkspacePanelOpen }),
  }))
);
