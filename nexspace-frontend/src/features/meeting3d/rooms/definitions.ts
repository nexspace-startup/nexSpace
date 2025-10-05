import type { NavVolumeDefinition, RoomBounds, RoomDefinition, RoomId, RoomPortal } from './types';

const ROOM_D = 34;

const makeBounds = (bounds: RoomBounds): RoomBounds => ({ ...bounds });

export const ROOM_DEFINITIONS: RoomDefinition[] = [
  {
    id: 'lobby',
    title: 'Lobby & Reception',
    label: 'Lobby',
    kind: 'lobby',
    order: 10,
    bounds: makeBounds({ minX: -9.5, maxX: 9.5, minZ: -16.2, maxZ: -6.4 }),
    defaultSpawn: { x: 0, z: -11.2 },
    description: 'Spawn, presence overview, and quick teleports.',
    accentColor: '#4f46e5',
  },
  {
    id: 'open-desk',
    title: 'Open Desk Area',
    label: 'Desks',
    kind: 'collaboration',
    order: 20,
    bounds: makeBounds({ minX: -20.0, maxX: 16.8, minZ: -6.6, maxZ: 13.0 }),
    defaultSpawn: { x: -1.0, z: 6.4 },
    description: 'Hot desks, collaboration tables, and shared resources.',
    accentColor: '#f97316',
  },
  {
    id: 'conference',
    title: 'Conference Rooms',
    label: 'Conference',
    kind: 'conference',
    order: 30,
    bounds: makeBounds({ minX: 6.2, maxX: 18.4, minZ: -12.4, maxZ: 6.4 }),
    defaultSpawn: { x: 11.5, z: -2.8 },
    description: 'Glass-walled rooms with screen share and private audio.',
    accentColor: '#38bdf8',
  },
  {
    id: 'focus-booths',
    title: 'Focus Booths',
    label: 'Focus',
    kind: 'focus',
    order: 40,
    bounds: makeBounds({ minX: -22.4, maxX: -8.6, minZ: -14.2, maxZ: 1.2 }),
    defaultSpawn: { x: -15.8, z: -6.2 },
    description: 'Heads-down pods with DND indicators and hush audio.',
    accentColor: '#34d399',
  },
  {
    id: 'cafe-lounge',
    title: 'Cafe & Lounge',
    label: 'Cafe',
    kind: 'social',
    order: 50,
    bounds: makeBounds({ minX: -5.6, maxX: 6.6, minZ: 4.0, maxZ: 15.0 }),
    defaultSpawn: { x: 0.8, z: 9.8 },
    description: 'Casual lounge, coffee bar, and game nook.',
    accentColor: '#fbbf24',
  },
];

const halfD = ROOM_D / 2;

export const ROOM_NAV_VOLUMES: NavVolumeDefinition[] = [
  // Primary volumes
  { id: 'lobby-core', roomId: 'lobby', bounds: makeBounds({ minX: -9.5, maxX: 9.5, minZ: -halfD + 1.4, maxZ: -6.4 }), priority: 6, primary: true },
  { id: 'open-core', roomId: 'open-desk', bounds: makeBounds({ minX: -20.0, maxX: 16.8, minZ: -5.8, maxZ: 13.0 }), priority: 5, primary: true },
  { id: 'conference-core', roomId: 'conference', bounds: makeBounds({ minX: 6.2, maxX: 18.4, minZ: -12.4, maxZ: 6.4 }), priority: 5, primary: true },
  { id: 'focus-core', roomId: 'focus-booths', bounds: makeBounds({ minX: -22.4, maxX: -8.6, minZ: -14.2, maxZ: 1.2 }), priority: 5, primary: true },
  { id: 'cafe-core', roomId: 'cafe-lounge', bounds: makeBounds({ minX: -5.6, maxX: 6.6, minZ: 4.0, maxZ: 15.0 }), priority: 5, primary: true },
  // Connectors (inherit the open desk room for now)
  { id: 'connector-open-lobby', roomId: 'open-desk', bounds: makeBounds({ minX: -5.0, maxX: 5.0, minZ: -8.2, maxZ: -5.4 }), priority: 3, primary: false },
  { id: 'connector-open-focus', roomId: 'open-desk', bounds: makeBounds({ minX: -10.2, maxX: -7.2, minZ: -6.8, maxZ: 1.6 }), priority: 3, primary: false },
  { id: 'connector-open-conference', roomId: 'open-desk', bounds: makeBounds({ minX: 5.6, maxX: 7.8, minZ: -6.4, maxZ: 2.6 }), priority: 3, primary: false },
  { id: 'connector-open-cafe', roomId: 'open-desk', bounds: makeBounds({ minX: -1.8, maxX: 2.2, minZ: 3.4, maxZ: 6.8 }), priority: 3, primary: false },
];

export const ROOM_PORTALS: RoomPortal[] = [
  {
    id: 'portal-lobby-open',
    rooms: ['lobby', 'open-desk'],
    position: { x: 0, z: -6.2 },
    radius: 2.6,
    label: 'Lobby Doors',
  },
  {
    id: 'portal-open-focus',
    rooms: ['open-desk', 'focus-booths'],
    position: { x: -9.0, z: -2.0 },
    radius: 1.9,
    label: 'Focus Entry',
  },
  {
    id: 'portal-open-conference',
    rooms: ['open-desk', 'conference'],
    position: { x: 6.5, z: -2.0 },
    radius: 1.9,
    label: 'Conference Door',
  },
  {
    id: 'portal-open-cafe',
    rooms: ['open-desk', 'cafe-lounge'],
    position: { x: 0.5, z: 4.6 },
    radius: 2.2,
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
