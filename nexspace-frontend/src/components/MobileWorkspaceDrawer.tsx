import React from "react";
import { useUIStore } from "../stores/uiStore";
import WorkspacePanel from "./WorkspacePanel";
import { useMediaQuery } from "../hooks/useMedia";

const MobileWorkspaceDrawer: React.FC = () => {
  const isOpen = useUIStore((s) => s.isWorkspacePanelOpen);
  const toggle = useUIStore((s) => s.toggleWorkspacePanel);
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (!isMobile) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-40 transition-opacity duration-300",
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => toggle(false)}
      />

      {/* Drawer */}
      <div
        className={[
          "absolute left-0 top-0 h-full w-[260px] bg-[#18181B] border-r border-[#26272B] shadow-xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="h-14 flex items-center justify-between px-3 border-b border-[#26272B]">
          <span className="text-white/90 font-semibold">Workspaces</span>
          <button
            onClick={() => toggle(false)}
            className="w-8 h-8 grid place-items-center text-white/70"
            aria-label="Close workspaces"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* Reuse existing panel content below header */}
        <div className="h-[calc(100%-56px)] overflow-hidden">
          <WorkspacePanel />
        </div>
      </div>
    </div>
  );
};

export default MobileWorkspaceDrawer;

