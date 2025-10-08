import React, { useMemo } from 'react';
import { useThreeDStore } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';
import ThreeDMinimap from './ThreeDMinimap';
import JoinNudgePanel from './JoinNudgePanel';
import QualitySelector from './QualitySelector';
import { useThreeDAvatarSync } from '../hooks/useThreeDAvatarSync';

const ThreeDExperience: React.FC = () => {
  useThreeDAvatarSync();
  const theme = useUIStore((s) => s.theme);
  const tokens = getThemeTokens(theme);
  const quality = useThreeDStore((s) => s.quality);
  const rooms = useThreeDStore((s) => s.rooms);

  const gradientStyle = useMemo(
    () => ({
      background: `radial-gradient(circle at 22% 18%, ${tokens.surfaceAlt} 0%, ${tokens.background} 58%)`,
    }),
    [tokens]
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: tokens.background, color: tokens.textPrimary }}
    >
      <div className="absolute inset-0" style={gradientStyle}>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(135deg, ${tokens.gridLine} 1px, transparent 1px), linear-gradient(45deg, ${tokens.gridLine} 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            opacity: 0.25,
          }}
        />
        <div className="relative flex h-full w-full items-center justify-center">
          <div
            className="pointer-events-none max-w-lg rounded-3xl border px-6 py-6 text-center shadow-2xl backdrop-blur-xl"
            style={{
              background: tokens.surface,
              borderColor: tokens.borderStrong,
            }}
          >
            <h2 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>
              Immersive campus preview
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: tokens.textSecondary }}>
              The spatial workspace is syncing avatars, minimap presence, and welcome nudges while
              the realtime 3D stage is constructed. Visual fidelity adapts to your selected quality
              mode.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.32em]" style={{ color: tokens.textMuted }}>
              Quality: {quality.toUpperCase()}
            </p>
            <p className="mt-2 text-xs" style={{ color: tokens.textMuted }}>
              Rooms configured: {rooms.length}
            </p>
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
