import type { RoomId } from '../rooms/types';

export type Mode = 'dark' | 'light';

export type RoomColor = { base: number; accent: number };

export type RoomPaletteKey =
  | 'lobby'
  | 'open'
  | 'conference'
  | 'focus'
  | 'lounge'
  | 'game'
  | 'kitchen';

export type RoomVisualTarget = RoomId | 'game' | 'kitchen';

export type FurniturePalette = {
  sofaFabric: number;
  sofaLegs: number;
  chairSeat: number;
  chairFrame: number;
  chairPlastic: number;
  conferenceTableTop: number;
  conferenceTableLegs: number;
  gameTableTop: number;
  gameTableLeg: number;
  coffeeCounter: number;
  coffeeMachineBody: number;
  coffeeMachineAccent: number;
  plantPot: number;
  plantLeaf: number;
};

export type LightingPalette = {
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dirColor: number;
  dirIntensity: number;
  dirPosition: { x: number; y: number; z: number };
  ambientColor: number;
  ambientIntensity: number;
  fillColor: number;
  fillIntensity: number;
  fillSize: { width: number; height: number };
};

export type SignagePalette = {
  panel: string;
  border: string;
  text: string;
  glow: string;
};

export type MinimapPalette = {
  background: string;
  border: string;
  text: string;
  accent: string;
  roomFill: string;
  roomStroke: string;
  door: string;
  landmark: string;
  activeBg: string;
  suggestedBg: string;
  stageFill: string;
  stageFillStrong: string;
  stageStroke: string;
  remote: string;
  remoteGlow: string;
  remoteLabel: string;
  you: string;
  youGlow: string;
};

export type ModePalette = {
  accent: number;
  surroundWalls: number;
  wallTrim: number;
  ceiling: number;
  ceilingGrid: string;
  rugLight: number;
  rugDark: number;
  sky: number;
  fogColor: number;
  fogDensity: number;
  floorBase: number;
  floorTiles: number[];
  floorGrout: number;
  floorZoneTint: number;
  floorZoneOpacity: number;
  gridBg: string;
  gridMinor: string;
  gridMajor: string;
  signage: SignagePalette;
  minimap: MinimapPalette;
  lighting: LightingPalette;
  furniture: FurniturePalette;
  rooms: Record<RoomPaletteKey, RoomColor>;
};

export const ROOM_ID_TO_PALETTE: Record<RoomId, RoomPaletteKey> = {
  lobby: 'lobby',
  'open-desk': 'open',
  conference: 'conference',
  'focus-booths': 'focus',
  'cafe-lounge': 'lounge',
};

export const ROOM_VISUAL_KEY: Record<RoomVisualTarget, RoomPaletteKey> = {
  lobby: 'lobby',
  'open-desk': 'open',
  conference: 'conference',
  'focus-booths': 'focus',
  'cafe-lounge': 'lounge',
  game: 'game',
  kitchen: 'kitchen',
};

export const numberToHex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;

