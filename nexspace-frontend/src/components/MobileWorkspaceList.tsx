import React, { useEffect } from "react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useMeetingStore } from "../stores/meetingStore";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../stores/uiStore";

const MobileWorkspaceList: React.FC = () => {
  const { workspaces, activeWorkspaceId, fetchWorkspaces, setActiveWorkspace, createWorkspace } = useWorkspaceStore(
    useShallow((s) => ({
      workspaces: s.workspaces,
      activeWorkspaceId: s.activeWorkspaceId,
      fetchWorkspaces: s.fetchWorkspaces,
      setActiveWorkspace: s.setActiveWorkspace,
      createWorkspace: s.createWorkspace,
    }))
  );

  const { joinActiveWorkspace, joining } = useMeetingStore(
    useShallow((s) => ({ joinActiveWorkspace: s.joinActiveWorkspace, joining: s.joining }))
  );
  const toggleNavbar = useUIStore((s) => s.toggleNavbar);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <section className="min-h-screen w-full bg-[#202024] text-white">
      <header className="sticky top-0 z-10 h-14 px-3 bg-[#18181B] border-b border-[#26272B] flex items-center justify-between">
        <button
          onClick={() => toggleNavbar(true)}
          className="w-10 h-10 rounded-xl bg-[#131316] border border-[#26272B] grid place-items-center"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/80">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-base font-semibold">Workspaces</h1>
        <span className="w-10" aria-hidden="true" />
      </header>

      <div className="px-4 py-4 space-y-3">
        {workspaces.map((ws) => {
          const isActive = activeWorkspaceId === ws.id;
          return (
            <div key={ws.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${isActive ? 'border-[#3D93F8]' : 'border-[#26272B]'} bg-[#18181B]`}>
              <div className="w-9 h-9 rounded-full bg-[#FFCAA9] grid place-items-center text-zinc-900 font-semibold">
                {ws.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ws.name}</div>
              </div>
              <button
                className={`h-9 px-3 rounded-xl text-sm font-semibold ${joining && isActive ? 'opacity-70 cursor-wait' : ''} ${isActive ? 'bg-[#3D93F8] text-white' : 'bg-white/10 text-white'} `}
                onClick={async () => { setActiveWorkspace(ws.id); await joinActiveWorkspace(); }}
                disabled={joining && isActive}
              >
                {joining && isActive ? 'Joining…' : 'Join'}
              </button>
              <button aria-label="Workspace options" className="w-9 h-9 rounded-full grid place-items-center text-white/70">
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
                  <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                  <circle cx="12" cy="19" r="1.6" fill="currentColor" />
                </svg>
              </button>
            </div>
          );
        })}

        {workspaces.length === 0 && (
          <div className="text-center text-[#80889B] text-sm py-10">No workspaces yet.</div>
        )}

        {/* Create workspace button */}
        <div className="pt-3">
          <button
            type="button"
            onClick={async () => {
              const name = window.prompt('Workspace name');
              if (name) await createWorkspace(name);
            }}
            className="w-full h-11 rounded-2xl bg-[rgba(128,136,155,0.25)] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
          >
            <svg viewBox="0 0 20 20" className="w-5 h-5"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            Create Workspace
          </button>
        </div>
      </div>
    </section>
  );
};

export default MobileWorkspaceList;
