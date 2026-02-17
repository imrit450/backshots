export interface EventTheme {
  id: string;
  name: string;
  occasion: string;
  // Background gradient for guest pages (CSS gradient string)
  bgGradient: string;
  // Primary accent color (hex)
  accent: string;
  // Secondary/glow color (hex)
  glow: string;
  // Text on dark background
  textPrimary: string;
  textSecondary: string;
  // Input styling
  inputBg: string;
  inputBorder: string;
  inputPlaceholder: string;
  // Button
  buttonBg: string;
  buttonText: string;
  // Top bar / header background
  headerBg: string;
  // Preview swatch colors for the picker
  swatchColors: [string, string, string];
}

export const EVENT_THEMES: Record<string, EventTheme> = {
  classic: {
    id: 'classic',
    name: 'Classic Pine',
    occasion: 'Default',
    bgGradient: 'linear-gradient(135deg, #0A2A20 0%, #0d3328 40%, #0A2A20 100%)',
    accent: '#D4A855',
    glow: 'rgba(212,168,85,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(212,168,85,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(212,168,85,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#D4A855',
    buttonText: '#0A2A20',
    headerBg: '#0A2A20',
    swatchColors: ['#0A2A20', '#D4A855', '#F5F0E8'],
  },
  wedding: {
    id: 'wedding',
    name: 'Rose Gold',
    occasion: 'Wedding',
    bgGradient: 'linear-gradient(135deg, #2C1A2E 0%, #3D2040 40%, #2C1A2E 100%)',
    accent: '#E8B4B8',
    glow: 'rgba(232,180,184,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(232,180,184,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(232,180,184,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#E8B4B8',
    buttonText: '#2C1A2E',
    headerBg: '#2C1A2E',
    swatchColors: ['#2C1A2E', '#E8B4B8', '#FFF0F0'],
  },
  birthday: {
    id: 'birthday',
    name: 'Party Purple',
    occasion: 'Birthday',
    bgGradient: 'linear-gradient(135deg, #1A1035 0%, #2D1B69 40%, #1A1035 100%)',
    accent: '#A78BFA',
    glow: 'rgba(167,139,250,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(167,139,250,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(167,139,250,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#A78BFA',
    buttonText: '#1A1035',
    headerBg: '#1A1035',
    swatchColors: ['#1A1035', '#A78BFA', '#EDE9FE'],
  },
  corporate: {
    id: 'corporate',
    name: 'Midnight Blue',
    occasion: 'Corporate',
    bgGradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #0F172A 100%)',
    accent: '#60A5FA',
    glow: 'rgba(96,165,250,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(96,165,250,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(96,165,250,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#60A5FA',
    buttonText: '#0F172A',
    headerBg: '#0F172A',
    swatchColors: ['#0F172A', '#60A5FA', '#DBEAFE'],
  },
  tropical: {
    id: 'tropical',
    name: 'Sunset Coral',
    occasion: 'Beach / Summer',
    bgGradient: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 30%, #0F3460 100%)',
    accent: '#FF6B6B',
    glow: 'rgba(255,107,107,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,107,107,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(255,107,107,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#FF6B6B',
    buttonText: '#1A1A2E',
    headerBg: '#1A1A2E',
    swatchColors: ['#1A1A2E', '#FF6B6B', '#FFE0E0'],
  },
  garden: {
    id: 'garden',
    name: 'Sage Green',
    occasion: 'Garden / Nature',
    bgGradient: 'linear-gradient(135deg, #1B2A1B 0%, #2D4A2D 40%, #1B2A1B 100%)',
    accent: '#86EFAC',
    glow: 'rgba(134,239,172,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(134,239,172,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(134,239,172,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#86EFAC',
    buttonText: '#1B2A1B',
    headerBg: '#1B2A1B',
    swatchColors: ['#1B2A1B', '#86EFAC', '#DCFCE7'],
  },
  gala: {
    id: 'gala',
    name: 'Black & Gold',
    occasion: 'Gala / Formal',
    bgGradient: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 40%, #0A0A0A 100%)',
    accent: '#FFD700',
    glow: 'rgba(255,215,0,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,215,0,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(255,215,0,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#FFD700',
    buttonText: '#0A0A0A',
    headerBg: '#0A0A0A',
    swatchColors: ['#0A0A0A', '#FFD700', '#FFF9DB'],
  },
  holiday: {
    id: 'holiday',
    name: 'Festive Red',
    occasion: 'Holiday / Christmas',
    bgGradient: 'linear-gradient(135deg, #1A0A0A 0%, #3B1111 40%, #1A0A0A 100%)',
    accent: '#F87171',
    glow: 'rgba(248,113,113,0.05)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(248,113,113,0.6)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(248,113,113,0.15)',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    buttonBg: '#F87171',
    buttonText: '#1A0A0A',
    headerBg: '#1A0A0A',
    swatchColors: ['#1A0A0A', '#F87171', '#FEE2E2'],
  },
};

export function getTheme(themeId?: string | null): EventTheme {
  return EVENT_THEMES[themeId || 'classic'] || EVENT_THEMES.classic;
}

export const THEME_LIST = Object.values(EVENT_THEMES);
