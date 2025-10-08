import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { PresenceStatus } from '../../../constants/enums';
import { defaultRooms, fallbackRoomId, type RoomDefinition } from '../config/rooms';
import { computeRoomLayout } from '../utils/layout';
import { clampToCampusBounds, resolveRoomForPosition } from '../utils/spatial';

export type Vector2 = { x: number; y: number };
export type QualityLevel = 'low' | 'medium' | 'high';

export type CameraMode = 'first-person' | 'third-person';

export type AvatarRuntimeState = {
  id: string;
  displayName: string;
  roomId: string;
  position: Vector2;
  status?: PresenceStatus;
  isLocal: boolean;
  avatarUrl?: string;
  lastActiveTs: number;
  heading: number;
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
  cameraMode: CameraMode;
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
  setCameraMode: (mode: CameraMode) => void;
  setAvatarPosition: (id: string, position: Vector2) => void;
  syncRoster: (payload: {
    participants: Array<Pick<PartialAvatarInput, 'id' | 'displayName' | 'avatarUrl' | 'status' | 'isLocal'>>;
    fallbackRoomId: string;
    explicitLocalId: string | null;
  }) => void;
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
    if (avatar.isLocal) {
      acc[id] = avatar;
      return acc;
    }

    const nextPosition = layout[id] ?? avatar.position ?? FALLBACK_POSITION;
    acc[id] = { ...avatar, position: nextPosition, heading: avatar.heading ?? 0 };
    return acc;
  }, {});
};

const positionsEqual = (a: Vector2, b: Vector2): boolean => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001;
};

