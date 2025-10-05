// src/components/meeting/ProfileTile.tsx

// Import necessary dependencies from React and LiveKit
import React, { useEffect, useMemo, useState } from "react";
import type { Participant } from "livekit-client";
import { Track, ParticipantEvent } from "livekit-client";
import {
  useTracks,
  VideoTrack,
  isTrackReference,
  useRoomContext,
} from "@livekit/components-react";
import { initialsFrom } from "../utils/util";
import whisperIcon from "../assets/whisper_icon.svg";
import { useMeetingStore } from "../stores/meetingStore";
import { useUserStore } from "../stores/userStore";
import { useShallow } from "zustand/react/shallow";

// Define the type for the component's props
type Props = { participant: Participant };

// Define the ProfileTileComponent, a functional component that displays a participant's profile
const ProfileTileComponent: React.FC<Props> = ({ participant }) => {
  // Extract the participant's name from the participant object
  const name = (participant as any)?.name ?? participant.identity;
  const sid = (participant as any)?.sid ?? participant.identity;

  // Access room to determine if this tile is the local participant
  const room = useRoomContext();
  const localSid = (room?.localParticipant as any)?.sid ?? room?.localParticipant?.identity;
  const isSelf = sid === localSid;

  // Whisper controls
  const { startWhisper, stopWhisper, whisperActive, whisperTargetSid } = useMeetingStore(
    useShallow((s) => ({
      startWhisper: s.startWhisper,
      stopWhisper: s.stopWhisper,
      whisperActive: s.whisperActive,
      whisperTargetSid: s.whisperTargetSid,
    }))
  );
  const whisperOn = whisperActive && whisperTargetSid === sid;
  const avatarById = useMeetingStore((s) => s.avatarById);
  const userAvatar = useUserStore((s) => s.user?.avatar);
  const avatarUrl = avatarById[sid] || (isSelf ? userAvatar : undefined);

  // Memoize track subscription args to avoid re-subscribing every render
  const trackArgs = useMemo(
    () => [{ source: Track.Source.Camera, withPlaceholder: false }],
    []
  );
  const tracks = useTracks(trackArgs, { onlySubscribed: true });

  // Use the useMemo hook to find the first subscribed camera track for the participant
  const camRef = useMemo(() => {
    const t = tracks.find((tr) => {
      if (!isTrackReference(tr)) return false;
      if (tr.source !== Track.Source.Camera) return false;
      const ownerSid =
        (tr as any)?.participant?.sid ??
        (tr as any)?.participant?.identity ??
        (tr as any)?.publication?.participant?.sid ??
        (tr as any)?.publication?.participant?.identity;
      return ownerSid === sid;
    });
    return isTrackReference(t) ? t : undefined;
  }, [tracks, sid]);

  // Determine whether to show the video track based on the track's subscription and mute status
  const showVideo = !!(camRef?.publication?.isSubscribed && !camRef.publication.isMuted);

  // Speaking state: subscribe to LiveKit events for reactive updates (isSpeaking + audioLevel)
  const [speaking, setSpeaking] = useState<boolean>(participant.isSpeaking ?? false);
  const [levelSmooth, setLevelSmooth] = useState<number>(0);
  useEffect(() => {
    const onSpeak = (val: boolean) => setSpeaking(!!val);
    const onLevel = () => {
      /* smoothing handled in interval */
    };
    // livekit emits events
    (participant as any).on?.(ParticipantEvent.IsSpeakingChanged, onSpeak);
    // Poll audio level as some SDK builds may not expose the AudioLevelChanged event symbol in types
    // seed initial state
    setSpeaking(!!(participant as any).isSpeaking);
    onLevel();
    const iv = setInterval(() => {
      const v = (participant as any)?.audioLevel ?? 0;
      onLevel();
      setLevelSmooth((prev) => prev * 0.7 + (Number(v) || 0) * 0.3);
    }, 150);
    return () => {
      (participant as any).off?.(ParticipantEvent.IsSpeakingChanged, onSpeak);
      clearInterval(iv);
    };
  }, [participant]);
  // derive dynamic ring style based on who is speaking and audio level
  const baseRing = isSelf ? 70 : 76; // px
  const level = Math.max(0, Math.min(1, levelSmooth));
  const ringGrow = Math.round(level * 12); // up to +12px
  // Determine mic muted state; if muted, do not show ring
  const isMuted = useMemo(() => {
    try {
      const micEnabled = (participant as any)?.isMicrophoneEnabled;
      if (micEnabled === false) return true;
      const pubs: any[] = (participant as any).getTrackPublications?.() ?? Array.from((participant as any).trackPublications?.values?.() ?? []);
      const mic = pubs.find((p: any) => p?.source === Track.Source.Microphone || p?.kind === 'audio');
      if (!mic) return true;
      return !!(mic.isMuted ?? mic?.track?.isMuted ?? mic?.muted);
    } catch { return false; }
  }, [participant]);
  const ringSize = speaking && !isMuted ? baseRing + ringGrow : 0;
  // Smooth gradient (extra stops) for better transition
  const gradTop = isSelf ? "#F88634" : "#4285F4";
  const gradMid = isSelf ? "#FFA86D" : "#7DB0FF";
  const gradEnd = isSelf ? "#FFCCA7" : "#BED6FF";
  const ringGradientCss = `linear-gradient(180deg, ${gradTop} 0%, ${gradMid} 40%, ${gradEnd} 80%)`;
  // Subtle glow color scales with level
  const glowColor = isSelf ? "255, 168, 109" : "125, 176, 255";
  const glowPx = 6 + Math.round(level * 10);
  const glowAlpha = (0.08 + level * 0.22).toFixed(3);

  // Return the JSX for the profile tile
  return (
    <div
      className="relative w-[120px] h-[134px] rounded-2xl bg-[rgba(24,24,27,0.4)] shadow-[0_1px_15px_rgba(128,136,155,0.05)] flex flex-col items-center justify-center gap-3 isolate"
      style={{ isolation: "isolate" }}
    >
      <div className="relative w-[88px] h-[64px] flex items-center justify-center rounded-[12px]">
        {/* Dynamic speaking ring */}
        {speaking && ringSize > 0 && (
          <div
            className="absolute rounded-full z-0"
            style={{
              width: ringSize,
              height: ringSize,
              background: ringGradientCss,
              boxShadow: `0 0 ${glowPx}px ${Math.round(glowPx / 2)}px rgba(${glowColor}, ${glowAlpha})`,
              transition: "width 120ms ease-out, height 120ms ease-out, box-shadow 120ms ease-out",
            }}
            aria-hidden="true"
          />
        )}

        {/* Peak pulse halo */}
        {speaking && !isMuted && level > 0.75 && (
          <div
            className="absolute rounded-full z-0 pulse-ring"
            style={{
              width: ringSize + 8,
              height: ringSize + 8,
              border: `2px solid ${isSelf ? '#FFCCA7' : '#BED6FF'}`,
            }}
            aria-hidden="true"
          />
        )}

        {/* Avatar circle (64x64) */}
        <div
          className="absolute w-16 h-16 rounded-full overflow-hidden grid place-items-center z-10"
          style={{ border: `1px solid ${speaking && !isMuted ? (isSelf ? '#F88634' : '#4285F4') : '#26272B'}`, boxShadow: "0px 4px 15px rgba(0,0,0,0.2)", transition: "border-color 160ms ease" }}
        >
          {showVideo && camRef ? (
            <VideoTrack trackRef={camRef} className="!w-full !h-full object-cover" data-lk-object-fit="cover" />
          ) : (
            avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#1F1F23] grid place-items-center">
                <span className="text-base font-semibold text-white">{initialsFrom(name)}</span>
              </div>
            )
          )}
        </div>

        {/* Whisper toggle (top-right) */}
        {!isSelf && <button
          type="button"
          className={[
            "absolute -top-6 -right-6 w-9 h-9 rounded-full grid place-items-center z-20",
            "bg-[#202024] border border-[#26272B]",
            isSelf ? "opacity-40 cursor-not-allowed" : whisperOn ? "ring-1 ring-[#FE741F]" : "hover:bg-white/5",
          ].join(" ")}
          aria-label={whisperOn ? `Stop whisper to ${name}` : `Whisper to ${name}`}
          title={whisperOn ? "Stop whisper" : "Whisper"}
          onClick={() => { whisperOn ? stopWhisper() : startWhisper(sid); }}
          disabled={isSelf}
        >
          <img src={whisperIcon} alt="Whisper" className="w-4 h-4 opacity-80" />
        </button>}
      </div>

      {/* name chip */}
      <div className="h-[26px] min-w-[88px] px-2 rounded-xl bg-[rgba(128,136,155,0.05)] opacity-80 grid place-items-center z-10">
        <div className="flex items-center justify-center gap-2 max-w-[80px]" title={name} aria-label={name}>
          <span className="text-[12px] leading-4 text-white truncate">{name}</span>
          {/* Moon status icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="shrink-0">
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" fill="#FFC088" stroke="#FFC088" />
          </svg>
        </div>
      </div>
    </div>
  );
};

// Export the ProfileTileComponent as the default export
export default ProfileTileComponent;
