export type RoomBoundary =
  | { type: 'rect'; center: [number, number]; size: [number, number]; rotation?: number }
  | { type: 'circle'; center: [number, number]; radius: number };

export type AudioProfile = {
  falloff: 'linear' | 'logarithmic';
  minDistance: number;
  maxDistance: number;
  roomIsolation: number; // 0-1, 1 = fully isolated
};

export type RoomDefinition = {
  id: string;
  name: string;
  description?: string;
  themeColor: string;
  boundary: RoomBoundary;
  audio: AudioProfile;
  capacityHint?: number;
  signage?: string;
};

export const defaultRooms: RoomDefinition[] = [
  {
    id: 'open-work-area',
    name: 'Open Work Area',
    description: 'Collaborative desks with ambient spatial audio.',
    themeColor: '#5B8DFF',
    capacityHint: 25,
    boundary: { type: 'rect', center: [0, 0], size: [18, 14] },
    audio: { falloff: 'linear', minDistance: 1.5, maxDistance: 10, roomIsolation: 0.4 },
    signage: 'Heads-down focus, quick stand-ups welcome.',
  },
  {
    id: 'game-room',
    name: 'Game Room',
    description: 'Casual breakout tables for play & reset.',
    themeColor: '#FF8DA1',
    capacityHint: 10,
    boundary: { type: 'rect', center: [18, 6], size: [10, 8] },
    audio: { falloff: 'linear', minDistance: 1.2, maxDistance: 6, roomIsolation: 0.65 },
    signage: 'Launch a quick game and relax with teammates.',
  },
  {
    id: 'lounge-zone',
    name: 'Lounge / Coffee',
    description: 'Soft seating, serendipitous chats, casual syncs.',
    themeColor: '#F6C65B',
    capacityHint: 12,
    boundary: { type: 'circle', center: [6, -12], radius: 5 },
    audio: { falloff: 'linear', minDistance: 1.4, maxDistance: 7, roomIsolation: 0.55 },
    signage: 'Refill your mug and unwind together.',
  },
  {
    id: 'conference-room',
    name: 'Conference Room',
    description: 'Formal meetings, screen shares, and huddles.',
    themeColor: '#7AE582',
    capacityHint: 12,
    boundary: { type: 'rect', center: [-14, 8], size: [8, 10] },
    audio: { falloff: 'logarithmic', minDistance: 1.2, maxDistance: 4.5, roomIsolation: 0.85 },
    signage: 'Reserve for deep discussions and hybrid calls.',
  },
  {
    id: 'event-hall',
    name: 'Event Hall',
    description: 'Spotlight talks, all-hands, community events.',
    themeColor: '#A680FF',
    capacityHint: 50,
    boundary: { type: 'rect', center: [-4, 18], size: [20, 12] },
    audio: { falloff: 'logarithmic', minDistance: 2.5, maxDistance: 14, roomIsolation: 0.9 },
    signage: 'Presenters up front, audience anywhere in the hall.',
  },
];

export const fallbackRoomId = defaultRooms[0]?.id ?? 'open-work-area';
