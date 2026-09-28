/**
 * Orthodox Layout
 *
 * Stack navigator for Orthodox-only section
 */

import { Redirect, Stack } from 'expo-router';
import { useTheme } from '@/theme';
import { FEATURE_ORTHODOX_MODE } from '@/lib/config/features';

export default function OrthodoxLayout() {
  const theme = useTheme();

  // Orthodox mode is hidden behind a flag (docs/ROADMAP.md)
  if (!FEATURE_ORTHODOX_MODE) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      <Stack.Screen name="shidduch" />
      <Stack.Screen name="shadchan" />
      <Stack.Screen name="guidelines" />
    </Stack>
  );
}
