export type Mode = 'dark' | 'light';

export type RoomColor = { base: number; accent: number };

export type ModePalette = {
  accent: number;
  surroundWalls: number; // perimeter wall color
  rugLight: number;      // rug under sofa (light mode target)
  rugDark: number;       // rug under sofa (dark mode target)
  sky: number;           // scene background/sky color
  floorBase: number;     // base underlay color for floor
  floorTiles: number[];  // tile colors for subtle variation
  floorGrout: number;    // grout line color
  gridBg: string;        // CSS color for grid background
  gridMinor: string;     // CSS color for minor grid lines
  gridMajor: string;     // CSS color for major grid lines
  rooms: {
    focus: RoomColor;     // Focus Pod A
    lounge: RoomColor;    // Lounge
    game: RoomColor;      // Game Room
    kitchen: RoomColor;   // Kitchen
    conference?: RoomColor; // optional conference accents
  };
};

export const MODE_PALETTE: Record<Mode, ModePalette> = {
  light: {
    accent: 0x2563eb,           // blue-600 style accent
    surroundWalls: 0xF0F3F7,    // soft cool gray walls
    rugLight: 0xF4F5F7,         // light neutral rug
    rugDark: 0x343845,
    sky: 0xF5F7FA,              // pale sky-gray for light mode
    floorBase: 0xF8F6F0, // warm off-white base
    floorTiles: [0xE0DAD2, 0xC8C0B8, 0xB0A89E], // beige / stone tones
    floorGrout: 0xDAD2C6, // slightly darker warm grout
    gridBg: '#f5f7fa',
    gridMinor: 'rgba(70, 90, 120, 0.18)',
    gridMajor: 'rgba(50, 70, 110, 0.34)',
    rooms: {
      focus: { base: 0xBBDEFB, accent: 0x64B5F6 }, // deeper powder blue for better contrast
      lounge: { base: 0xFFCC80, accent: 0xFF9800 }, // richer peach/orange for visibility  
      game: { base: 0xD1C4E9, accent: 0x9575CD }, // deeper lavender for light backgrounds
      kitchen: { base: 0xC8E6C9, accent: 0x66BB6A }, // stronger mint green
      conference: { base: 0xF5F5F5, accent: 0xBDBDBD }, // light gray instead of pure white
    }
  },
  dark: {
    accent: 0x3D93F8,
    surroundWalls: 0x3a3f4a,
    rugLight: 0xF4F5F7,
    rugDark: 0x343845,
    sky: 0x111419,              // deep charcoal for dark mode
    floorBase: 0x1A1A1A,
    floorTiles: [0x7C828A, 0xA7ADB6, 0xB5BAC2],
    floorGrout: 0x151518,
    gridBg: '#202024',
    gridMinor: 'rgba(190,200,215,0.25)',
    gridMajor: 'rgba(230,240,255,0.55)',
    rooms: {
      focus: { base: 0x3d4a5c, accent: 0x5a7a95 },
      lounge: { base: 0x5c4033, accent: 0x8b6914 },
      game: { base: 0x4a3f5c, accent: 0x7b68ee },
      kitchen: { base: 0x5c5233, accent: 0xdaa520 },
      conference: { base: 0xffffff, accent: 0x666666 },
    },
  },
};
