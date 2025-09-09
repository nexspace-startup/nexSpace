// src/components/meeting/ProfileTile.tsx

// Import necessary dependencies from React and LiveKit
import React, { useEffect, useMemo, useState } from "react";
import type { Participant } from "livekit-client";
import { Track, ParticipantEvent } from "livekit-client";
import {
  useTracks,
  VideoTrack,
  isTrackReference,
} from "@livekit/components-react";
import { initialsFrom } from "../utils/util";

// Define the type for the component's props
type Props = { participant: Participant };

// Define the ProfileTileComponent, a functional component that displays a participant's profile
const ProfileTileComponent: React.FC<Props> = ({ participant }) => {
  // Extract the participant's name from the participant object
  const name = (participant as any)?.name ?? participant.identity;

  // Use the useTracks hook to fetch the participant's camera track
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false, participant }],
    { onlySubscribed: true }
  );

  // Use the useMemo hook to find the first subscribed camera track for the participant
  const camRef = useMemo(() => {
    const t = tracks.find(
      (tr) => isTrackReference(tr) && tr.source === Track.Source.Camera
    );
    return isTrackReference(t) ? t : undefined;
  }, [tracks]);

  // Determine whether to show the video track based on the track's subscription and mute status
  const showVideo = !!(camRef?.publication?.isSubscribed && !camRef.publication.isMuted);

  // Speaking state: subscribe to LiveKit event for reactive updates
  const [speaking, setSpeaking] = useState<boolean>(participant.isSpeaking ?? false);
  useEffect(() => {
    const onSpeak = (val: boolean) => setSpeaking(!!val);
    // livekit emits 'isSpeakingChanged'
    (participant as any).on?.(ParticipantEvent.IsSpeakingChanged, onSpeak);
    // seed initial state
    setSpeaking(!!(participant as any).isSpeaking);
    return () => {
      (participant as any).off?.(ParticipantEvent.IsSpeakingChanged, onSpeak);
    };
  }, [participant]);

  // Return the JSX for the profile tile
  return (
    <div
      // Set the container's styles
      className="
        relative w-[120px] h-[134px]
        rounded-xl bg-[#18181B]
        flex flex-col items-center justify-center gap-3
        isolate
      "
      style={{ isolation: "isolate" }}
    >
      <div className="relative w-[88px] h-[64px] flex items-center justify-center rounded-[12px]">
        <div className={["w-16 h-16 rounded-full overflow-hidden grid place-items-center", speaking ? "avatar-speaking" : ""].join(" ")}>
          {showVideo && camRef ? (
            // If the video track is available, render the VideoTrack component
            <VideoTrack
              trackRef={camRef}
              className="!w-full !h-full object-cover"
              data-lk-object-fit="cover"
            />
          ) : (
            // Otherwise, render a placeholder with the participant's initials
            <div className="w-full h-full bg-[#1F1F23] grid place-items-center">
              <span className="text-base font-semibold text-white">
                {initialsFrom(name)}
              </span>
            </div>
          )}

        </div>

        {/* presence badge */}
        <div className="absolute right-0 -top-1 w-5 h-5 rounded-full grid place-items-center bg-[rgba(255,192,136,0.33)] z-10">
          <svg width="12" height="12" viewBox="0 0 24 24">
            <path
              d="M21 12a9 9 0 1 1-9-9c-.9 1.7-1 3.7 0 5.5 1.5 2.7 4.8 3.8 7.5 2.5.3 0 .5 0 .5 1z"
              fill="#FFC088"
            />
          </svg>
        </div>



      </div>
      {/* name chip */}
      <div className="h-[26px] min-w-[88px] px-2 rounded-xl bg-[rgba(128,136,155,0.05)] opacity-80 grid place-items-center">
        <span className="text-[12px] leading-4 text-white truncate max-w-[80px]">
          {name}
        </span>
      </div>
    </div>
  );
};

// Export the ProfileTileComponent as the default export
export default ProfileTileComponent;