export const numberToRgba = (value: number, alpha = 1): string => {
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const resolveRoomPaletteKey = (id: RoomVisualTarget): RoomPaletteKey => ROOM_VISUAL_KEY[id];

export const getRoomPalette = (palette: ModePalette, id: RoomVisualTarget): RoomColor =>
  palette.rooms[resolveRoomPaletteKey(id)];

export const MODE_PALETTE: Record<Mode, ModePalette> = {
  light: {
    accent: 0x2b6af6,
    surroundWalls: 0xe7ebf2,
    wallTrim: 0xd5dae3,
    ceiling: 0xf8f9fb,
    ceilingGrid: 'rgba(126,138,160,0.18)',
    rugLight: 0xf4f5f7,
    rugDark: 0xd4d6dc,
    sky: 0xf1f5ff,
    fogColor: 0xe8eef6,
    fogDensity: 0.0065,
    floorBase: 0xf4f1ea,
    floorTiles: [0xe5dfd4, 0xd8d1c6, 0xcac3b8],
    floorGrout: 0xd4ccc0,
    floorZoneTint: 0x94a3b8,
    floorZoneOpacity: 0.08,
    gridBg: '#f5f7fa',
    gridMinor: 'rgba(70, 90, 120, 0.18)',
    gridMajor: 'rgba(50, 70, 110, 0.32)',
    signage: {
      panel: 'rgba(250,252,255,0.92)',
      border: 'rgba(43,106,246,0.4)',
      text: 'rgba(26,36,48,0.88)',
      glow: 'rgba(43,106,246,0.18)',
    },
    minimap: {
      background: 'rgba(245,247,250,0.92)',
      border: '#d7dee9',
      text: '#1f2937',
      accent: 'rgba(43,106,246,0.88)',
      roomFill: 'rgba(43,106,246,0.16)',
      roomStroke: 'rgba(43,106,246,0.5)',
      door: 'rgba(14,116,144,0.9)',
      landmark: 'rgba(55,65,81,0.85)',
      activeBg: 'rgba(43,106,246,0.16)',
      suggestedBg: 'rgba(43,106,246,0.08)',
      stageFill: 'rgba(226,232,240,0.94)',
      stageFillStrong: 'rgba(237,242,250,0.96)',
      stageStroke: 'rgba(43,106,246,0.35)',
      remote: '#94a3b8',
      remoteGlow: 'rgba(148,163,184,0.26)',
      remoteLabel: 'rgba(31,41,55,0.9)',
      you: '#f59f0b',
      youGlow: 'rgba(245,159,11,0.32)',
    },
    lighting: {
      hemiSky: 0xffffff,
      hemiGround: 0x9aa0ac,
      hemiIntensity: 0.75,
      dirColor: 0xfff0d4,
      dirIntensity: 0.95,
      dirPosition: { x: 12, y: 18, z: 8 },
      ambientColor: 0xf3f4f8,
      ambientIntensity: 0.36,
      fillColor: 0xbfd6ff,
      fillIntensity: 0.42,
      fillSize: { width: 14, height: 7 },
    },
    furniture: {
      sofaFabric: 0xc5ccd8,
      sofaLegs: 0xb6b9bf,
      chairSeat: 0xf5f6f8,
      chairFrame: 0x8b9bb5,
      chairPlastic: 0xffffff,
      conferenceTableTop: 0xe4d2b5,
      conferenceTableLegs: 0xb1b7c3,
      gameTableTop: 0xc8b8a6,
      gameTableLeg: 0x8e8f93,
      coffeeCounter: 0xd9c6b4,
      coffeeMachineBody: 0x4b5563,
      coffeeMachineAccent: 0x2563eb,
      plantPot: 0xb68b6f,
      plantLeaf: 0x3b9c68,
    },
    rooms: {
      lobby: { base: 0xe2ecfb, accent: 0x2b6af6 },
      open: { base: 0xffead5, accent: 0xfb923c },
      conference: { base: 0xe7ecf4, accent: 0x94a3b8 },
      focus: { base: 0xd7e3ff, accent: 0x4f7bf5 },
      lounge: { base: 0xfff0da, accent: 0xf59f0b },
      game: { base: 0xf1e5ff, accent: 0x8b5cf6 },
      kitchen: { base: 0xe0f8ea, accent: 0x22c55e },
    },
  },
  dark: {
    accent: 0x7aa2ff,
    surroundWalls: 0x1d232f,
    wallTrim: 0x151b23,
    ceiling: 0x252c3a,
    ceilingGrid: 'rgba(188,198,214,0.08)',
    rugLight: 0x2a3240,
    rugDark: 0x161c27,
    sky: 0x05070d,
    fogColor: 0x0b0f16,
    fogDensity: 0.015,
    floorBase: 0x131922,
    floorTiles: [0x1c2331, 0x1a202c, 0x202838],
    floorGrout: 0x0b1018,
    floorZoneTint: 0x4b5563,
    floorZoneOpacity: 0.14,
    gridBg: '#121622',
    gridMinor: 'rgba(142,153,183,0.22)',
    gridMajor: 'rgba(177,188,220,0.48)',
    signage: {
      panel: 'rgba(13,17,26,0.88)',
      border: 'rgba(122,162,255,0.6)',
      text: 'rgba(233,243,255,0.95)',
      glow: 'rgba(122,162,255,0.24)',
    },
    minimap: {
      background: 'rgba(18,22,34,0.94)',
      border: '#2e3342',
      text: 'rgba(224,231,255,0.9)',
      accent: 'rgba(122,162,255,0.9)',
      roomFill: 'rgba(122,162,255,0.18)',
      roomStroke: 'rgba(122,162,255,0.54)',
      door: 'rgba(122,162,255,0.9)',
      landmark: 'rgba(203,213,225,0.88)',
      activeBg: 'rgba(122,162,255,0.22)',
      suggestedBg: 'rgba(122,162,255,0.12)',
      stageFill: 'rgba(26,29,36,0.92)',
      stageFillStrong: 'rgba(42,47,57,0.96)',
      stageStroke: 'rgba(122,162,255,0.55)',
      remote: '#8ea0c8',
      remoteGlow: 'rgba(142,160,200,0.35)',
      remoteLabel: 'rgba(224,231,255,0.9)',
      you: '#f6a968',
      youGlow: 'rgba(246,169,104,0.42)',
    },
    lighting: {
      hemiSky: 0x7381a3,
      hemiGround: 0x10131a,
      hemiIntensity: 0.55,
      dirColor: 0xffcba8,
      dirIntensity: 1.05,
      dirPosition: { x: 9, y: 14, z: 6 },
      ambientColor: 0x101420,
      ambientIntensity: 0.18,
      fillColor: 0x223044,
      fillIntensity: 0.36,
      fillSize: { width: 12, height: 6 },
    },
    furniture: {
      sofaFabric: 0x3e4a5c,
      sofaLegs: 0x7c8797,
      chairSeat: 0x111926,
      chairFrame: 0x9ea9bc,
      chairPlastic: 0x0b111a,
      conferenceTableTop: 0x5c4430,
      conferenceTableLegs: 0x848d9a,
      gameTableTop: 0x36241a,
      gameTableLeg: 0x253041,
      coffeeCounter: 0x3f2e23,
      coffeeMachineBody: 0x1a2330,
      coffeeMachineAccent: 0x7aa2ff,
      plantPot: 0x2f2118,
      plantLeaf: 0x3fc07a,
    },
    rooms: {
      lobby: { base: 0x202b3b, accent: 0x7aa2ff },
      open: { base: 0x2c2218, accent: 0xf6ad55 },
      conference: { base: 0x27313f, accent: 0x8ea0c8 },
      focus: { base: 0x1f2d3c, accent: 0x6ea8ff },
      lounge: { base: 0x2e2119, accent: 0xf6a968 },
      game: { base: 0x261d32, accent: 0xb794ff },
      kitchen: { base: 0x233024, accent: 0x9ddc9c },
    },
  },
};
