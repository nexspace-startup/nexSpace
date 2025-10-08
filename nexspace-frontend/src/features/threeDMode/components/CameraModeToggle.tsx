import React from 'react';
import { useThreeDStore, type CameraMode } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';

const CAMERA_OPTIONS: Array<{ value: CameraMode; label: string; hint: string }> = [
  { value: 'third-person', label: 'Third-person', hint: 'Wide, over-the-shoulder campus view' },
  { value: 'first-person', label: 'First-person', hint: 'Immersive, eye-level walk mode' },
];

const CameraModeToggle: React.FC = () => {
  const mode = useThreeDStore((s) => s.cameraMode);
  const setMode = useThreeDStore((s) => s.setCameraMode);
  const theme = useUIStore((s) => s.theme);
  const tokens = getThemeTokens(theme);

  return (
    <div
      className="w-full rounded-3xl border px-4 py-3 shadow-lg backdrop-blur-xl"
      style={{ background: tokens.surface, borderColor: tokens.borderSoft }}
    >
      <p className="text-xs uppercase tracking-[0.28em]" style={{ color: tokens.textMuted }}>
        View Mode
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {CAMERA_OPTIONS.map((option) => {
          const isActive = option.value === mode;
          return (
            <button
              key={option.value}
              onClick={() => setMode(option.value)}
              className="flex items-start gap-3 rounded-2xl px-3 py-2 text-left transition"
              style={{
                background: isActive ? tokens.accentSoft : tokens.surfaceAlt,
                border: `1px solid ${isActive ? tokens.accent : tokens.borderSoft}`,
                color: tokens.textPrimary,
              }}
            >
              <span className="mt-0.5 text-base" aria-hidden>
                {isActive ? '●' : '○'}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs" style={{ color: tokens.textSecondary }}>
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CameraModeToggle;
