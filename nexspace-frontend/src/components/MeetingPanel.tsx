// src/components/MeetingPanel.tsx
import React, { useEffect, useCallback, useMemo } from "react";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from "@livekit/components-react";
import "@livekit/components-styles";
import { useShallow } from "zustand/react/shallow";
import MeetingControls from "./MeetingControls";
import MeetingGrid from "./MeetingGrid";
import TopWidget from "./TopWidget";
import ChatPanel from "./ChatPanel";
import ThreeDExperience from "../features/threeDMode/components/ThreeDExperience";
import { useMeetingStore } from "../stores/meetingStore";
import { useUIStore } from "../stores/uiStore";
import { useMediaQuery } from "../hooks/useMedia";
import { useTick } from "../hooks/useTick";
import { fmtHMS } from "../utils/util";

const RoomBinder: React.FC = () => {
  const room = useRoomContext();
  const setRoom = useMeetingStore((s) => s.setRoom);
  useEffect(() => {
    setRoom(room ?? null);
    return () => setRoom(null);
  }, [room, setRoom]);
  return null;
};

const MeetingPanel: React.FC = () => {
  const {
    url,
    token,
    joining,
    joinActiveWorkspace,
    leave,
    micEnabled,
    camEnabled,
    whisperActive,
    whisperTargetSid,
    participants,
    chatOpen,
  } = useMeetingStore(
    useShallow((s) => ({
      url: s.url,
      token: s.token,
      joining: s.joining,
      joinActiveWorkspace: s.joinActiveWorkspace,
      leave: s.leave,
      micEnabled: s.micEnabled,
      camEnabled: s.camEnabled,
      whisperActive: s.whisperActive,
      whisperTargetSid: s.whisperTargetSid,
      participants: s.participants,
      chatOpen: s.chatOpen,
    }))
  );

  const onJoin = useCallback(() => joinActiveWorkspace(), [joinActiveWorkspace]);
  const onLeave = useCallback(() => leave(), [leave]);

  // TopWidget handles status, speakers, and participants display

  // Only render LiveKitRoom when BOTH url & token are present
  const canConnect = !!url && !!token;
  const isMobile = useMediaQuery('(max-width: 639px)'); // tailwind sm breakpoint is 640px
  const showTop = canConnect && !isMobile;
  const toggleWorkspacePanel = useUIStore((s) => s.toggleWorkspacePanel);
  const toggleNavbar = useUIStore((s) => s.toggleNavbar);

  // Mobile-only timer (moved out of control bar)
  const startedAt = useMeetingStore((s) => s.startedAt);
  const tick = useTick(canConnect);
  const elapsed = useMemo(() => {
    if (!canConnect || !startedAt) return "00 : 00 : 00";
    return fmtHMS(Date.now() - startedAt);
  }, [canConnect, startedAt, tick]);
  const viewMode = useMeetingStore((s) => s.viewMode);

  return (
    <section className="relative flex-1 h-dvh overflow-hidden bg-[#202024]">
      {/* Mobile: hamburger to open workspace drawer */}
      {isMobile && (
        <div className="absolute left-3 top-3 z-30 flex gap-2">
          {/* Navbar hamburger */}
          <button
            onClick={() => { toggleNavbar(true); toggleWorkspacePanel(false); }}
            className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#26272B] grid place-items-center"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/80">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
      {/* Mobile timer badge */}
      {canConnect && isMobile && (
        <div className="absolute right-3 top-3 z-30 flex items-center gap-2 px-3 h-9 rounded-full bg-[rgba(254,116,31,0.15)] border border-[#FE741F]/40">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 7v5l3 2" stroke="#FE741F" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="12" cy="12" r="8.5" stroke="#FE741F" strokeWidth="1.5" fill="none" />
          </svg>
          <span className="text-xs font-semibold text-[#FFD7BF] tabular-nums">{elapsed}</span>
        </div>
      )}
      {/* Top widget pill */}
      {showTop && (
        <>
          <TopWidget />
          {/* Leave button aligned with TopWidget (same height, top row, right aligned) */}
          <div className={`absolute top-8 z-20 ${chatOpen ? 'right-[408px]' : 'right-12'}`}>
            <button
              onClick={onLeave}
              className="h-[40px] w-[148px] rounded-[20px] bg-[#ED5C5B] text-white text-[14px] font-semibold flex items-center justify-center px-4 shadow-[1px_1px_15px_rgba(0,0,0,0.2)]"
              aria-label="Leave Workspace"
            >
              Leave Workspace
            </button>
          </div>
        </>
      )}

      {/* Whisper indicator */}
      {canConnect && whisperActive && (
        <div className="absolute left-1/2 -translate-x-1/2 top-4 z-20 px-3 py-1.5 rounded-full bg-[rgba(254,116,31,0.15)] border border-[#FE741F]/40 text-[#FFD7BF] text-sm">
          Whispering to {participants.find((p) => p.id === whisperTargetSid)?.name ?? "participant"}
        </div>
      )}

      {/* Stage */}
      {!canConnect ? (
        <div className="grid place-items-center h-full">
          <div className="flex flex-col items-center gap-6 w-[272px]">
            <p className="text-[18px] leading-[27px] text-[#80889B] text-center font-medium">
              Join this workspace to connect with your team.
            </p>
            <button
              onClick={onJoin}
              disabled={joining}
              className="btn-cta"
            >
              {joining ? "Joining…" : "Join Workspace"}
            </button>
          </div>
        </div>
      ) : (
        <LiveKitRoom
          serverUrl={url!}
          token={token}
          connect
          audio={micEnabled}
          video={camEnabled}
          onDisconnected={onLeave}
          className="h-full w-full"
          data-lk-theme="default"
        >
          <RoomBinder />

          {/* Stage: Grid or 3D */}
          {viewMode === '3d' ? (
            <ThreeDExperience />
          ) : (
            <MeetingGrid pageSize={24} bottomSafeAreaPx={isMobile ? 96 : 120} topSafeAreaPx={showTop ? 96 : 16} />
          )}

          {/* Audio + controls (overlay) */}
          <RoomAudioRenderer />
          <MeetingControls />
          <ChatPanel />
        </LiveKitRoom>
      )}
      {/* Drawer overlay rendered at Dashboard level */}
    </section>
  );
};

export default MeetingPanel;
