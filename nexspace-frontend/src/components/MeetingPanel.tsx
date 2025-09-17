// src/components/MeetingPanel.tsx
import React, { useEffect, useCallback } from "react";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from "@livekit/components-react";
import "@livekit/components-styles";
import { useShallow } from "zustand/react/shallow";
import MeetingControls from "./MeetingControls";
import MeetingGrid from "./MeetingGrid";
import TopWidget from "./TopWidget";
import ChatPanel from "./ChatPanel";
import { useMeetingStore } from "../stores/meetingStore";

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

  return (
    <section className="relative flex-1 h-dvh overflow-hidden bg-[#202024]">
      {/* Top widget pill */}
      {canConnect && (
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

          {/* Main grid (fills, centers, leaves space for controls) */}
          <MeetingGrid pageSize={24} />

          {/* Audio + controls (overlay) */}
          <RoomAudioRenderer />
          <MeetingControls />
          <ChatPanel />
        </LiveKitRoom>
      )}
    </section>
  );
};

export default MeetingPanel;
