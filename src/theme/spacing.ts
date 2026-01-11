/**
 * Mazal Spacing System
 *
 * Based on a 4px base unit for consistency
 */

// Base spacing unit
const BASE = 4;

export const spacing = {
  0: 0,
  px: 1,
  0.5: BASE * 0.5,   // 2
  1: BASE,           // 4
  1.5: BASE * 1.5,   // 6
  2: BASE * 2,       // 8
  2.5: BASE * 2.5,   // 10
  3: BASE * 3,       // 12
  3.5: BASE * 3.5,   // 14
  4: BASE * 4,       // 16
  5: BASE * 5,       // 20
  6: BASE * 6,       // 24
  7: BASE * 7,       // 28
  8: BASE * 8,       // 32
  9: BASE * 9,       // 36
  10: BASE * 10,     // 40
  11: BASE * 11,     // 44
  12: BASE * 12,     // 48
  14: BASE * 14,     // 56
  16: BASE * 16,     // 64
  20: BASE * 20,     // 80
  24: BASE * 24,     // 96
  28: BASE * 28,     // 112
  32: BASE * 32,     // 128
  36: BASE * 36,     // 144
  40: BASE * 40,     // 160
  44: BASE * 44,     // 176
  48: BASE * 48,     // 192
  52: BASE * 52,     // 208
  56: BASE * 56,     // 224
  60: BASE * 60,     // 240
  64: BASE * 64,     // 256
  72: BASE * 72,     // 288
  80: BASE * 80,     // 320
  96: BASE * 96,     // 384
} as const;

// Border radius
export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

// Shadows
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  // Card shadow (for profile cards)
  card: {
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  // Gold glow effect
  glow: {
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 0,
  },
} as const;

// Z-index levels
export const zIndex = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// Screen dimensions helpers
export const layout = {
  // Tab bar height
  tabBarHeight: 84,
  // Header height
  headerHeight: 56,
  // Bottom safe area (approximate, use useSafeAreaInsets for actual)
  bottomSafeArea: 34,
  // Card aspect ratio (3:4)
  cardAspectRatio: 4 / 3,
  // Profile card border radius
  cardBorderRadius: 20,
  // Button height
  buttonHeight: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  // Input height
  inputHeight: 48,
  // Avatar sizes
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
    '2xl': 120,
  },
} as const;
