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
    <div className="min-h-screen w-full bg-white">
      <div className="relative w-full h-screen bg-[#202024] text-white">
        <div className="flex">
          <NavbarPanel items={navItems} activeId={activeNav} onSelect={setActiveNav} />
          <WorkspacePanel />
          <MeetingPanel />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
