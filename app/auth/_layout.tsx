/**
 * Auth Deep Link Layout
 *
 * Unlike `(auth)`, this is a real path segment: the screens here are the landing
 * targets for `mazal://auth/...` links in Supabase auth emails, so the directory
 * name has to appear in the URL.
 *
 * Gestures are off because there is nothing to go back to — the user arrived here
 * from their email, not from inside the app.
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function AuthLinkLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: {
          backgroundColor: colors.dark.background,
        },
      }}
    >
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="confirm" />
    </Stack>
  );
}
