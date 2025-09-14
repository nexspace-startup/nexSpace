import React, { useEffect, useMemo, useState } from "react";
import MeetingPanel from "../../components/MeetingPanel";
import NavbarPanel from "../../components/NavbarPanel";
import WorkspacePanel from "../../components/WorkspacePanel";
import { useWorkspaceStore } from "../../stores/workspaceStore";

type NavItem = { id: string; label: string };

const DashboardPage: React.FC = () => {
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const [activeNav, setActiveNav] = useState<string>("workspace");
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const navItems: NavItem[] = useMemo(
    () => [
      { id: "workspace", label: "Workspace" },
      { id: "preview", label: "Preview" },
      { id: "ai", label: "AI" },
      { id: "team", label: "Team" },
    ],
    []
  );

  return (
    <div className="relative min-h-screen bg-[#202024] text-white">
      {/* Responsive grid: 1 col on mobile, nav+main on md, nav+ws+main on lg */}
      <div className="grid h-screen grid-cols-1 md:grid-cols-[76px_1fr] lg:grid-cols-[76px_auto_1fr]">
        {/* Left rail (desktop/tablet). NavbarPanel also renders a mobile bottom bar internally */}
        <NavbarPanel items={navItems} activeId={activeNav} onSelect={setActiveNav} />

        {/* Workspace panel: overlay on md-, inline column on lg+ */}
        <WorkspacePanel />

        {/* Meeting stage */}
        <MeetingPanel />
      </div>
    </div>
  );
};

export default DashboardPage;
