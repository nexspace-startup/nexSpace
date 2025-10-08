import React, { useMemo } from 'react';
import { useThreeDStore } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';
import { useMeetingStore } from '../../../stores/meetingStore';

const JoinNudgePanel: React.FC = () => {
  const joinNudge = useThreeDStore((s) => s.joinNudges[0] ?? null);
  const popJoinNudge = useThreeDStore((s) => s.popJoinNudge);
  const rooms = useThreeDStore((s) => s.rooms);
  const theme = useUIStore((s) => s.theme);
  const tokens = getThemeTokens(theme);

  const roomName = useMemo(() => {
    if (!joinNudge) return null;
    return rooms.find((room) => room.id === joinNudge.roomId)?.name ?? 'the room';
  }, [joinNudge, rooms]);

  if (!joinNudge) return null;

  const handleWave = () => {
    const meeting = useMeetingStore.getState();
    const message = `👋 says hi to ${joinNudge.displayName}${roomName ? ` in ${roomName}` : ''}!`;
    void meeting.sendMessage(message);
    popJoinNudge();
  };

  const handleInvite = () => {
    const meeting = useMeetingStore.getState();
    void meeting.startWhisper(joinNudge.avatarId);
    popJoinNudge();
  };

  const handleDM = () => {
    const meeting = useMeetingStore.getState();
    if (!meeting.chatOpen) {
      meeting.toggleChat();
    }
    meeting.setActiveDMPeer(joinNudge.avatarId);
    popJoinNudge();
  };

  const handleDismiss = () => {
    popJoinNudge();
  };

  return (
    <div className="absolute left-1/2 top-10 z-20 -translate-x-1/2">
      <div
        className="flex w-[min(420px,90vw)] flex-col gap-3 rounded-3xl border px-5 py-4 shadow-xl backdrop-blur-xl"
        style={{ background: tokens.surface, borderColor: tokens.borderStrong }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-2xl"
            style={{ background: tokens.accentSoft }}
          >
            <span aria-hidden className="text-lg" role="img">
              👋
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              {joinNudge.displayName} just entered {roomName}
            </p>
            <p className="text-xs" style={{ color: tokens.textSecondary }}>
              Give them a warm welcome or launch a quick huddle.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleWave}
            className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition"
            style={{
              background: tokens.surfaceAlt,
              color: tokens.textPrimary,
              border: `1px solid ${tokens.borderSoft}`,
            }}
          >
            <span aria-hidden>🖐️</span>
            Wave hello
          </button>
          <button
            onClick={handleInvite}
            className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition"
            style={{
              background: tokens.surfaceAlt,
              color: tokens.textPrimary,
              border: `1px solid ${tokens.borderSoft}`,
            }}
          >
            <span aria-hidden>🎯</span>
            Invite to huddle
          </button>
          <button
            onClick={handleDM}
            className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition"
            style={{
              background: tokens.surfaceAlt,
              color: tokens.textPrimary,
              border: `1px solid ${tokens.borderSoft}`,
            }}
          >
            <span aria-hidden>💬</span>
            Send DM
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="self-end text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: tokens.textMuted }}
        >
          dismiss
        </button>
      </div>
    </div>
  );
};

export default JoinNudgePanel;
