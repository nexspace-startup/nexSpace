import { useEffect, useMemo, useRef } from 'react';
import { RoomEvent, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
import { useMeetingStore } from '../../../stores/meetingStore';
import { useThreeDStore } from '../store/threeDStore';

const MIN_VOLUME = 0.02;

const computeDistance = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const computeFalloff = (
  distance: number,
  minDistance: number,
  maxDistance: number,
  mode: 'linear' | 'logarithmic',
): number => {
  if (distance <= minDistance) return 1;
  if (distance >= maxDistance) return 0;
  const t = (distance - minDistance) / Math.max(0.0001, maxDistance - minDistance);
  if (mode === 'logarithmic') {
    return Math.pow(1 - t, 2.2);
  }
  return 1 - t;
};

const setPublicationVolume = (
  publication: RemoteTrackPublication,
  participant: RemoteParticipant,
  volume: number,
  cache: Map<string, number>,
) => {
  const track = publication.audioTrack;
  if (!track) return;
  const participantId = participant.sid ?? participant.identity;
  const key = publication.trackSid ?? track.sid ?? `${participantId}:${publication.source ?? 'unknown'}`;
  const previous = cache.get(key);
  if (previous !== undefined && Math.abs(previous - volume) < 0.01) {
    return;
  }
  cache.set(key, volume);
  try {
    if ('setVolume' in track && typeof track.setVolume === 'function') {
      track.setVolume(volume);
    }
  } catch {
    // Ignore errors from LiveKit when tracks are not ready yet
  }
};

export const useSpatialAudioRouting = (): void => {
  const room = useMeetingStore((s) => s.room);
  const speakerEnabled = useMeetingStore((s) => s.speakerEnabled);
  const localAvatarId = useThreeDStore((s) => s.localAvatarId);
  const rooms = useThreeDStore((s) => s.rooms);

  const cacheRef = useRef<Map<string, number>>(new Map());

  const roomById = useMemo(() => {
    const map = new Map<string, typeof rooms[number]>();
    rooms.forEach((roomDef) => map.set(roomDef.id, roomDef));
    return map;
  }, [rooms]);

  useEffect(() => {
    if (!room) return;

    const updateVolumes = () => {
      const state = useThreeDStore.getState();
      if (!localAvatarId) return;
      const local = state.avatars[localAvatarId];
      if (!local) return;

      const localRoom = roomById.get(local.roomId);

      const participants = Array.from(room.remoteParticipants.values()) as RemoteParticipant[];
      participants.forEach((participant) => {
        const remoteId = participant.sid ?? participant.identity;
        const avatar = state.avatars[remoteId];
        if (!avatar) return;

        const remoteRoom = roomById.get(avatar.roomId);
        const distance = computeDistance(local.position, avatar.position);
        const profile = remoteRoom?.audio ?? localRoom?.audio;
        const minDistance = profile?.minDistance ?? 1.5;
        const maxDistance = profile?.maxDistance ?? 10;
        const falloff = computeFalloff(distance, minDistance, maxDistance, profile?.falloff ?? 'linear');
        const isolationFactor = remoteRoom?.id === local.roomId
          ? 1
          : Math.max(0, 1 - Math.max(remoteRoom?.audio.roomIsolation ?? 0, localRoom?.audio.roomIsolation ?? 0));

        let baseVolume = speakerEnabled ? falloff * isolationFactor : 0;
        if (baseVolume > 0) {
          baseVolume = Math.max(baseVolume, MIN_VOLUME);
        }

        const publications: RemoteTrackPublication[] =
          typeof participant.getTrackPublications === 'function'
            ? (participant.getTrackPublications() as RemoteTrackPublication[])
            : participant.trackPublications
              ? (Array.from(participant.trackPublications.values()) as RemoteTrackPublication[])
              : [];

        publications.forEach((publication) => {
          if (publication.kind !== 'audio') return;
          setPublicationVolume(publication, participant, baseVolume, cacheRef.current);
        });
      });
    };

    updateVolumes();

    const unsubscribe = useThreeDStore.subscribe((state, previousState) => {
      if (state.avatars !== previousState.avatars || state.rooms !== previousState.rooms) {
        updateVolumes();
      }
    });

    const handleTrack = () => updateVolumes();
    room.on(RoomEvent.TrackSubscribed, handleTrack);
    room.on(RoomEvent.TrackUnsubscribed, handleTrack);
    room.on(RoomEvent.TrackPublished, handleTrack);

    return () => {
      unsubscribe();
      room.off(RoomEvent.TrackSubscribed, handleTrack);
      room.off(RoomEvent.TrackUnsubscribed, handleTrack);
      room.off(RoomEvent.TrackPublished, handleTrack);
    };
  }, [room, localAvatarId, roomById, speakerEnabled]);

  useEffect(() => {
    cacheRef.current.clear();
  }, [localAvatarId, roomById, speakerEnabled]);
};
