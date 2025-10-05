import { ROOM_DEFINITIONS, ROOM_NAV_VOLUMES, ROOM_PORTALS } from './definitions';
import type { NavVolumeDefinition, RoomBounds, RoomId } from './types';

export type NavVolumeRuntime = NavVolumeDefinition & { priority: number; primary: boolean };

const NAV_EPSILON = 0.08;

const normaliseVolume = (volume: NavVolumeDefinition): NavVolumeRuntime => ({
  ...volume,
  priority: volume.priority ?? 0,
  primary: volume.primary !== false,
});

export const getSortedNavVolumes = (
  volumes: readonly NavVolumeDefinition[] = ROOM_NAV_VOLUMES,
): NavVolumeRuntime[] => [...volumes.map(normaliseVolume)].sort((a, b) => b.priority - a.priority);

export const DEFAULT_SORTED_NAV_VOLUMES: NavVolumeRuntime[] = getSortedNavVolumes();

const pointWithinBounds = (bounds: RoomBounds, x: number, z: number) =>
  x >= bounds.minX - NAV_EPSILON &&
  x <= bounds.maxX + NAV_EPSILON &&
  z >= bounds.minZ - NAV_EPSILON &&
  z <= bounds.maxZ + NAV_EPSILON;

export const resolveRoomForPosition = (
  point: { x: number; z: number },
  volumes: readonly NavVolumeRuntime[] = DEFAULT_SORTED_NAV_VOLUMES,
): RoomId | null => {
  let fallback: RoomId | null = null;
  for (const volume of volumes) {
    if (pointWithinBounds(volume.bounds, point.x, point.z)) {
      if (volume.primary) {
        return volume.roomId;
      }
      if (!fallback) {
        fallback = volume.roomId;
      }
    }
  }
  return fallback;
};

export const createRoomPresenceRecord = (): Record<RoomId, number> => {
  const record = {} as Record<RoomId, number>;
  for (const room of ROOM_DEFINITIONS) {
    record[room.id] = 0;
  }
  return record;
};

export const getPortalsForRoom = (roomId: RoomId) =>
  ROOM_PORTALS.filter((portal) => portal.rooms.includes(roomId));

export const getAdjacentRooms = (roomId: RoomId): RoomId[] => {
  const neighbors = new Set<RoomId>();
  for (const portal of ROOM_PORTALS) {
    if (portal.rooms[0] === roomId) {
      neighbors.add(portal.rooms[1]);
    } else if (portal.rooms[1] === roomId) {
      neighbors.add(portal.rooms[0]);
    }
  }
  return Array.from(neighbors);
};

export const isPointInsideNavVolumes = (
  x: number,
  z: number,
  volumes: readonly NavVolumeRuntime[] = DEFAULT_SORTED_NAV_VOLUMES,
): boolean => {
  for (const volume of volumes) {
    if (pointWithinBounds(volume.bounds, x, z)) {
      return true;
    }
  }
  return false;
};
