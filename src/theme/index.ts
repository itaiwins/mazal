/**
 * Mazal Theme System
 *
 * Centralized design tokens and theme provider
 */

import React, { createContext, useContext, useMemo } from 'react';
import { colors, lightTheme, darkTheme, type Theme, type ColorScheme } from './colors';
import { typography, fontFamily, fontSize, lineHeight, letterSpacing } from './typography';
import { spacing, borderRadius, shadows, zIndex, layout } from './spacing';

// Re-export all theme modules
export * from './colors';
export * from './typography';
export * from './spacing';

// Complete theme object
export interface MazalTheme {
  colors: Theme;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  letterSpacing: typeof letterSpacing;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  zIndex: typeof zIndex;
  layout: typeof layout;
  colorScheme: ColorScheme;
  isDark: boolean;
}

// Theme context
const ThemeContext = createContext<MazalTheme | null>(null);

// Theme provider props
interface ThemeProviderProps {
  children: React.ReactNode;
  forcedColorScheme?: ColorScheme;
}

/**
 * Theme Provider Component
 *
 * Wraps the app to provide theme context
 */
export function ThemeProvider({ children, forcedColorScheme }: ThemeProviderProps) {
  // Always use dark mode - ignore system preference
  const colorScheme: ColorScheme = 'dark';
  const isDark = colorScheme === 'dark';

  const theme = useMemo<MazalTheme>(() => ({
    colors: isDark ? darkTheme : lightTheme,
    typography,
    fontFamily,
    fontSize,
    lineHeight,
    letterSpacing,
    spacing,
    borderRadius,
    shadows,
    zIndex,
    layout,
    colorScheme,
    isDark,
  }), [colorScheme, isDark]);

  return React.createElement(
    ThemeContext.Provider,
    { value: theme },
    children
  );
}

/**
 * Hook to access the current theme
 */
export function useTheme(): MazalTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return theme;
}

/**
 * Hook to get just the color palette
 */
export function useColors(): Theme {
  const theme = useTheme();
  return theme.colors;
}

/**
 * Quick access to static tokens (no re-render on theme change)
 */
export const tokens = {
  colors,
  typography,
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  layout,
} as const;
