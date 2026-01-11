/**
 * Safta Mode Layout
 *
 * Stack navigator for grandparent matchmaking section
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';

export default function SaftaLayout() {
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
      <Stack.Screen name="setup" />
      <Stack.Screen name="connect" />
      <Stack.Screen name="browse" />
      <Stack.Screen name="likes" />
    </Stack>
  );
}
