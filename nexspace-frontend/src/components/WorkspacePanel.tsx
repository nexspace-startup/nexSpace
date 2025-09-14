// src/components/workspace/WorkspacePanel.tsx
import React from "react";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import WorkspaceTile from "./workspace/WorkspaceTile";
import minimiseIcon from "../assets/minimise_icon.svg"
import maximiseIcon from "../assets/maximise_icon.svg"

function initialsFrom(name: string): string {
  const parts = name?.trim().split(/\s+/).slice(0, 2) ?? [];
  return parts.map((p) => p?.[0]?.toUpperCase() ?? "").join("") || "W";
}

const PANEL_WIDTH = 230;

const WorkspacePanel: React.FC = () => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);

  const isOpen = useUIStore((s) => s.isWorkspacePanelOpen);
  const toggle = useUIStore((s) => s.toggleWorkspacePanel);

  return (
    <>
      {/* Collapsed pill (shown only when closed) */}
      {!isOpen && (
        <div
          className="
            absolute z-20 left-[100px] top-[24px]
            h-10 px-5 rounded-2xl
            flex items-center justify-between
            shadow-sm
            transition-all duration-500 ease-out
            opacity-100 translate-y-0
          "
          style={{ width: PANEL_WIDTH, height: 60, backgroundColor: "rgba(19,20,23,0.8)" }}
          aria-hidden={false}
        >
          <span className="text-sm text-white/85 font-manrope select-none">Workspaces</span>
          <button
            onClick={() => toggle(true)}
            className="w-7 h-7 rounded-full border grid place-items-center hover:border-zinc-600 transition"
            style={{ borderColor: "#26272B" }}
            aria-label="Expand workspace panel"
          >
            <img src={maximiseIcon} alt="Expand" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded panel wrapper */}
      <aside
        className="
          relative shrink-0
          border-r border-[#26272B]
          bg-[#18181B]
          transition-[opacity] duration-500
        "
        style={{
          width: isOpen ? PANEL_WIDTH : 0,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        //style={{ width: PANEL_WIDTH, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
        aria-expanded={isOpen}
      >
        {/* Header row stays fixed at top; content below vertically collapses */}
        <div className="px-3 pt-5">
          <div className="h-8 flex items-center justify-between">
            <span className="text-white text-[16px] font-semibold tracking-[-0.01em]">Workspaces</span>
            <button
              onClick={() => toggle(false)}
              className="w-7 h-7 rounded-full border grid place-items-center hover:border-zinc-600 transition"
              style={{ borderColor: "#26272B" }}
              aria-label="Expand workspace panel"
            >
              <img src={minimiseIcon} alt="Expand" className="w-3.5 h-3.5" />
            </button>

          </div>
        </div>

        {/* Vertically-collapsing content */}
        <div
          className={[
            "px-3 overflow-hidden origin-top",
            "transition-[max-height,opacity,transform] duration-500 ease-out",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
          ].join(" ")}
          style={{ maxHeight: isOpen ? "100vh" : 0 }}
        >
          {/* List */}
          <div className="mt-6 space-y-2">
            {workspaces?.map((ws) => (
              <div key={ws.id}>
                <WorkspaceTile
                  name={ws.name}
                  initials={initialsFrom(ws.name)}
                  active={activeId === ws.id}
                  onTileClick={() => setActive(ws.id)}
                />
              </div>
            ))}
          </div>

          {/* New Workspace */}
          <div className="mt-6 pb-5">
            <button
              onClick={() => {
                // TODO: open create workspace; on success call upsertWorkspace(newWs)
              }}
              className="
                w-full h-10 rounded-2xl
                bg-[rgba(128,136,155,0.25)]
                text-white text-sm font-semibold
                inline-flex items-center justify-center gap-2
                hover:bg-white/20 transition-colors
              "
            >
              <svg viewBox="0 0 20 20" className="w-5 h-5">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              New Workspace
            </button>
          </div>
        </div>
      </aside>
      
    </>
  );
};

export default WorkspacePanel;
