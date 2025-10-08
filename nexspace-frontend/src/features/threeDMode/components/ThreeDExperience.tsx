import React, { useMemo } from 'react';
import { useThreeDStore } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';
import ThreeDMinimap from './ThreeDMinimap';
import JoinNudgePanel from './JoinNudgePanel';
import QualitySelector from './QualitySelector';
import { useThreeDAvatarSync } from '../hooks/useThreeDAvatarSync';
import ThreeDScene from './ThreeDScene';

const ThreeDExperience: React.FC = () => {
  useThreeDAvatarSync();
  const theme = useUIStore((s) => s.theme);
  const tokens = getThemeTokens(theme);
  const quality = useThreeDStore((s) => s.quality);
  const rooms = useThreeDStore((s) => s.rooms);
  const avatars = useThreeDStore((s) => s.avatars);
  const localAvatarId = useThreeDStore((s) => s.localAvatarId);

  const gradientStyle = useMemo(
    () => ({
      background: `radial-gradient(circle at 18% 12%, ${tokens.surfaceAlt} 0%, transparent 45%), radial-gradient(circle at 82% 16%, ${tokens.surfaceAlpha} 0%, transparent 52%)`,
    }),
    [tokens],
  );

  const roomSummaries = useMemo(
    () =>
      rooms.map((room) => {
        const occupants = Object.values(avatars).filter((avatar) => avatar.roomId === room.id);
        const localInside = occupants.some((avatar) => avatar.id === localAvatarId);
        return { room, occupants, localInside };
      }),
    [rooms, avatars, localAvatarId],
  );

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: tokens.background }}>
      <ThreeDScene />

      <div className="pointer-events-none absolute inset-0" style={gradientStyle} />

      <div className="pointer-events-none absolute left-6 top-6 w-[320px] max-w-[85vw]">
        <div
          className="rounded-3xl border px-5 py-4 shadow-2xl backdrop-blur-xl"
          style={{
            background: tokens.surface,
            borderColor: tokens.borderSoft,
          }}
        >
          <p className="text-xs uppercase tracking-[0.32em]" style={{ color: tokens.textMuted }}>
            Spatial status
          </p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: tokens.textPrimary }}>
            Campus overview
          </h2>
          <p className="mt-2 text-xs" style={{ color: tokens.textSecondary }}>
            Quality {quality.toUpperCase()} • {rooms.length} zones active • {Object.keys(avatars).length} teammates synced
          </p>
          <div className="mt-4 space-y-2">
            {roomSummaries.map(({ room, occupants, localInside }) => (
                <div
                  key={room.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border px-3 py-2"
                  style={{
                    borderColor: localInside ? tokens.accent : tokens.borderSoft,
                    background: localInside ? tokens.accentSoft : tokens.surfaceAlt,
                    color: tokens.textPrimary,
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
                      {room.name}
                    </p>
                    {room.signage && (
                      <p className="text-[11px] leading-relaxed" style={{ color: tokens.textSecondary }}>
                        {room.signage}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium" style={{ color: tokens.textSecondary }}>
                    {occupants.length} in room
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="absolute left-6 bottom-6 w-72 max-w-[85vw]">
        <ThreeDMinimap />
      </div>

      <div className="absolute right-6 top-6">
        <QualitySelector />
      </div>

      <JoinNudgePanel />

      <div className="pointer-events-none absolute bottom-4 right-6 text-[11px] uppercase tracking-[0.32em]" style={{ color: tokens.textMuted }}>
        Theme: {theme.toUpperCase()}
      </div>
    </div>
  );
};

export default ThreeDExperience;
