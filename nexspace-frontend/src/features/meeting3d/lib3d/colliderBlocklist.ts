// Dev blocklist for persistent collider removals.
// Paste entries that the dev tool logs on Alt+Click deletion.

export type BlockedCollider = {
  center: [number, number, number];
  size: [number, number, number];
};

// Keep this list small; entries are matched with a small tolerance.
export const COLLIDER_BLOCKLIST: BlockedCollider[] = [
  // Example:
  // { center: [1.23, 1.2, -4.56], size: [2.4, 1.2, 1.0] },
  { center: [0, 0.82, 0], size: [8, 0.08, 3.2] },
];
