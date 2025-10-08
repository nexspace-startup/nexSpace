import React from 'react';
import { useThreeDStore, type QualityLevel } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';

const QUALITY_OPTIONS: Array<{ value: QualityLevel; label: string; hint: string }> = [
  { value: 'low', label: 'Low', hint: 'Best for battery & low-end GPUs' },
  { value: 'medium', label: 'Balanced', hint: 'Default visual fidelity' },
  { value: 'high', label: 'High', hint: 'Max shadows & post effects' },
];

const QualitySelector: React.FC = () => {
  const quality = useThreeDStore((s) => s.quality);
  const setQuality = useThreeDStore((s) => s.setQuality);
  const theme = useUIStore((s) => s.theme);
  const tokens = getThemeTokens(theme);

  return (
    <div
      className="w-[min(360px,80vw)] rounded-3xl border px-4 py-3 shadow-lg backdrop-blur-xl"
      style={{ background: tokens.surface, borderColor: tokens.borderSoft }}
    >
      <p className="text-xs uppercase tracking-[0.28em]" style={{ color: tokens.textMuted }}>
        Quality & Performance
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {QUALITY_OPTIONS.map((option) => {
          const isActive = quality === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setQuality(option.value)}
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

export default QualitySelector;
