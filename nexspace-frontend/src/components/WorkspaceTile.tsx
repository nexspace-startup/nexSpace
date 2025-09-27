// src/components/workspace/WorkspaceTile.tsx
import React from "react";
import type { WorkSpaceRole } from "../constants/enums";

export type WorkspaceTileProps = {
  id: string;
  name: string;
  role: WorkSpaceRole
  initials: string;
  onTileClick: () => void;
  active?: boolean;
  onOptionsClick?: (args: {
    id: string;
    name: string;
    anchorRect: DOMRect;
    role: WorkSpaceRole
  }) => void;
};

export default function WorkspaceTile({
  id,
  name,
  role,
  initials,
  onTileClick,
  active,
  onOptionsClick,
}: WorkspaceTileProps) {
  const handleOptions = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOptionsClick?.({ id, name, anchorRect: rect, role });
  };

  return (
    <div
      role="button"
      onClick={onTileClick}
      className={`
        flex items-center gap-2 w-full h-12 rounded-xl transition-colors cursor-pointer
        px-2 py-2.5
        ${active ? "bg-zinc-800" : "hover:bg-zinc-800"}
      `}
      style={{ backgroundColor: active ? "#202024" : "transparent" }}
    >
      {/* Avatar / initials */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
        style={{ backgroundColor: "#FFCAA9" }}
      >
        <span className="text-sm font-medium text-zinc-900 font-manrope">
          {initials}
        </span>
      </div>

      {/* Name */}
      <span
        className="text-sm font-small text-white font-manrope truncate"
        aria-label={name}
        title={name}
      >
        {name}
      </span>

      {/* 3-dot options */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Workspace options"
          onClick={handleOptions}
          className="grid w-7 h-7 rounded-full place-items-center text-white/70 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
            <circle cx="6" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="18" cy="12" r="1.6" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
