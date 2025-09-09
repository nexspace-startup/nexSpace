// src/components/MeetingPanel.tsx
import React, { useEffect, useCallback } from "react";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from "@livekit/components-react";
import "@livekit/components-styles";
import { useShallow } from "zustand/react/shallow";
import MeetingControls from "./MeetingControls";
import MeetingGrid from "./MeetingGrid";
import TopWidget from "./TopWidget";
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
  } = useMeetingStore(
    useShallow((s) => ({
      url: s.url,
      token: s.token,
      joining: s.joining,
      joinActiveWorkspace: s.joinActiveWorkspace,
      leave: s.leave,
      micEnabled: s.micEnabled,
      camEnabled: s.camEnabled,
    }))
  );

  const onJoin = useCallback(() => joinActiveWorkspace(), [joinActiveWorkspace]);
  const onLeave = useCallback(() => leave(), [leave]);

  // TopWidget handles status, speakers, and participants display

  // Only render LiveKitRoom when BOTH url & token are present
  const canConnect = !!url && !!token;

  return (
    <section className="relative flex-1 h-screen overflow-hidden bg-[#202024]">
      {/* Top widget pill */}
      {canConnect && <TopWidget />}

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
          <MeetingGrid pageSize={24} cols={4} />

          {/* Audio + controls (overlay) */}
          <RoomAudioRenderer />
          <MeetingControls />
        </LiveKitRoom>
      )}
    </section>
  );
};

export default MeetingPanel;
