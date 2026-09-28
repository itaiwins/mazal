/**
 * Mazal Color Palette
 *
 * Design Philosophy:
 * - Mazal Navy (#0D1B3E): Deep, trustworthy, sophisticated
 * - Destiny Gold (#C9A227): Warm, premium, celebratory
 * - Warm tones throughout to feel inviting, never clinical
 */

export const colors = {
  // Primary Colors
  primary: {
    navy: '#0D1B3E',
    gold: '#C9A227',
    white: '#FFFFFF',
    coral: '#FF7F50',
  },

  // Secondary Colors
  secondary: {
    cream: '#FAF7F2',
    blush: '#F5E1DC',
    sage: '#E8EDE4',
    rose: '#D4847C',
  },

  // Safta Mode Colors (Purple/Lavender theme)
  safta: {
    primary: '#7B68EE',       // Medium slate blue - main accent
    secondary: '#9370DB',     // Medium purple
    light: '#E6E0FA',         // Light lavender background
    dark: '#1A1530',          // Dark purple-navy for dark mode
    card: '#1E1A2E',          // Elevated card in dark mode
    accent: '#A78BFA',        // Lighter purple for highlights
    coral: '#FF7F50',         // Coral for Safta Pro accents
    blush: '#F5E1DC',         // Blush for Safta backgrounds
  },

  // Status Colors (for limit indicators)
  status: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#E53935',
    info: '#2196F3',
  },

  // Semantic Colors
  semantic: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#E53935',
    info: '#2196F3',
  },

  // Neutral Colors
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // Dark Mode Colors
  dark: {
    background: '#0A0E1A',
    card: '#141824',
    elevated: '#1E2640',
    gold: '#B8922A',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
  },

  // Gradient Colors
  gradient: {
    goldStart: '#C9A227',
    goldEnd: '#E8D48A',
    navyStart: '#0D1B3E',
    navyEnd: '#1E3A5F',
  },

  // Transparent variants
  transparent: {
    black10: 'rgba(0, 0, 0, 0.1)',
    black20: 'rgba(0, 0, 0, 0.2)',
    black40: 'rgba(0, 0, 0, 0.4)',
    black50: 'rgba(0, 0, 0, 0.5)',
    black60: 'rgba(0, 0, 0, 0.6)',
    black80: 'rgba(0, 0, 0, 0.8)',
    white10: 'rgba(255, 255, 255, 0.1)',
    white20: 'rgba(255, 255, 255, 0.2)',
    white30: 'rgba(255, 255, 255, 0.3)',
    white40: 'rgba(255, 255, 255, 0.4)',
    white50: 'rgba(255, 255, 255, 0.5)',
    white60: 'rgba(255, 255, 255, 0.6)',
    white70: 'rgba(255, 255, 255, 0.7)',
    white80: 'rgba(255, 255, 255, 0.8)',
    gold10: 'rgba(201, 162, 39, 0.1)',
    gold20: 'rgba(201, 162, 39, 0.2)',
    gold30: 'rgba(201, 162, 39, 0.3)',
    gold50: 'rgba(201, 162, 39, 0.5)',
    gold70: 'rgba(201, 162, 39, 0.7)',
    navy70: 'rgba(13, 27, 62, 0.7)',
    // Safta purple transparents
    purple10: 'rgba(123, 104, 238, 0.1)',
    purple20: 'rgba(123, 104, 238, 0.2)',
    purple30: 'rgba(123, 104, 238, 0.3)',
    purple50: 'rgba(123, 104, 238, 0.5)',
    purple70: 'rgba(123, 104, 238, 0.7)',
    // Coral transparents (for limit banners)
    coral10: 'rgba(255, 127, 80, 0.1)',
    coral20: 'rgba(255, 127, 80, 0.2)',
    coral40: 'rgba(255, 127, 80, 0.4)',
    coral50: 'rgba(255, 127, 80, 0.5)',
    // Error transparents (for danger zones)
    error10: 'rgba(229, 57, 53, 0.1)',
    error20: 'rgba(229, 57, 53, 0.2)',
    // Success transparents (verified badges, stat tiles) — semantic.success #4CAF50
    success10: 'rgba(76, 175, 80, 0.1)',
    // White very light
    white05: 'rgba(255, 255, 255, 0.05)',
  },
} as const;

// Light theme
export const lightTheme = {
  background: colors.primary.white,
  surface: colors.secondary.cream,
  surfaceElevated: colors.primary.white,
  text: colors.primary.navy,
  textSecondary: colors.neutral[600],
  textTertiary: colors.neutral[400],
  primary: colors.primary.gold,
  primaryText: colors.primary.navy,
  border: colors.neutral[200],
  divider: colors.neutral[100],
  icon: colors.neutral[600],
  iconActive: colors.primary.gold,
  cardBackground: colors.primary.white,
  tabBar: colors.primary.white,
  tabBarBorder: colors.neutral[200],
};

// Dark theme
export const darkTheme = {
  background: colors.dark.background,
  surface: colors.dark.card,
  surfaceElevated: colors.dark.elevated,
  text: colors.dark.text,
  textSecondary: colors.dark.textSecondary,
  textTertiary: colors.neutral[600],
  primary: colors.dark.gold,
  primaryText: colors.dark.text,
  border: colors.neutral[800],
  divider: colors.neutral[900],
  icon: colors.neutral[400],
  iconActive: colors.dark.gold,
  cardBackground: colors.dark.card,
  tabBar: colors.dark.card,
  tabBarBorder: colors.neutral[800],
};

export interface Theme {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryText: string;
  border: string;
  divider: string;
  icon: string;
  iconActive: string;
  cardBackground: string;
  tabBar: string;
  tabBarBorder: string;
}

export type ColorScheme = 'light' | 'dark';
