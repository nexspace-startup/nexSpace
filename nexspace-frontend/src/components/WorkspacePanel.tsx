// src/components/workspace/WorkspacePanel.tsx
import React, { useEffect, useRef, useState } from "react";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import WorkspaceTile from "./WorkspaceTile";
import minimiseIcon from "../assets/minimise_icon.svg"
import maximiseIcon from "../assets/maximise_icon.svg"

function initialsFrom(name: string): string {
  const parts = name?.trim().split(/\s+/).slice(0, 2) ?? [];
  return parts.map((p) => p?.[0]?.toUpperCase() ?? "").join("") || "W";
}

const PANEL_WIDTH = 230;
const PANEL_EXTRA_MAX = 50; // users can expand up to +50px

const WorkspacePanel: React.FC = () => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const isOpen = useUIStore((s) => s.isWorkspacePanelOpen);
  const toggle = useUIStore((s) => s.toggleWorkspacePanel);

  // Resizable width state (extra width up to 50px)
  const [extraWidth, setExtraWidth] = useState(0);
  const [dragging, setDragging] = useState(false);


  // Dragging refs
  const dragStartX = useRef(0);
  const dragStartExtra = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartX.current;
      const next = Math.min(PANEL_EXTRA_MAX, Math.max(0, dragStartExtra.current + dx));
      setExtraWidth(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // Show global left-right resize cursor while dragging
  useEffect(() => {
    if (dragging) {
      const prev = document.body.style.cursor;
      document.body.style.cursor = 'ew-resize';
      return () => { document.body.style.cursor = prev; };
    }
  }, [dragging]);

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
          relative shrink-0 h-screen
          border-r border-[#26272B]
          bg-[#18181B]
          transition-[opacity] duration-500
        "
        style={{
          width: isOpen ? PANEL_WIDTH + extraWidth : 0,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        //style={{ width: PANEL_WIDTH, opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
        aria-expanded={isOpen}
      >
        {/* Resize handle */}
        {isOpen && (
          <button
            type="button"
            aria-label="Resize workspace panel"
            title="Drag to resize"
            onMouseDown={(e) => {
              setDragging(true);
              dragStartX.current = e.clientX;
              dragStartExtra.current = extraWidth;
            }}
            className="absolute top-0 right-0 h-full w-1 sm:w-1 cursor-ew-resize group"
            style={{
              // a subtle visual when hover/dragging
              background: dragging ? "#3D93F8" : "transparent",
            }}
          >
          </button>
        )}
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
              onClick={async () => {
                const name = window.prompt('Workspace name');
                if (name) await createWorkspace(name);
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
