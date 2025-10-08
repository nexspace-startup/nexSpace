import { useEffect, useRef } from 'react';
import { useMeetingStore } from '../../../stores/meetingStore';
import { useUserStore } from '../../../stores/userStore';
import { useThreeDStore } from '../store/threeDStore';
import { fallbackRoomId } from '../config/rooms';

export const useThreeDAvatarSync = (): void => {
  const participants = useMeetingStore((s) => s.participants);
  const presenceById = useMeetingStore((s) => s.presenceById);
  const localPresence = useMeetingStore((s) => s.localPresence);
  const localParticipantId = useMeetingStore(
    (s) => s.room?.localParticipant?.sid ?? s.room?.localParticipant?.identity ?? null,
  );
  const user = useUserStore((s) => s.user);

  const syncRoster = useThreeDStore((s) => s.syncRoster);
  const rooms = useThreeDStore((s) => s.rooms);

  const lastSnapshotRef = useRef<string | null>(null);
  const fallbackLocalIdRef = useRef<string>(`local-preview-${Math.random().toString(36).slice(2)}`);

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

    let roster = normalized;
    if (roster.length === 0) {
      roster = [
        {
          id: user?.id ?? fallbackLocalIdRef.current,
          displayName:
            user?.name ?? user?.firstName ?? user?.lastName ?? user?.email ?? 'You',
          avatarUrl: user?.avatar,
          status: localPresence,
          isLocal: true,
        },
      ];
    }

    const signature = JSON.stringify({
      participants: roster.map((entry) => ({
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

    const resolvedLocalId = roster.find((entry) => entry.isLocal)?.id ?? roster[0]?.id ?? null;
    syncRoster({
      participants: roster,
      fallbackRoomId: fallback,
      explicitLocalId: resolvedLocalId ?? localParticipantId,
    });
  }, [participants, presenceById, localPresence, localParticipantId, rooms, syncRoster, user]);
};
