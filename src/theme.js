export const colors = {
  // Core Brand Colors
  primary: '#1F6F4A',
  primaryDark: '#14492F',
  primaryLight: '#2C8E60',
  primarySoft: '#E6F3EC',
  primarySoftBorder: '#C1E2D0',

  // Surfaces & Backgrounds
  bg: '#F7F5EE',
  surface: '#FFFFFF',
  surfaceAlt: '#EFECE1',
  surfaceMuted: '#F4F2E9',

  // Borders & Dividers
  border: '#DFDACB',
  borderSubtle: '#ECE7DA',
  borderStrong: '#C5BFB0',

  // Text Hierarchy
  text: '#17221C',
  textSecondary: '#3C4942',
  textMuted: '#5C6C63',
  textSubtle: '#8C9B92',
  onPrimary: '#FFFFFF',

  // Token & Reward Accents
  tokenBg: '#FEF6D8',
  tokenBorder: '#F5E29F',
  tokenText: '#7A4F00',
  tokenGold: '#D4A017',

  // Feedback & Status
  success: '#237B47',
  successSoft: '#E3F4EA',
  successBorder: '#BDE4CC',
  danger: '#B3261E',
  dangerSoft: '#FCEAE8',
  dangerBorder: '#F7C6C2',
  warnSoft: '#FFF4D6',
  warnText: '#6B4A00',
  warnBorder: '#F6E0A4',

  // Mission Categories
  go: '#1F6F4A',
  goSoft: '#E6F3EC',
  look: '#1A62A5',
  lookSoft: '#E7F0FA',
  learn: '#6B3FA0',
  learnSoft: '#F2EAF9'
};

export const spacing = {
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48
};

export const radius = {
  6: 6,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  pill: 999
};

export const type = {
  hero: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, lineHeight: 36 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, lineHeight: 32 },
  h1: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 },
  h2: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, lineHeight: 24 },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  captionBold: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  metric: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30 }
};

export const shadows = {
  none: {},
  subtle: {
    shadowColor: '#17221C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  card: {
    shadowColor: '#17221C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  floating: {
    shadowColor: '#17221C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4
  },
  glowPrimary: {
    shadowColor: '#1F6F4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3
  }
};
