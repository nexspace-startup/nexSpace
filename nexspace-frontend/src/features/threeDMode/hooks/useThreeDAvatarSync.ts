import { useEffect } from 'react';
import { useMeetingStore } from '../../../stores/meetingStore';
import { useThreeDStore } from '../store/threeDStore';
import { fallbackRoomId } from '../config/rooms';

export const useThreeDAvatarSync = (): void => {
  const participants = useMeetingStore((s) => s.participants);
  const presenceById = useMeetingStore((s) => s.presenceById);
  const localPresence = useMeetingStore((s) => s.localPresence);

  const setLocalAvatarId = useThreeDStore((s) => s.setLocalAvatarId);
  const upsertAvatar = useThreeDStore((s) => s.upsertAvatar);
  const removeAvatar = useThreeDStore((s) => s.removeAvatar);
  const rooms = useThreeDStore((s) => s.rooms);

  useEffect(() => {
    const fallback = rooms[0]?.id ?? fallbackRoomId;
    const seen = new Set<string>();
    const existing = useThreeDStore.getState().avatars;

    participants.forEach((participant, index) => {
      if (!participant?.id) return;
      const isLocal = index === 0;
      if (isLocal) setLocalAvatarId(participant.id);

      const presenceRecord = presenceById[participant.id];
      const status = presenceRecord?.status ?? (isLocal ? localPresence : undefined);
      const previous = existing[participant.id];

      upsertAvatar({
        id: participant.id,
        displayName: participant.name ?? participant.email ?? 'Guest',
        avatarUrl: participant.avatar,
        roomId: previous?.roomId ?? fallback,
        status,
        isLocal,
      });

      seen.add(participant.id);
    });

    Object.keys(existing).forEach((id) => {
      if (!seen.has(id)) removeAvatar(id);
    });
  }, [participants, presenceById, localPresence, setLocalAvatarId, upsertAvatar, removeAvatar, rooms]);
};
