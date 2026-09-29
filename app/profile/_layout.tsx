/**
 * Profile Layout
 *
 * Stack navigator for profile screens
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function ProfileLayout() {
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
      {/* No `index`: the half-built light-themed Edit Profile that used to sit there was
          dead code and won the `/profile` URL from the Profile tab on web (MEXA-338,
          walkthrough finding 12). `edit` is the real one. */}
      <Stack.Screen name="edit" />
      <Stack.Screen name="preview" />
    </Stack>
  );
}
