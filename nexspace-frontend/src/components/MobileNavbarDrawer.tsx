import React from "react";
import { useUIStore } from "../stores/uiStore";
import { NAV_ITEMS } from "../constants/constants";

const MobileNavbarDrawer: React.FC = () => {
  const isOpen = useUIStore((s) => s.isNavbarOpen);
  const toggle = useUIStore((s) => s.toggleNavbar);
  const active = useUIStore((s) => s.activeNavId);
  const setActive = useUIStore((s) => s.setActiveNav);

  return (
    <div className={["fixed inset-0 z-40 transition-opacity duration-300 sm:hidden", isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"].join(" ")}
      aria-hidden={!isOpen}
    >
      <div className="absolute inset-0 bg-black/50" onClick={() => toggle(false)} />
      <div className={["absolute left-0 top-0 h-full w-[260px] bg-[#131316] border-r border-[#26272B] shadow-xl transition-transform duration-300", isOpen ? "translate-x-0" : "-translate-x-full"].join(" ")}
      >
        <div className="h-14 flex items-center justify-between px-3 border-b border-[#26272B]">
          <span className="text-white/90 font-semibold">Menu</span>
          <button onClick={() => toggle(false)} className="w-8 h-8 grid place-items-center text-white/70" aria-label="Close menu">
            <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p-3 flex flex-col gap-2">
          {NAV_ITEMS.map((n) => (
            <button
              key={n.id}
              onClick={() => { setActive(n.id); toggle(false); }}
              className={["w-full h-12 rounded-xl px-3 text-left", active === n.id ? "bg-white/10 text-white" : "bg-transparent text-[#C2C8D1] hover:bg-white/5"].join(" ")}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileNavbarDrawer;

