import type { NavVolumeDefinition, RoomAudioProfile, RoomBounds, RoomDefinition, RoomId, RoomPortal } from './types';

const ROOM_D = 44;

const makeBounds = (bounds: RoomBounds): RoomBounds => ({ ...bounds });
const makeProfile = (profile: RoomAudioProfile): RoomAudioProfile => ({ ...profile });

const DEFAULT_FALLOFF = 14;

export const ROOM_DEFINITIONS: RoomDefinition[] = [
  {
    id: 'lobby',
    title: 'Lobby & Reception',
    label: 'Lobby',
    kind: 'lobby',
    order: 10,
    bounds: makeBounds({ minX: -12.0, maxX: 12.0, minZ: -22.0, maxZ: -12.0 }),
    defaultSpawn: { x: 0, z: -17.0 },
    description: 'Reception, help desk, and fast teleports into the hub.',
    accentColor: '#4f46e5',
    audioProfile: makeProfile({ sameRoom: 0.95, adjacent: 0.65, remote: 0.35, falloffRadius: DEFAULT_FALLOFF + 4 }),
  },
  {
    id: 'open-desk',
    title: 'Open Desk Area',
    label: 'Desks',
    kind: 'collaboration',
    order: 20,
    bounds: makeBounds({ minX: -24.0, maxX: 18.0, minZ: -12.0, maxZ: 12.0 }),
    defaultSpawn: { x: -3.0, z: 0 },
    description: 'Hot desks, collaboration tables, and shared huddle zones.',
    accentColor: '#f97316',
    audioProfile: makeProfile({ sameRoom: 1.0, adjacent: 0.58, remote: 0.22, falloffRadius: DEFAULT_FALLOFF }),
  },
  {
    id: 'conference',
    title: 'Conference Rooms',
    label: 'Conference',
    kind: 'conference',
    order: 30,
    bounds: makeBounds({ minX: 18.0, maxX: 30.0, minZ: -10.0, maxZ: 10.0 }),
    defaultSpawn: { x: 24.0, z: 0 },
    description: 'Glass conference suite for private meetings and screen share.',
    accentColor: '#38bdf8',
    audioProfile: makeProfile({ sameRoom: 1.0, adjacent: 0.18, remote: 0.08, falloffRadius: DEFAULT_FALLOFF - 3 }),
  },
  {
    id: 'focus-booths',
    title: 'Focus Booths',
    label: 'Focus',
    kind: 'focus',
    order: 40,
    bounds: makeBounds({ minX: -30.0, maxX: -18.0, minZ: -10.0, maxZ: 8.0 }),
    defaultSpawn: { x: -24.0, z: -2.0 },
    description: 'Sound-dampened focus booths with DND indicators.',
    accentColor: '#34d399',
    audioProfile: makeProfile({ sameRoom: 0.9, adjacent: 0.16, remote: 0.06, falloffRadius: DEFAULT_FALLOFF - 4 }),
  },
  {
    id: 'cafe-lounge',
    title: 'Cafe & Lounge',
    label: 'Cafe',
    kind: 'social',
    order: 50,
    bounds: makeBounds({ minX: -10.0, maxX: 12.0, minZ: 12.0, maxZ: 22.0 }),
    defaultSpawn: { x: 1.0, z: 17.0 },
    description: 'Cafe lounge with coffee bar, sofas, and a game nook.',
    accentColor: '#fbbf24',
    audioProfile: makeProfile({ sameRoom: 0.85, adjacent: 0.5, remote: 0.2, falloffRadius: DEFAULT_FALLOFF + 2 }),
  },
];

const halfD = ROOM_D / 2;

export const ROOM_NAV_VOLUMES: NavVolumeDefinition[] = [
  // Primary volumes
  { id: 'lobby-core', roomId: 'lobby', bounds: makeBounds({ minX: -11.5, maxX: 11.5, minZ: -halfD + 1.0, maxZ: -12.4 }), priority: 6, primary: true },
  { id: 'open-core', roomId: 'open-desk', bounds: makeBounds({ minX: -23.0, maxX: 17.0, minZ: -10.8, maxZ: 11.6 }), priority: 5, primary: true },
  { id: 'conference-core', roomId: 'conference', bounds: makeBounds({ minX: 19.0, maxX: 29.0, minZ: -9.2, maxZ: 9.2 }), priority: 5, primary: true },
  { id: 'focus-core', roomId: 'focus-booths', bounds: makeBounds({ minX: -29.5, maxX: -18.5, minZ: -9.5, maxZ: 7.5 }), priority: 5, primary: true },
  { id: 'cafe-core', roomId: 'cafe-lounge', bounds: makeBounds({ minX: -9.2, maxX: 11.2, minZ: 12.8, maxZ: 21.6 }), priority: 5, primary: true },
  // Connectors (inherit the open desk room for now)
  { id: 'connector-open-lobby', roomId: 'open-desk', bounds: makeBounds({ minX: -6.0, maxX: 6.0, minZ: -13.6, maxZ: -9.8 }), priority: 3, primary: false },
  { id: 'connector-open-focus', roomId: 'open-desk', bounds: makeBounds({ minX: -24.4, maxX: -18.4, minZ: -6.4, maxZ: 5.6 }), priority: 3, primary: false },
  { id: 'connector-open-conference', roomId: 'open-desk', bounds: makeBounds({ minX: 17.6, maxX: 20.8, minZ: -5.6, maxZ: 6.0 }), priority: 3, primary: false },
  { id: 'connector-open-cafe', roomId: 'open-desk', bounds: makeBounds({ minX: -6.0, maxX: 6.0, minZ: 11.6, maxZ: 15.6 }), priority: 3, primary: false },
];

export const ROOM_PORTALS: RoomPortal[] = [
  {
    id: 'portal-lobby-open',
    rooms: ['lobby', 'open-desk'],
    position: { x: -2.5, z: -12.0 },
    radius: 3.2,
    label: 'Lobby Doors',
  },
  {
    id: 'portal-open-focus',
    rooms: ['open-desk', 'focus-booths'],
    position: { x: -18.0, z: -2.0 },
    radius: 2.4,
    label: 'Focus Entry',
  },
  {
    id: 'portal-open-conference',
    rooms: ['open-desk', 'conference'],
    position: { x: 18.0, z: -1.5 },
    radius: 2.4,
    label: 'Conference Door',
  },
  {
    id: 'portal-open-cafe',
    rooms: ['open-desk', 'cafe-lounge'],
    position: { x: 0, z: 12.0 },
    radius: 2.8,
    label: 'Cafe Threshold',
  },
];

const INITIAL_BOUNDS: RoomBounds = {
  minX: Infinity,
  maxX: -Infinity,
  minZ: Infinity,
  maxZ: -Infinity,
};

export const ROOM_NAV_GLOBAL_BOUNDS: RoomBounds = ROOM_NAV_VOLUMES.reduce((acc, vol) => ({
  minX: Math.min(acc.minX, vol.bounds.minX),
  maxX: Math.max(acc.maxX, vol.bounds.maxX),
  minZ: Math.min(acc.minZ, vol.bounds.minZ),
  maxZ: Math.max(acc.maxZ, vol.bounds.maxZ),
}), INITIAL_BOUNDS);

export const getRoomById = (id: RoomId): RoomDefinition | undefined =>
  ROOM_DEFINITIONS.find((room) => room.id === id);

export const getRoomCenter = (room: RoomDefinition) => ({
  x: (room.bounds.minX + room.bounds.maxX) * 0.5,
  z: (room.bounds.minZ + room.bounds.maxZ) * 0.5,
});
