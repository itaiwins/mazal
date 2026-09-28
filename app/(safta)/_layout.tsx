/**
 * Safta Mode Layout
 *
 * Stack navigator for grandparent matchmaking section
 */

import { Redirect, Stack } from 'expo-router';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';

export default function SaftaLayout() {
  const theme = useTheme();

  // Parents/grandparents mode is hidden behind a flag (docs/ROADMAP.md)
  if (!FEATURE_SAFTA_MODE) {
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
      <Stack.Screen name="setup" />
      <Stack.Screen name="connect" />
      <Stack.Screen name="browse" />
      <Stack.Screen name="likes" />
    </Stack>
  );
}
