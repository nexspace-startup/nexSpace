import React from "react";

export type NavItem = { id: string; label: string; icon?: React.ReactNode };

type NavbarPanelProps = {
  items: NavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
};

const NavbarPanel: React.FC<NavbarPanelProps> = ({ items, activeId, onSelect }) => {
  return (
    <nav
      className="
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

        {/* Settings */}
        <button className="nav-btn">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#80889B]">
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm7.4-2.5a7.9 7.9 0 0 0 .06-1l2.04-1.58-1.93-3.34-2.4.65a8 8 0 0 0-.86-.5l-.37-2.47H8.06l-.37 2.47c-.3.15-.59.32-.86.5l-2.4-.65-1.93 3.34L4.54 12a7.9 7.9 0 0 0 .06 1l-2.04 1.58 1.93 3.34 2.4-.65c.27.18.56.35.86.5l.37 2.47h7.38l.37-2.47c.3-.15.59-.32.86-.5l2.4.65 1.93-3.34L19.46 13Z" fill="currentColor"/>
          </svg>
        </button>

        {/* Profile */}
        <div className="w-12 h-12 grid place-items-center">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#26272B]" />
        </div>
      </div>
    </nav>
  );
};

export default NavbarPanel;
