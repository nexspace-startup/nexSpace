export type Mode = 'dark' | 'light';

export type RoomColor = { base: number; accent: number };

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
  furniture: FurniturePalette;
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
    furniture: {
      sofaFabric: 0x7f7f83,
      sofaLegs: 0xb8bcc2,
      chairSeat: 0x3d3f45,
      chairFrame: 0xd7cdb8,
      chairPlastic: 0x1b1e22,
      conferenceTableTop: 0xd0b089,
      conferenceTableLegs: 0x8a8e94,
      gameTableTop: 0x654321,
      gameTableLeg: 0x2f2f2f,
      coffeeCounter: 0x8b4513,
      coffeeMachineBody: 0x2c2c2c,
      coffeeMachineAccent: 0xd1d5db,
      plantPot: 0x8b4513,
      plantLeaf: 0x228b22,
    },
    rooms: {
      focus: { base: 0xBBDEFB, accent: 0x64B5F6 }, // deeper powder blue for better contrast
      lounge: { base: 0xFFCC80, accent: 0xFF9800 }, // richer peach/orange for visibility
      game: { base: 0xD1C4E9, accent: 0x9575CD }, // deeper lavender for light backgrounds
      kitchen: { base: 0xC8E6C9, accent: 0x66BB6A }, // stronger mint green
      conference: { base: 0xF5F5F5, accent: 0xBDBDBD }, // light gray instead of pure white
    }
  },
  dark: {
    accent: 0x8ab4ff,
    surroundWalls: 0x1f2633,
    rugLight: 0xF4F5F7,
    rugDark: 0x1b2230,
    sky: 0x06080d,              // deeper midnight blue tone
    floorBase: 0x121821,
    floorTiles: [0x1c2330, 0x202838, 0x17202a],
    floorGrout: 0x0c1118,
    gridBg: '#121622',
    gridMinor: 'rgba(142,153,183,0.22)',
    gridMajor: 'rgba(177,188,220,0.48)',
    furniture: {
      sofaFabric: 0x475569,
      sofaLegs: 0x94a3b8,
      chairSeat: 0x1f2937,
      chairFrame: 0xcbd5f5,
      chairPlastic: 0x111827,
      conferenceTableTop: 0x6b4f2c,
      conferenceTableLegs: 0x9aa5b5,
      gameTableTop: 0x3f2a1a,
      gameTableLeg: 0x2b3645,
      coffeeCounter: 0x4a3422,
      coffeeMachineBody: 0x1f2937,
      coffeeMachineAccent: 0x8ab4ff,
      plantPot: 0x3f2a1f,
      plantLeaf: 0x4ade80,
    },
    rooms: {
      focus: { base: 0x2c394a, accent: 0x6ba7ff },
      lounge: { base: 0x3b2d24, accent: 0xffb86b },
      game: { base: 0x312542, accent: 0xbc93ff },
      kitchen: { base: 0x2e3524, accent: 0xb7f5a1 },
      conference: { base: 0x28303d, accent: 0x93a4c6 },
    },
  },
};
