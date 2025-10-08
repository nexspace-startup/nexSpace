import type { RoomDefinition } from '../config/rooms';
import type { Vector2 } from '../store/threeDStore';

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const pointInRect = (point: Vector2, center: [number, number], size: [number, number], rotation = 0): boolean => {
  const [cx, cy] = center;
  const [width, height] = size;
  const translatedX = point.x - cx;
  const translatedY = point.y - cy;

  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const rotatedX = translatedX * cos - translatedY * sin;
  const rotatedY = translatedX * sin + translatedY * cos;

  return Math.abs(rotatedX) <= width / 2 && Math.abs(rotatedY) <= height / 2;
};

export const pointInCircle = (point: Vector2, center: [number, number], radius: number): boolean => {
  const dx = point.x - center[0];
  const dy = point.y - center[1];
  return dx * dx + dy * dy <= radius * radius;
};

export const resolveRoomForPosition = (
  position: Vector2,
  rooms: RoomDefinition[],
  fallbackRoomId: string,
): string => {
  for (const room of rooms) {
    const boundary = room.boundary;
    if (boundary.type === 'rect' && pointInRect(position, boundary.center, boundary.size, boundary.rotation ?? 0)) {
      return room.id;
    }
    if (boundary.type === 'circle' && pointInCircle(position, boundary.center, boundary.radius)) {
      return room.id;
    }
  }

  return fallbackRoomId;
};

export const clampToCampusBounds = (position: Vector2, rooms: RoomDefinition[]): Vector2 => {
  if (!rooms.length) return position;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  rooms.forEach((room) => {
    const boundary = room.boundary;
    if (boundary.type === 'rect') {
      const halfW = boundary.size[0] / 2;
      const halfH = boundary.size[1] / 2;
      minX = Math.min(minX, boundary.center[0] - halfW);
      maxX = Math.max(maxX, boundary.center[0] + halfW);
      minY = Math.min(minY, boundary.center[1] - halfH);
      maxY = Math.max(maxY, boundary.center[1] + halfH);
    } else {
      minX = Math.min(minX, boundary.center[0] - boundary.radius);
      maxX = Math.max(maxX, boundary.center[0] + boundary.radius);
      minY = Math.min(minY, boundary.center[1] - boundary.radius);
      maxY = Math.max(maxY, boundary.center[1] + boundary.radius);
    }
  });

  const padding = 4;
  return {
    x: clamp(position.x, minX - padding, maxX + padding),
    y: clamp(position.y, minY - padding, maxY + padding),
  };
};
