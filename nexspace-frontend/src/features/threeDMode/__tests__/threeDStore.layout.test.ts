import { beforeEach, describe, expect, it } from 'vitest';
import { useThreeDStore } from '../store/threeDStore';
import { defaultRooms } from '../config/rooms';

const openWork = defaultRooms.find((room) => room.id === 'open-work-area');
const lounge = defaultRooms.find((room) => room.id === 'lounge-zone');

describe('threeDStore layout distribution', () => {
  beforeEach(() => {
    useThreeDStore.setState({
      rooms: defaultRooms,
      avatars: {},
      localAvatarId: null,
      joinNudges: [],
      lastNudgeByAvatar: {},
      minimapWaypoints: {},
    });
  });

  it('distributes avatars across rectangular rooms without overlap', () => {
    if (!openWork || openWork.boundary.type !== 'rect') {
      throw new Error('expected open work area room definition');
    }

    const store = useThreeDStore.getState();
    ['local', 'remote-a', 'remote-b', 'remote-c'].forEach((id, index) => {
      store.upsertAvatar({
        id,
        displayName: `Avatar ${id}`,
        roomId: openWork.id,
        isLocal: index === 0,
      });
    });

    const avatars = Object.values(useThreeDStore.getState().avatars).filter(
      (avatar) => avatar.roomId === openWork.id,
    );

    const keys = new Set(avatars.map((avatar) => `${avatar.position.x.toFixed(2)}:${avatar.position.y.toFixed(2)}`));
    expect(keys.size).toBe(avatars.length);

    avatars.forEach((avatar) => {
      expect(avatar.position.x).toBeGreaterThanOrEqual(openWork.boundary.center[0] - openWork.boundary.size[0] / 2);
      expect(avatar.position.x).toBeLessThanOrEqual(openWork.boundary.center[0] + openWork.boundary.size[0] / 2);
      expect(avatar.position.y).toBeGreaterThanOrEqual(openWork.boundary.center[1] - openWork.boundary.size[1] / 2);
      expect(avatar.position.y).toBeLessThanOrEqual(openWork.boundary.center[1] + openWork.boundary.size[1] / 2);
    });
  });

  it('arranges avatars around the lounge circle interior', () => {
    if (!lounge || lounge.boundary.type !== 'circle') {
      throw new Error('expected lounge zone room definition');
    }

    const store = useThreeDStore.getState();
    ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].forEach((id, index) => {
      store.upsertAvatar({
        id,
        displayName: `Guest ${index}`,
        roomId: lounge.id,
        isLocal: index === 0,
      });
    });

    const avatars = Object.values(useThreeDStore.getState().avatars).filter((avatar) => avatar.roomId === lounge.id);

    const radiusCheck = lounge.boundary.radius * 0.75;
    avatars.forEach((avatar) => {
      const dx = avatar.position.x - lounge.boundary.center[0];
      const dy = avatar.position.y - lounge.boundary.center[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeLessThanOrEqual(radiusCheck);
      expect(distance).toBeGreaterThan(0.5);
    });
  });
});
