import React, { useEffect, useMemo } from "react";
import MeetingPanel from "../../components/MeetingPanel";
import NavbarPanel from "../../components/NavbarPanel";
import WorkspacePanel from "../../components/WorkspacePanel";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useUIStore } from "../../stores/uiStore";
import { NAV_ITEMS } from "../../constants/nav";
import { useMeetingStore } from "../../stores/meetingStore";
import { useMediaQuery } from "../../hooks/useMedia";
import MobileWorkspaceList from "../../components/MobileWorkspaceList";
import MobileNavbarDrawer from "../../components/MobileNavbarDrawer";

type NavItem = { id: string; label: string };

const DashboardPage: React.FC = () => {
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const activeNav = useUIStore((s) => s.activeNavId);
  const setActiveNav = useUIStore((s) => s.setActiveNav);
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const navItems: NavItem[] = useMemo(() => NAV_ITEMS as NavItem[], []);

  const isMobile = useMediaQuery('(max-width: 639px)');
  const hasCreds = useMeetingStore((s) => !!s.url && !!s.token);

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="relative w-full h-screen bg-[#202024] text-white">
        <div className="flex">
          <div className="hidden md:block">
            <NavbarPanel items={navItems} activeId={activeNav} onSelect={setActiveNav} />
          </div>
          <div className="hidden md:block">
            <WorkspacePanel />
          </div>
          {isMobile ? (hasCreds ? <MeetingPanel /> : <MobileWorkspaceList />) : <MeetingPanel />}
        </div>
        <MobileNavbarDrawer />
      </div>
    </div>
  );
};

export default DashboardPage;
