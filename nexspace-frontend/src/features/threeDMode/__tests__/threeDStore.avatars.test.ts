import { beforeEach, describe, expect, it } from 'vitest';
import { useThreeDStore } from '../store/threeDStore';
import { defaultRooms } from '../config/rooms';

const openWork = defaultRooms[0];

describe('threeDStore avatar updates', () => {
  beforeEach(() => {
    useThreeDStore.setState({
      rooms: defaultRooms,
      avatars: {},
      localAvatarId: null,
      joinNudges: [],
      lastNudgeByAvatar: {},
      minimapWaypoints: {},
      cameraMode: 'third-person',
    });
  });

  it('avoids unnecessary avatar mutations when data is unchanged', () => {
    if (!openWork) throw new Error('expected open work area');
    const store = useThreeDStore.getState();
    store.upsertAvatar({
      id: 'local',
      displayName: 'Alex',
      roomId: openWork.id,
      isLocal: true,
    });

    const first = useThreeDStore.getState().avatars;
    store.upsertAvatar({
      id: 'local',
      displayName: 'Alex',
      roomId: openWork.id,
      isLocal: true,
    });
    const second = useThreeDStore.getState().avatars;

    expect(second).toBe(first);
  });

  it('keeps the local avatar id stable across duplicate updates', () => {
    if (!openWork) throw new Error('expected open work area');
    const store = useThreeDStore.getState();
    store.upsertAvatar({
      id: 'local',
      displayName: 'Alex',
      roomId: openWork.id,
      isLocal: true,
    });
    expect(useThreeDStore.getState().localAvatarId).toBe('local');

    store.upsertAvatar({
      id: 'local',
      displayName: 'Alex',
      roomId: openWork.id,
      isLocal: true,
    });
    expect(useThreeDStore.getState().localAvatarId).toBe('local');
  });

  it('does not churn state when syncing an unchanged roster snapshot', () => {
    if (!openWork) throw new Error('expected open work area');
    const store = useThreeDStore.getState();
    store.syncRoster({
      participants: [
        {
          id: 'local',
          displayName: 'Alex',
          isLocal: true,
        },
      ],
      fallbackRoomId: openWork.id,
      explicitLocalId: 'local',
    });

    const firstAvatars = useThreeDStore.getState().avatars;
    const firstLocalId = useThreeDStore.getState().localAvatarId;

    store.syncRoster({
      participants: [
        {
          id: 'local',
          displayName: 'Alex',
          isLocal: true,
        },
      ],
      fallbackRoomId: openWork.id,
      explicitLocalId: 'local',
    });

    const secondAvatars = useThreeDStore.getState().avatars;
    const secondLocalId = useThreeDStore.getState().localAvatarId;

    expect(secondAvatars).toBe(firstAvatars);
    expect(secondLocalId).toBe(firstLocalId);
  });

  it('updates heading when the local avatar moves', () => {
    if (!openWork) throw new Error('expected open work area');
    const store = useThreeDStore.getState();
    store.upsertAvatar({
      id: 'local',
      displayName: 'Alex',
      roomId: openWork.id,
      isLocal: true,
      position: { x: 0, y: 0 },
    });

    useThreeDStore.getState().setAvatarPosition('local', { x: 1, y: 0 });
    const updated = useThreeDStore.getState().avatars['local'];
    expect(updated.heading).toBeCloseTo(Math.atan2(1, 0));
  });
});
