export type ThemeMode = 'dark' | 'light';

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceAlpha: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  borderSoft: string;
  borderStrong: string;
  gridLine: string;
  success: string;
  warning: string;
};

export const themeTokens: Record<ThemeMode, ThemeTokens> = {
  dark: {
    background: '#0B0C10',
    surface: 'rgba(23, 25, 35, 0.88)',
    surfaceAlt: '#141622',
    surfaceAlpha: 'rgba(18, 20, 29, 0.72)',
    textPrimary: '#EEF1F9',
    textSecondary: 'rgba(211, 218, 239, 0.72)',
    textMuted: 'rgba(211, 218, 239, 0.38)',
    accent: '#68D8C2',
    accentSoft: 'rgba(104, 216, 194, 0.4)',
    borderSoft: 'rgba(122, 130, 160, 0.24)',
    borderStrong: 'rgba(122, 130, 160, 0.45)',
    gridLine: 'rgba(255, 255, 255, 0.06)',
    success: '#5BE49B',
    warning: '#FFB84D',
  },
  light: {
    background: '#F4F6FB',
    surface: 'rgba(255, 255, 255, 0.92)',
    surfaceAlt: '#FFFFFF',
    surfaceAlpha: 'rgba(255, 255, 255, 0.78)',
    textPrimary: '#1F2433',
    textSecondary: 'rgba(31, 36, 51, 0.72)',
    textMuted: 'rgba(31, 36, 51, 0.42)',
    accent: '#2B70FF',
    accentSoft: 'rgba(43, 112, 255, 0.18)',
    borderSoft: 'rgba(36, 53, 102, 0.16)',
    borderStrong: 'rgba(36, 53, 102, 0.32)',
    gridLine: 'rgba(11, 12, 16, 0.05)',
    success: '#2EAD68',
    warning: '#F28C28',
  },
};

export const getThemeTokens = (mode: ThemeMode): ThemeTokens => themeTokens[mode];
