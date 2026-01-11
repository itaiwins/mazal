/**
 * Mazal Typography System
 *
 * Font Families:
 * - Playfair Display: Headlines, app name, section headers, celebration screens
 * - Inter: Body text, buttons, navigation, all readable content
 * - Noto Sans Hebrew: Hebrew phrases, cultural elements
 */

import { Platform, TextStyle } from 'react-native';

// Font family definitions - using system fonts for now
// To use custom fonts, download them to assets/fonts and uncomment fontsToLoad
export const fontFamily = {
  // Serif - Headlines (using system serif)
  serif: {
    regular: Platform.select({ ios: 'Georgia', android: 'serif' }) || 'Georgia',
    medium: Platform.select({ ios: 'Georgia', android: 'serif' }) || 'Georgia',
    semiBold: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) || 'Georgia',
    bold: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) || 'Georgia',
  },
  // Sans - Body (using system sans)
  sans: {
    regular: Platform.select({ ios: 'System', android: 'Roboto' }) || 'System',
    medium: Platform.select({ ios: 'System', android: 'Roboto' }) || 'System',
    semiBold: Platform.select({ ios: 'System', android: 'Roboto' }) || 'System',
    bold: Platform.select({ ios: 'System', android: 'Roboto' }) || 'System',
  },
  // Hebrew (using system default)
  hebrew: {
    regular: Platform.select({ ios: 'System', android: 'Roboto' }) || 'System',
    medium: Platform.select({ ios: 'System', android: 'Roboto' }) || 'System',
    bold: Platform.select({ ios: 'System', android: 'Roboto' }) || 'System',
  },
} as const;

// Font sizes following a modular scale
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
  '4xl': 48,
  '5xl': 60,
} as const;

// Line heights
export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

// Letter spacing
export const letterSpacing = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  widest: 1,
} as const;

// Typography presets
export const typography = {
  // Headlines (Playfair Display)
  h1: {
    fontFamily: fontFamily.serif.bold,
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  } as TextStyle,

  h2: {
    fontFamily: fontFamily.serif.bold,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  } as TextStyle,

  h3: {
    fontFamily: fontFamily.serif.semiBold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  h4: {
    fontFamily: fontFamily.serif.medium,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  // Body text (Inter)
  bodyLarge: {
    fontFamily: fontFamily.sans.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  body: {
    fontFamily: fontFamily.sans.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  bodySmall: {
    fontFamily: fontFamily.sans.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  // Labels
  label: {
    fontFamily: fontFamily.sans.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.snug,
    letterSpacing: letterSpacing.wide,
  } as TextStyle,

  labelSmall: {
    fontFamily: fontFamily.sans.medium,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.snug,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  } as TextStyle,

  // Buttons
  buttonLarge: {
    fontFamily: fontFamily.sans.semiBold,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  } as TextStyle,

  button: {
    fontFamily: fontFamily.sans.semiBold,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  } as TextStyle,

  buttonSmall: {
    fontFamily: fontFamily.sans.semiBold,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  } as TextStyle,

  // Special
  caption: {
    fontFamily: fontFamily.sans.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  // Celebration text (MAZAL!!)
  celebration: {
    fontFamily: fontFamily.serif.bold,
    fontSize: fontSize['5xl'],
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  } as TextStyle,

  // Hebrew text
  hebrew: {
    fontFamily: fontFamily.hebrew.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  } as TextStyle,
} as const;

// Font loading configuration for expo-font
// Uncomment and add font files to assets/fonts to use custom fonts
export const fontsToLoad = {
  // 'PlayfairDisplay-Regular': require('@/assets/fonts/PlayfairDisplay/PlayfairDisplay-Regular.ttf'),
  // 'PlayfairDisplay-Medium': require('@/assets/fonts/PlayfairDisplay/PlayfairDisplay-Medium.ttf'),
  // 'PlayfairDisplay-SemiBold': require('@/assets/fonts/PlayfairDisplay/PlayfairDisplay-SemiBold.ttf'),
  // 'PlayfairDisplay-Bold': require('@/assets/fonts/PlayfairDisplay/PlayfairDisplay-Bold.ttf'),
  // 'Inter-Regular': require('@/assets/fonts/Inter/Inter-Regular.ttf'),
  // 'Inter-Medium': require('@/assets/fonts/Inter/Inter-Medium.ttf'),
  // 'Inter-SemiBold': require('@/assets/fonts/Inter/Inter-SemiBold.ttf'),
  // 'Inter-Bold': require('@/assets/fonts/Inter/Inter-Bold.ttf'),
  // 'NotoSansHebrew-Regular': require('@/assets/fonts/NotoSansHebrew/NotoSansHebrew-Regular.ttf'),
  // 'NotoSansHebrew-Medium': require('@/assets/fonts/NotoSansHebrew/NotoSansHebrew-Medium.ttf'),
  // 'NotoSansHebrew-Bold': require('@/assets/fonts/NotoSansHebrew/NotoSansHebrew-Bold.ttf'),
};
