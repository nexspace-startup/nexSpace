import { useEffect, useRef } from 'react';
import { useMeetingStore } from '../../../stores/meetingStore';
import { useThreeDStore } from '../store/threeDStore';
import { fallbackRoomId } from '../config/rooms';

export const useThreeDAvatarSync = (): void => {
  const participants = useMeetingStore((s) => s.participants);
  const presenceById = useMeetingStore((s) => s.presenceById);
  const localPresence = useMeetingStore((s) => s.localPresence);
  const localParticipantId = useMeetingStore(
    (s) => s.room?.localParticipant?.sid ?? s.room?.localParticipant?.identity ?? null,
  );

  const setLocalAvatarId = useThreeDStore((s) => s.setLocalAvatarId);
  const upsertAvatar = useThreeDStore((s) => s.upsertAvatar);
  const removeAvatar = useThreeDStore((s) => s.removeAvatar);
  const rooms = useThreeDStore((s) => s.rooms);

  const lastSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    const fallback = rooms[0]?.id ?? fallbackRoomId;

    const normalized = participants.map((participant, index) => {
      const { id } = participant;
      const derivedLocal = localParticipantId ? id === localParticipantId : index === 0;
      const presenceRecord = presenceById[id];
      const status = presenceRecord?.status ?? (derivedLocal ? localPresence : undefined);

      return {
        id,
        displayName: participant.name ?? participant.email ?? 'Guest',
        avatarUrl: participant.avatar,
        status,
        isLocal: derivedLocal,
      };
    });

    const signature = JSON.stringify({
      participants: normalized.map((entry) => ({
        id: entry.id,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl ?? null,
        status: entry.status ?? null,
        isLocal: entry.isLocal,
      })),
      rooms: rooms.map((room) => room.id),
    });

    if (lastSnapshotRef.current === signature) {
      return;
    }
    lastSnapshotRef.current = signature;

    const existing = useThreeDStore.getState().avatars;
    const seen = new Set<string>();

    const resolvedLocalId = normalized.find((entry) => entry.isLocal)?.id ?? normalized[0]?.id ?? null;
    setLocalAvatarId(resolvedLocalId ?? null);

    normalized.forEach((participant) => {
      const previous = existing[participant.id];
      upsertAvatar({
        id: participant.id,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl,
        roomId: previous?.roomId ?? fallback,
        status: participant.status,
        isLocal: participant.isLocal,
      });
      seen.add(participant.id);
    });

    Object.keys(existing).forEach((id) => {
      if (!seen.has(id)) {
        removeAvatar(id);
      }
    });
  }, [
    participants,
    presenceById,
    localPresence,
    localParticipantId,
    rooms,
    setLocalAvatarId,
    upsertAvatar,
    removeAvatar,
  ]);
};
