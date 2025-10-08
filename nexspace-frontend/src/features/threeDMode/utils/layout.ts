import type { RoomDefinition } from '../config/rooms';
import type { AvatarRuntimeState, Vector2 } from '../store/threeDStore';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const layoutRectangularRoom = (
  room: RoomDefinition,
  occupants: AvatarRuntimeState[],
): Record<string, Vector2> => {
  if (occupants.length === 0 || room.boundary.type !== 'rect') {
    return {};
  }

  const { center, size } = room.boundary;
  const [width, depth] = size;
  const [centerX, centerY] = center;

  const columns = clamp(Math.ceil(Math.sqrt(occupants.length)), 1, Math.max(1, occupants.length));
  const rows = Math.ceil(occupants.length / columns);

  const spacingX = width / (columns + 1);
  const spacingY = depth / (rows + 1);

  return occupants.reduce<Record<string, Vector2>>((acc, avatar, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;

    const x = centerX - width / 2 + spacingX * (column + 1);
    const y = centerY - depth / 2 + spacingY * (row + 1);

    acc[avatar.id] = { x, y };
    return acc;
  }, {});
};

const layoutCircularRoom = (
  room: RoomDefinition,
  occupants: AvatarRuntimeState[],
): Record<string, Vector2> => {
  if (occupants.length === 0 || room.boundary.type !== 'circle') {
    return {};
  }

  const { center, radius } = room.boundary;
  const [centerX, centerY] = center;

  if (occupants.length === 1) {
    return { [occupants[0].id]: { x: centerX, y: centerY } };
  }

  const interiorRadius = Math.max(1.5, radius * 0.65);

  return occupants.reduce<Record<string, Vector2>>((acc, avatar, index) => {
    const angle = (index / occupants.length) * Math.PI * 2;
    const x = centerX + interiorRadius * Math.cos(angle);
    const y = centerY + interiorRadius * Math.sin(angle);

    acc[avatar.id] = { x, y };
    return acc;
  }, {});
};

const layoutForRoom = (
  room: RoomDefinition,
  occupants: AvatarRuntimeState[],
): Record<string, Vector2> => {
  if (room.boundary.type === 'rect') {
    return layoutRectangularRoom(room, occupants);
  }
  return layoutCircularRoom(room, occupants);
};

export const computeRoomLayout = (
  rooms: RoomDefinition[],
  avatars: Record<string, AvatarRuntimeState>,
): Record<string, Vector2> => {
  if (!rooms.length) return {};

  const layout: Record<string, Vector2> = {};
  const roomById = new Map(rooms.map((room) => [room.id, room] as const));

  const occupantsByRoom = new Map<string, AvatarRuntimeState[]>();

  Object.values(avatars)
    .sort((a, b) => {
      if (a.roomId !== b.roomId) return a.roomId.localeCompare(b.roomId);
      if (a.isLocal === b.isLocal) return a.displayName.localeCompare(b.displayName);
      return a.isLocal ? -1 : 1;
    })
    .forEach((avatar) => {
      const list = occupantsByRoom.get(avatar.roomId) ?? [];
      list.push(avatar);
      occupantsByRoom.set(avatar.roomId, list);
    });

  occupantsByRoom.forEach((occupants, roomId) => {
    const room = roomById.get(roomId);
    if (!room) return;
    const roomLayout = layoutForRoom(room, occupants);
    Object.assign(layout, roomLayout);
  });

  return layout;
};
