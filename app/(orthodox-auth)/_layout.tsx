/**
 * Orthodox Auth Layout
 *
 * Layout for Orthodox authentication screens
 * Uses a dark, elegant theme with Hebrew elements
 */

import { Redirect, Stack } from 'expo-router';
import { colors } from '@/theme/colors';
import { FEATURE_ORTHODOX_MODE } from '@/lib/config/features';

export default function OrthodoxAuthLayout() {
  // Orthodox mode is hidden behind a flag (docs/ROADMAP.md)
  if (!FEATURE_ORTHODOX_MODE) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.dark.background,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
