import type { RoomDefinition, RoomBounds, RoomId } from './types';

export type ResolvedRoom = {
  id: RoomId;
  bounds: RoomBounds;
  center: { x: number; z: number };
  size: { width: number; depth: number };
};

export type ResolvedRoomLayout = Map<RoomId, ResolvedRoom>;

export type ResolveRoomLayoutOptions = {
  roomWidth: number;
  roomDepth: number;
  rooms: RoomDefinition[];
  hallwayMargin?: number;
  roomGap?: number;
};

type MutableRect = RoomBounds;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const cloneBounds = (bounds: RoomBounds): MutableRect => ({
  minX: bounds.minX,
  maxX: bounds.maxX,
  minZ: bounds.minZ,
  maxZ: bounds.maxZ,
});

const rectIntersects = (a: MutableRect, b: MutableRect) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

const expandRect = (rect: MutableRect, padding: number): MutableRect => ({
  minX: rect.minX - padding,
  maxX: rect.maxX + padding,
  minZ: rect.minZ - padding,
  maxZ: rect.maxZ + padding,
});

const shiftRect = (rect: MutableRect, dx: number, dz: number) => {
  rect.minX += dx;
  rect.maxX += dx;
  rect.minZ += dz;
  rect.maxZ += dz;
};

export const resolveRoomLayout = ({
  roomWidth,
  roomDepth,
  rooms,
  hallwayMargin = 1.6,
  roomGap = 1.2,
}: ResolveRoomLayoutOptions): ResolvedRoomLayout => {
  const resolved: ResolvedRoomLayout = new Map();
  const floor: RoomBounds = {
    minX: -roomWidth / 2 + hallwayMargin,
    maxX: roomWidth / 2 - hallwayMargin,
    minZ: -roomDepth / 2 + hallwayMargin,
    maxZ: roomDepth / 2 - hallwayMargin,
  };

  const ordered = rooms
    .slice()
    .sort((a, b) => {
      const areaA = (a.bounds.maxX - a.bounds.minX) * (a.bounds.maxZ - a.bounds.minZ);
      const areaB = (b.bounds.maxX - b.bounds.minX) * (b.bounds.maxZ - b.bounds.minZ);
      return areaB - areaA;
    });

  for (const room of ordered) {
    const original = cloneBounds(room.bounds);
    const width = original.maxX - original.minX;
    const depth = original.maxZ - original.minZ;
    const halfW = width / 2;
    const halfD = depth / 2;
    const desiredCenterX = (original.minX + original.maxX) / 2;
    const desiredCenterZ = (original.minZ + original.maxZ) / 2;

    const centerX = clamp(desiredCenterX, floor.minX + halfW, floor.maxX - halfW);
    const centerZ = clamp(desiredCenterZ, floor.minZ + halfD, floor.maxZ - halfD);

    const rect: MutableRect = {
      minX: centerX - halfW,
      maxX: centerX + halfW,
      minZ: centerZ - halfD,
      maxZ: centerZ + halfD,
    };

    let safety = 0;
    const maxIterations = 18;
    while (safety < maxIterations) {
      let adjusted = false;
      for (const other of resolved.values()) {
        const padded = expandRect(other.bounds, roomGap);
        if (!rectIntersects(rect, padded)) {
          continue;
        }
        const pushRight = padded.maxX - rect.minX;
        const pushLeft = rect.maxX - padded.minX;
        const pushForward = rect.maxZ - padded.minZ;
        const pushBack = padded.maxZ - rect.minZ;

        const candidates = [
          { axis: 'x', delta: pushRight, dir: 1 },
          { axis: 'x', delta: pushLeft, dir: -1 },
          { axis: 'z', delta: pushBack, dir: 1 },
          { axis: 'z', delta: pushForward, dir: -1 },
        ].filter((c) => c.delta > 0.0001);

        candidates.sort((a, b) => a.delta - b.delta);
        let moved = false;
        for (const cand of candidates) {
          if (cand.axis === 'x') {
            const dx = cand.dir * cand.delta;
            shiftRect(rect, dx, 0);
            rect.minX = clamp(rect.minX, floor.minX, floor.maxX - width);
            rect.maxX = rect.minX + width;
          } else {
            const dz = cand.dir * cand.delta;
            shiftRect(rect, 0, dz);
            rect.minZ = clamp(rect.minZ, floor.minZ, floor.maxZ - depth);
            rect.maxZ = rect.minZ + depth;
          }
          if (!rectIntersects(rect, padded)) {
            moved = true;
            adjusted = true;
            break;
          }
        }

        if (!moved) {
          // If we failed to move along either axis, bias towards the least crowded direction.
          const spaceLeft = rect.minX - floor.minX;
          const spaceRight = floor.maxX - rect.maxX;
          const spaceFront = rect.minZ - floor.minZ;
          const spaceBack = floor.maxZ - rect.maxZ;
          const prioritized = [
            { axis: 'x', dir: spaceLeft > spaceRight ? 1 : -1, roomSpace: Math.max(spaceLeft, spaceRight) },
            { axis: 'z', dir: spaceFront > spaceBack ? 1 : -1, roomSpace: Math.max(spaceFront, spaceBack) },
          ].sort((a, b) => b.roomSpace - a.roomSpace);
          for (const cand of prioritized) {
            if (cand.roomSpace <= 0.001) continue;
            if (cand.axis === 'x') {
              shiftRect(rect, cand.dir * Math.min(roomGap, cand.roomSpace), 0);
              rect.minX = clamp(rect.minX, floor.minX, floor.maxX - width);
              rect.maxX = rect.minX + width;
            } else {
              shiftRect(rect, 0, cand.dir * Math.min(roomGap, cand.roomSpace));
              rect.minZ = clamp(rect.minZ, floor.minZ, floor.maxZ - depth);
              rect.maxZ = rect.minZ + depth;
            }
            if (!rectIntersects(rect, padded)) {
              adjusted = true;
              moved = true;
              break;
            }
          }
          if (!moved) {
            break;
          }
        }
      }
      if (!adjusted) {
        break;
      }
      safety += 1;
    }

    rect.minX = clamp(rect.minX, floor.minX, floor.maxX - width);
    rect.maxX = rect.minX + width;
    rect.minZ = clamp(rect.minZ, floor.minZ, floor.maxZ - depth);
    rect.maxZ = rect.minZ + depth;

    resolved.set(room.id, {
      id: room.id,
      bounds: { ...rect },
      center: { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 },
      size: { width, depth },
    });
  }

  return resolved;
};
