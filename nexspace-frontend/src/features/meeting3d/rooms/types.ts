export type RoomId =
  | 'lobby'
  | 'open-desk'
  | 'conference'
  | 'focus-booths'
  | 'cafe-lounge';

export type RoomKind =
  | 'lobby'
  | 'collaboration'
  | 'conference'
  | 'focus'
  | 'social';

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type RoomAudioProfile = {
  /** Volume multiplier when both participants share the room. */
  sameRoom: number;
  /** Volume multiplier when rooms are adjacent/connected. */
  adjacent: number;
  /** Volume multiplier when rooms are distant. */
  remote: number;
  /** Distance in meters before falloff reaches the minimum volume. */
  falloffRadius: number;
};

export type RoomDefinition = {
  id: RoomId;
  title: string;
  label: string;
  kind: RoomKind;
  order: number;
  bounds: RoomBounds;
  defaultSpawn: { x: number; z: number };
  description?: string;
  accentColor: string;
  audioProfile?: RoomAudioProfile;
};

export type RoomPortal = {
  id: string;
  /** Tuple of connected rooms (bidirectional). */
  rooms: [RoomId, RoomId];
  position: { x: number; z: number };
  radius: number;
  label?: string;
};

export type NavVolumeDefinition = {
  id: string;
  roomId: RoomId;
  bounds: RoomBounds;
  /** Higher numbers win when resolving the active room at a position. */
  priority?: number;
  /** Mark false for connector strips that should not win over primaries. */
  primary?: boolean;
};
