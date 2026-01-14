/**
 * Orthodox Layout
 *
 * Stack navigator for Orthodox-only section
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function OrthodoxLayout() {
  const theme = useTheme();

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