export const useThreeDStore = create<ThreeDState>()(
  devtools((set, get) => ({
    rooms: defaultRooms,
    localAvatarId: null,
    avatars: {},
    minimapWaypoints: {},
    quality: 'medium',
    cameraMode: 'third-person',
    joinNudges: [],
    lastNudgeByAvatar: {},
    joinNudgeCooldownMs: 45_000,

    setRooms: (rooms) =>
      set((state) => ({
        rooms,
        avatars: applyRoomLayout(state.avatars, rooms),
      })),

    setLocalAvatarId: (id) =>
      set((state) => {
        if (state.localAvatarId === id) {
          return state;
        }

        return { localAvatarId: id };
      }),

    setQuality: (quality) => set({ quality }),

    setCameraMode: (mode) =>
      set((state) => {
        if (state.cameraMode === mode) {
          return state;
        }
        return { cameraMode: mode };
      }),

    markWaypoint: (avatarId, waypoint) =>
      set((state) => ({
        minimapWaypoints: { ...state.minimapWaypoints, [avatarId]: waypoint },
      })),

    setAvatarPosition: (id, position) =>
      set((state) => {
        const avatar = state.avatars[id];
        if (!avatar) return state;

        const clamped = clampToCampusBounds(position, state.rooms);
        const nextRoomId = resolveRoomForPosition(clamped, state.rooms, fallbackRoomId);

        const dx = clamped.x - avatar.position.x;
        const dy = clamped.y - avatar.position.y;
        const delta = Math.hypot(dx, dy);
        const nextHeading = delta < 0.001 ? avatar.heading : Math.atan2(dx, dy);

        if (
          positionsEqual(avatar.position, clamped) &&
          avatar.roomId === nextRoomId &&
          Math.abs((avatar.heading ?? 0) - nextHeading) < 0.001
        ) {
          return state;
        }

        const nextAvatar: AvatarRuntimeState = {
          ...avatar,
          position: clamped,
          roomId: nextRoomId,
          lastActiveTs: Date.now(),
          heading: Number.isFinite(nextHeading) ? nextHeading : avatar.heading,
        };

        const patch: Partial<ThreeDState> = {
          avatars: { ...state.avatars, [id]: nextAvatar },
        };

        if (avatar.roomId !== nextRoomId && id !== state.localAvatarId) {
          const now = Date.now();
          if (now - (state.lastNudgeByAvatar[id] ?? 0) >= state.joinNudgeCooldownMs) {
            patch.joinNudges = [
              ...state.joinNudges,
              {
                id: `${id}:${now}`,
                avatarId: id,
                roomId: nextRoomId,
                displayName: avatar.displayName,
                timestamp: now,
              },
            ];
            patch.lastNudgeByAvatar = { ...state.lastNudgeByAvatar, [id]: now };
          }
        }

        return patch;
      }),

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

    syncRoster: ({ participants, fallbackRoomId: fallback, explicitLocalId }) =>
      set((state) => {
        const safeFallback = fallback || state.rooms[0]?.id || fallbackRoomId;
        const now = Date.now();
        const nextAvatars: Record<string, AvatarRuntimeState> = {};

        participants.forEach((participant) => {
          const previous = state.avatars[participant.id];
          const resolvedRoomId = previous?.roomId ?? safeFallback;
          const resolvedPosition = previous?.position ?? FALLBACK_POSITION;
          const resolvedDisplayName = participant.displayName ?? previous?.displayName ?? 'Participant';
          const resolvedStatus = participant.status ?? previous?.status;
          const resolvedAvatarUrl = participant.avatarUrl ?? previous?.avatarUrl;
          const resolvedIsLocal = participant.isLocal ?? previous?.isLocal ?? false;

          const changed =
            !previous ||
            previous.roomId !== resolvedRoomId ||
            previous.displayName !== resolvedDisplayName ||
            previous.status !== resolvedStatus ||
            previous.avatarUrl !== resolvedAvatarUrl ||
            previous.isLocal !== resolvedIsLocal;

          nextAvatars[participant.id] = {
            id: participant.id,
            roomId: resolvedRoomId,
            position: resolvedPosition,
            displayName: resolvedDisplayName,
            status: resolvedStatus,
            avatarUrl: resolvedAvatarUrl,
            isLocal: resolvedIsLocal,
            lastActiveTs: changed ? now : previous?.lastActiveTs ?? now,
            heading: previous?.heading ?? 0,
          };
        });

        const avatarIds = new Set(Object.keys(nextAvatars));

        const filteredWaypoints = Object.entries(state.minimapWaypoints).reduce<Record<string, Vector2 | null>>(
          (acc, [id, waypoint]) => {
            if (avatarIds.has(id)) {
              acc[id] = waypoint;
            }
            return acc;
          },
          {},
        );

        const nextLocalAvatarId =
          participants.find((participant) => participant.isLocal)?.id ?? explicitLocalId ?? state.localAvatarId ?? null;

        const localAvatar = nextLocalAvatarId ? nextAvatars[nextLocalAvatarId] ?? state.avatars[nextLocalAvatarId] : undefined;

        const retainedJoinNudges = state.joinNudges.filter((nudge) => avatarIds.has(nudge.avatarId));
        let joinQueue =
          retainedJoinNudges.length === state.joinNudges.length ? state.joinNudges : retainedJoinNudges;

        let lastNudge: Record<string, number> = state.lastNudgeByAvatar;
        let lastNudgeChanged = false;
        Object.keys(state.lastNudgeByAvatar).forEach((id) => {
          if (!avatarIds.has(id)) {
            if (!lastNudgeChanged) {
              lastNudge = { ...state.lastNudgeByAvatar };
              lastNudgeChanged = true;
            }
            delete lastNudge[id];
          }
        });

        if (localAvatar) {
          participants.forEach((participant) => {
            if (participant.id === localAvatar.id) return;
            const previous = state.avatars[participant.id];
            const current = nextAvatars[participant.id];
            if (!current) return;
            const movedRooms = previous?.roomId !== current.roomId;
            if (!movedRooms || current.roomId !== localAvatar.roomId) {
              return;
            }
            const lastNudgeAt = lastNudge[participant.id] ?? 0;
            if (now - lastNudgeAt < state.joinNudgeCooldownMs) {
              return;
            }
            const nudge: JoinNudge = {
              id: `${participant.id}:${now}`,
              avatarId: participant.id,
              roomId: current.roomId,
              displayName: current.displayName,
              timestamp: now,
            };
            if (joinQueue === state.joinNudges) {
              joinQueue = [...state.joinNudges, nudge];
            } else {
              joinQueue.push(nudge);
            }
            if (!lastNudgeChanged) {
              lastNudge = { ...lastNudge };
              lastNudgeChanged = true;
            }
            lastNudge[participant.id] = now;
          });
        }

        const avatarsWithLayout = applyRoomLayout(nextAvatars, state.rooms);

        const prevAvatars = state.avatars;
        const prevIds = Object.keys(prevAvatars);
        const nextIds = Object.keys(avatarsWithLayout);
        const sameCount = prevIds.length === nextIds.length;
        const avatarsChanged =
          !sameCount ||
          nextIds.some((id) => {
            const nextAvatar = avatarsWithLayout[id];
            const prevAvatar = prevAvatars[id];
            if (!prevAvatar) return true;
            return (
              prevAvatar.roomId !== nextAvatar.roomId ||
              prevAvatar.displayName !== nextAvatar.displayName ||
              prevAvatar.status !== nextAvatar.status ||
              prevAvatar.avatarUrl !== nextAvatar.avatarUrl ||
              prevAvatar.isLocal !== nextAvatar.isLocal ||
              prevAvatar.lastActiveTs !== nextAvatar.lastActiveTs ||
              !positionsEqual(prevAvatar.position, nextAvatar.position) ||
              Math.abs((prevAvatar.heading ?? 0) - (nextAvatar.heading ?? 0)) > 0.001
            );
          });

        const waypointsChanged =
          Object.keys(state.minimapWaypoints).length !== Object.keys(filteredWaypoints).length ||
          Object.entries(filteredWaypoints).some(([id, waypoint]) => state.minimapWaypoints[id] !== waypoint);

        const localChanged = state.localAvatarId !== nextLocalAvatarId;
        const nudgesChanged = joinQueue !== state.joinNudges;
        const lastNudgeMutated = lastNudgeChanged || lastNudge !== state.lastNudgeByAvatar;

        if (!avatarsChanged && !waypointsChanged && !localChanged && !nudgesChanged && !lastNudgeMutated) {
          return state;
        }

        const patch: Partial<ThreeDState> = {};
        if (avatarsChanged) {
          patch.avatars = avatarsWithLayout;
        }
        if (waypointsChanged) {
          patch.minimapWaypoints = filteredWaypoints;
        }
        if (localChanged) {
          patch.localAvatarId = nextLocalAvatarId;
        }
        if (nudgesChanged) {
          patch.joinNudges = joinQueue;
        }
        if (lastNudgeMutated) {
          patch.lastNudgeByAvatar = lastNudge;
        }

        return patch;
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
        const resolvedHeading = previous?.heading ?? 0;

        let joinNudges = state.joinNudges;
        let lastNudgeByAvatar = state.lastNudgeByAvatar;

        const localId = state.localAvatarId ?? (resolvedIsLocal ? input.id : null);

        const noChange =
          !!previous &&
          previous.roomId === resolvedRoomId &&
          previous.displayName === resolvedDisplayName &&
          previous.status === resolvedStatus &&
          previous.avatarUrl === resolvedAvatarUrl &&
          previous.isLocal === resolvedIsLocal &&
          positionsEqual(previous.position, resolvedPosition) &&
          Math.abs((previous.heading ?? 0) - resolvedHeading) < 0.001 &&
          state.localAvatarId === localId;

        if (noChange) {
          return state;
        }

        const updated: AvatarRuntimeState = {
          id: input.id,
          roomId: resolvedRoomId,
          position: resolvedPosition,
          displayName: resolvedDisplayName,
          status: resolvedStatus,
          avatarUrl: resolvedAvatarUrl,
          isLocal: resolvedIsLocal,
          lastActiveTs: Date.now(),
          heading: resolvedHeading,
        };
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

        const patch: Partial<ThreeDState> = {
          avatars: avatarsWithLayout,
          joinNudges,
          lastNudgeByAvatar,
        };

        if (state.localAvatarId !== localId) {
          patch.localAvatarId = localId;
        }

        return patch;
      }),

    getOccupantsForRoom: (roomId) => {
      const avatars = get().avatars;
      return Object.values(avatars).filter((avatar) => avatar.roomId === roomId);
    },
  }))
);
