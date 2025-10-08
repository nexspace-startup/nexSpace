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

  const syncRoster = useThreeDStore((s) => s.syncRoster);
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

    const resolvedLocalId = normalized.find((entry) => entry.isLocal)?.id ?? normalized[0]?.id ?? null;
    syncRoster({
      participants: normalized,
      fallbackRoomId: fallback,
      explicitLocalId: resolvedLocalId ?? localParticipantId,
    });
  }, [participants, presenceById, localPresence, localParticipantId, rooms, syncRoster]);
};
