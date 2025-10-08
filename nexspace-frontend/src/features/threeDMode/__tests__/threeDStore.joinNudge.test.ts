import { describe, expect, beforeEach, it } from 'vitest';
import { useThreeDStore } from '../store/threeDStore';
import { defaultRooms } from '../config/rooms';

const fallbackRoom = defaultRooms[0]?.id ?? 'open-work-area';

describe('threeDStore join nudge logic', () => {
  beforeEach(() => {
    useThreeDStore.setState({
      rooms: defaultRooms,
      localAvatarId: 'local-1',
      avatars: {},
      joinNudges: [],
      lastNudgeByAvatar: {},
      minimapWaypoints: {},
      joinNudgeCooldownMs: 3_000,
    });

    useThreeDStore.getState().upsertAvatar({
      id: 'local-1',
      displayName: 'You',
      roomId: fallbackRoom,
      isLocal: true,
    });
  });

  it('queues a join nudge when a remote avatar enters the local room', () => {
    useThreeDStore.getState().upsertAvatar({
      id: 'remote-1',
      displayName: 'Alex',
      roomId: fallbackRoom,
      isLocal: false,
    });

    const queue = useThreeDStore.getState().joinNudges;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ avatarId: 'remote-1', roomId: fallbackRoom });
  });

  it('enforces cooldown to avoid duplicate nudges', () => {
    const store = useThreeDStore.getState();
    store.upsertAvatar({ id: 'remote-2', displayName: 'Sam', roomId: fallbackRoom, isLocal: false });
    expect(useThreeDStore.getState().joinNudges).toHaveLength(1);

    store.upsertAvatar({ id: 'remote-2', displayName: 'Sam', roomId: fallbackRoom, isLocal: false });
    expect(useThreeDStore.getState().joinNudges).toHaveLength(1);

    useThreeDStore.setState((state) => ({
      lastNudgeByAvatar: { ...state.lastNudgeByAvatar, 'remote-2': Date.now() - 5_000 },
    }));
    store.upsertAvatar({ id: 'remote-2', displayName: 'Sam', roomId: fallbackRoom, isLocal: false });
    expect(useThreeDStore.getState().joinNudges).toHaveLength(2);
  });

  it('popJoinNudge dequeues items from the front of the queue', () => {
    const store = useThreeDStore.getState();
    store.upsertAvatar({ id: 'remote-3', displayName: 'Kai', roomId: fallbackRoom, isLocal: false });

    const popped = useThreeDStore.getState().popJoinNudge();
    expect(popped?.avatarId).toBe('remote-3');
    expect(useThreeDStore.getState().joinNudges).toHaveLength(0);
  });
});
