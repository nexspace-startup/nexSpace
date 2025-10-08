import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { PresenceStatus } from '../../../constants/enums';
import { defaultRooms, fallbackRoomId, type RoomDefinition } from '../config/rooms';
import { computeRoomLayout } from '../utils/layout';

export type Vector2 = { x: number; y: number };
export type QualityLevel = 'low' | 'medium' | 'high';

export type AvatarRuntimeState = {
  id: string;
  displayName: string;
  roomId: string;
  position: Vector2;
  status?: PresenceStatus;
  isLocal: boolean;
  avatarUrl?: string;
  lastActiveTs: number;
};

export type JoinNudge = {
  id: string;
  avatarId: string;
  roomId: string;
  displayName: string;
  timestamp: number;
};

type PartialAvatarInput = {
  id: string;
  displayName?: string;
  roomId?: string | null;
  position?: Vector2;
  status?: PresenceStatus;
  isLocal?: boolean;
  avatarUrl?: string;
};

type ThreeDState = {
  rooms: RoomDefinition[];
  localAvatarId: string | null;
  avatars: Record<string, AvatarRuntimeState>;
  minimapWaypoints: Record<string, Vector2 | null>;
  quality: QualityLevel;
  joinNudges: JoinNudge[];
  lastNudgeByAvatar: Record<string, number>;
  joinNudgeCooldownMs: number;
  setRooms: (rooms: RoomDefinition[]) => void;
  setLocalAvatarId: (id: string | null) => void;
  upsertAvatar: (input: PartialAvatarInput) => void;
  removeAvatar: (id: string) => void;
  markWaypoint: (avatarId: string, waypoint: Vector2 | null) => void;
  popJoinNudge: () => JoinNudge | null;
  clearJoinNudges: () => void;
  setQuality: (quality: QualityLevel) => void;
  getOccupantsForRoom: (roomId: string) => AvatarRuntimeState[];
};

const FALLBACK_POSITION: Vector2 = { x: 0, y: 0 };

const applyRoomLayout = (
  avatars: Record<string, AvatarRuntimeState>,
  rooms: RoomDefinition[],
): Record<string, AvatarRuntimeState> => {
  if (!rooms.length || !Object.keys(avatars).length) {
    return avatars;
  }

  const layout = computeRoomLayout(rooms, avatars);

  return Object.entries(avatars).reduce<Record<string, AvatarRuntimeState>>((acc, [id, avatar]) => {
    const nextPosition = layout[id] ?? avatar.position ?? FALLBACK_POSITION;
    acc[id] = { ...avatar, position: nextPosition };
    return acc;
  }, {});
};

export const useThreeDStore = create<ThreeDState>()(
  devtools((set, get) => ({
    rooms: defaultRooms,
    localAvatarId: null,
    avatars: {},
    minimapWaypoints: {},
    quality: 'medium',
    joinNudges: [],
    lastNudgeByAvatar: {},
    joinNudgeCooldownMs: 45_000,

    setRooms: (rooms) =>
      set((state) => ({
        rooms,
        avatars: applyRoomLayout(state.avatars, rooms),
      })),

    setLocalAvatarId: (id) => set({ localAvatarId: id }),

    setQuality: (quality) => set({ quality }),

    markWaypoint: (avatarId, waypoint) =>
      set((state) => ({
        minimapWaypoints: { ...state.minimapWaypoints, [avatarId]: waypoint },
      })),

    popJoinNudge: () => {
      const queue = get().joinNudges;
      if (!queue.length) return null;
      const [first, ...rest] = queue;
      set({ joinNudges: rest });
      return first;
    },

    clearJoinNudges: () => set({ joinNudges: [] }),

    removeAvatar: (id) =>
      set((state) => {
        if (!state.avatars[id]) return state;
        const nextAvatars = { ...state.avatars };
        delete nextAvatars[id];
        const nextWaypoints = { ...state.minimapWaypoints };
        delete nextWaypoints[id];
        const nextLastNudge = { ...state.lastNudgeByAvatar };
        delete nextLastNudge[id];
        const avatarsWithLayout = applyRoomLayout(nextAvatars, state.rooms);

        return {
          avatars: avatarsWithLayout,
          minimapWaypoints: nextWaypoints,
          lastNudgeByAvatar: nextLastNudge,
        };
      }),

    upsertAvatar: (input) =>
      set((state) => {
        if (!input.id) return state;
        const previous = state.avatars[input.id];
        const resolvedRoomId = input.roomId ?? previous?.roomId ?? fallbackRoomId;
        const resolvedPosition = input.position ?? previous?.position ?? FALLBACK_POSITION;
        const resolvedDisplayName = input.displayName ?? previous?.displayName ?? 'Participant';
        const resolvedStatus = input.status ?? previous?.status;
        const resolvedAvatarUrl = input.avatarUrl ?? previous?.avatarUrl;
        const resolvedIsLocal = input.isLocal ?? previous?.isLocal ?? false;

        const updated: AvatarRuntimeState = {
          id: input.id,
          roomId: resolvedRoomId,
          position: resolvedPosition,
          displayName: resolvedDisplayName,
          status: resolvedStatus,
          avatarUrl: resolvedAvatarUrl,
          isLocal: resolvedIsLocal,
          lastActiveTs: Date.now(),
        };

        let joinNudges = state.joinNudges;
        let lastNudgeByAvatar = state.lastNudgeByAvatar;

        const localId = state.localAvatarId ?? (resolvedIsLocal ? input.id : null);
        const localAvatar = localId
          ? input.id === localId
            ? updated
            : state.avatars[localId]
          : undefined;

        const roomChanged = previous?.roomId !== updated.roomId;
        const joinedLocalRoom =
          roomChanged && !updated.isLocal && localAvatar?.roomId === updated.roomId;

        if (joinedLocalRoom) {
          const now = Date.now();
          const lastNudgeAt = state.lastNudgeByAvatar[input.id] ?? 0;
          if (now - lastNudgeAt >= state.joinNudgeCooldownMs) {
            const nudge: JoinNudge = {
              id: `${input.id}:${now}`,
              avatarId: input.id,
              roomId: updated.roomId,
              displayName: resolvedDisplayName,
              timestamp: now,
            };
            joinNudges = [...state.joinNudges, nudge];
            lastNudgeByAvatar = { ...state.lastNudgeByAvatar, [input.id]: now };
          }
        }

        const nextAvatars = { ...state.avatars, [input.id]: updated };
        const avatarsWithLayout = applyRoomLayout(nextAvatars, state.rooms);

        return {
          avatars: avatarsWithLayout,
          localAvatarId: localId,
          joinNudges,
          lastNudgeByAvatar,
        };
      }),

    getOccupantsForRoom: (roomId) => {
      const avatars = get().avatars;
      return Object.values(avatars).filter((avatar) => avatar.roomId === roomId);
    },
  }))
);
