import React, { useMemo } from 'react';
import { useThreeDStore } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';

const MAX_NAME_TAGS = 4;

const ThreeDMinimap: React.FC = () => {
  const rooms = useThreeDStore((s) => s.rooms);
  const avatars = useThreeDStore((s) => s.avatars);
  const theme = useUIStore((s) => s.theme);
  const tokens = getThemeTokens(theme);

  const summary = useMemo(
    () =>
      rooms.map((room) => {
        const occupants = Object.values(avatars).filter((avatar) => avatar.roomId === room.id);
        const localInside = occupants.some((avatar) => avatar.isLocal);
        return {
          room,
          occupants,
          localInside,
        };
      }),
    [rooms, avatars]
  );

  const totalAvatars = useMemo(() => Object.keys(avatars).length, [avatars]);

  return (
    <div
      className="rounded-3xl border shadow-2xl backdrop-blur-xl"
      style={{
        borderColor: tokens.borderSoft,
        background: tokens.surface,
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em]" style={{ color: tokens.textMuted }}>
            Minimap
          </p>
          <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
            Live campus overview
          </p>
        </div>
        <span className="text-xs font-medium" style={{ color: tokens.textSecondary }}>
          {totalAvatars} online
        </span>
      </div>
      <ul className="mt-3 space-y-2 px-4 pb-4">
        {summary.map(({ room, occupants, localInside }) => {
          const highlightColor = localInside ? tokens.accent : room.themeColor;
          const occupantNames = occupants.slice(0, MAX_NAME_TAGS);
          const overflow = occupants.length - occupantNames.length;
          return (
            <li
              key={room.id}
              className="rounded-2xl border px-3 py-2 transition-colors"
              style={{
                borderColor: localInside ? tokens.accent : tokens.borderSoft,
                background: localInside ? tokens.accentSoft : tokens.surfaceAlt,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: highlightColor }}
                  />
                  <span className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
                    {room.name}
                  </span>
                </div>
                <span className="text-xs" style={{ color: tokens.textSecondary }}>
                  {occupants.length} inside
                </span>
              </div>
              {occupantNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  {occupantNames.map((avatar) => (
                    <span
                      key={avatar.id}
                      className="rounded-full px-2 py-0.5"
                      style={{
                        background: localInside ? tokens.surface : tokens.surfaceAlpha,
                        color: tokens.textSecondary,
                      }}
                    >
                      {avatar.displayName}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{ background: tokens.surfaceAlpha, color: tokens.textSecondary }}
                    >
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
              {room.signage && (
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: tokens.textMuted }}>
                  {room.signage}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ThreeDMinimap;
