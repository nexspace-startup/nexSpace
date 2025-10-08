import React, { useMemo, useState, useCallback } from 'react';
import { useThreeDStore } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';
import ThreeDMinimap from './ThreeDMinimap';
import JoinNudgePanel from './JoinNudgePanel';
import QualitySelector from './QualitySelector';
import CameraModeToggle from './CameraModeToggle';
import { useThreeDAvatarSync } from '../hooks/useThreeDAvatarSync';
import ThreeDScene from './ThreeDScene';
import { useSpatialAudioRouting } from '../hooks/useSpatialAudioRouting';

type PanelKey = 'status' | 'map' | 'settings';

const ThreeDExperience: React.FC = () => {
  useThreeDAvatarSync();
  useSpatialAudioRouting();
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

  const totalAvatars = useMemo(() => Object.keys(avatars).length, [avatars]);

  const [openPanel, setOpenPanel] = useState<PanelKey>('status');

  const renderStatusPanel = useCallback(
    () => (
      <div className="space-y-2">
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
            <div className="text-right">
              <span className="block text-xs font-medium" style={{ color: tokens.textSecondary }}>
                {occupants.length} {occupants.length === 1 ? 'person' : 'people'}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase"
                style={{
                  background: tokens.surface,
                  color: tokens.textMuted,
                  border: `1px solid ${tokens.borderSoft}`,
                }}
              >
                {room.audio.roomIsolation >= 0.8 ? 'Private' : room.audio.roomIsolation >= 0.5 ? 'Semi-open' : 'Open'}
              </span>
            </div>
          </div>
        ))}
      </div>
    ),
    [roomSummaries, tokens],
  );

  const panels = useMemo(
    () =>
      [
        {
          key: 'status' as PanelKey,
          title: 'Rooms & Presence',
          subtitle: `${rooms.length} zones • ${totalAvatars} teammates`,
          render: renderStatusPanel,
        },
        {
          key: 'map' as PanelKey,
          title: 'Minimap',
          subtitle: 'Set a waypoint or scout ahead',
          render: () => <ThreeDMinimap showHeader={false} />,
        },
        {
          key: 'settings' as PanelKey,
          title: 'Immersive Controls',
          subtitle: `Quality ${quality.toUpperCase()} • ${theme === 'dark' ? 'Dark' : 'Light'} theme`,
          render: () => (
            <div className="space-y-3">
              <QualitySelector showHeading={false} />
              <CameraModeToggle />
            </div>
          ),
        },
      ],
    [quality, renderStatusPanel, rooms.length, theme, totalAvatars],
  );

  const handlePanelToggle = (key: PanelKey) => {
    if (openPanel !== key) {
      setOpenPanel(key);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: tokens.background }}>
      <ThreeDScene />

      <div className="pointer-events-none absolute inset-0" style={gradientStyle} />

      <div className="pointer-events-none absolute right-6 top-6 flex w-[min(360px,90vw)] flex-col gap-4">
        {panels.map((panel) => {
          const isOpen = openPanel === panel.key;
          return (
            <div
              key={panel.key}
              className="pointer-events-auto overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl transition"
              style={{
                background: tokens.surface,
                borderColor: tokens.borderSoft,
                maxHeight: isOpen ? '640px' : '68px',
              }}
            >
              <button
                type="button"
                onClick={() => handlePanelToggle(panel.key)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                style={{ color: tokens.textPrimary }}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.28em]" style={{ color: tokens.textMuted }}>
                    {panel.title}
                  </p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: tokens.textPrimary }}>
                    {panel.subtitle}
                  </p>
                </div>
                <span
                  aria-hidden
                  className={`text-lg transition-transform ${isOpen ? 'rotate-90' : 'rotate-0'}`}
                  style={{ color: tokens.textSecondary }}
                >
                  ➤
                </span>
              </button>
              {isOpen && <div className="px-5 pb-5">{panel.render()}</div>}
            </div>
          );
        })}
      </div>

      <JoinNudgePanel />

      <div
        className="pointer-events-none absolute bottom-4 right-6 text-[11px] uppercase tracking-[0.32em]"
        style={{ color: tokens.textMuted }}
      >
        Theme: {theme.toUpperCase()}
      </div>
    </div>
  );
};

export default ThreeDExperience;
