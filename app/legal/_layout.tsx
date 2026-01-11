/**
 * Legal Layout
 *
 * Stack navigator for legal screens (Terms, Privacy)
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function LegalLayout() {
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
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
