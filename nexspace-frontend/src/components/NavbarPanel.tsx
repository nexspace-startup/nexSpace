import React, { useMemo, useRef, useState } from "react";
import { useUserStore } from "../stores/userStore";
import { initialsFrom } from "../utils/util";
import ProfileFlyout from "./ProfileFlyout";

export type NavItem = { id: string; label: string; icon?: React.ReactNode };

type NavbarPanelProps = {
  items: NavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
};

const NavbarPanel: React.FC<NavbarPanelProps> = ({ items, activeId, onSelect }) => {
  const user = useUserStore((s) => s.user);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const name = useMemo(() => user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" "), [user]);
  const avatarUrl = user?.avatar;

  return (
    <nav
      ref={rootRef as any}
      className="
        relative
        w-[76px] shrink-0 h-screen
        bg-[#131316] border-r border-[#26272B]
        flex flex-col items-center
        py-5 gap-10
      "
    >
      {/* Logo */}
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#B7F2D4] to-[#48FFA4]" />

      {/* Top group */}
      <div className="flex flex-col items-center gap-2">
        {items?.map((n) => (
          <button
            key={n.id}
            aria-label={n.label}
            onClick={() => onSelect?.(n.id)}
            className={["nav-btn", activeId === n.id ? "nav-btn-active" : ""].join(" ")}
          >
            {/* Minimal placeholder icons — replace with your set as needed */}
            <span className="w-6 h-6 text-[#80889B]">
              {n.icon ?? (
                <svg viewBox="0 0 24 24" className="w-6 h-6">
                  <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom group */}
      <div className="mt-auto w-12 flex flex-col items-center gap-6">
        {/* Notification */}
        <button className="nav-btn">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#80889B]">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-12 0v5l-2 2v1h16v-1l-2-2Z" fill="currentColor" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-6 border-t border-[#26272B]" />


        {/* Profile button */}
        <div className="w-12 h-12 grid place-items-center">
          <button
            ref={btnRef}
            aria-label="Open profile menu"
            className="w-9 h-9 rounded-xl bg-white/10 border border-[#26272B] overflow-hidden grid place-items-center"
            onClick={() => setOpen((v) => !v)}
          >
            {avatarUrl ? (
              // Avatar image
              <img src={avatarUrl} alt={name || "User avatar"} className="w-full h-full object-cover" />
            ) : (
              // Fallback initials circle
              <div className="w-full h-full rounded-xl bg-[rgba(88,39,218,0.25)] grid place-items-center">
                <span className="text-[11px] font-semibold text-white/90">{initialsFrom(name)}</span>
              </div>
            )}
          </button>
        </div>
        <ProfileFlyout open={open} onClose={() => setOpen(false)} anchorRef={btnRef as any} />
      </div>
    </nav>
  );
};

export default NavbarPanel;
