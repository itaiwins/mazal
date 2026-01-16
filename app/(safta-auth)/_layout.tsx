/**
 * Safta Auth Layout
 *
 * Layout for parent/grandparent matchmaker authentication flow
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function SaftaAuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: colors.dark.background,
        },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="enter-code" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="complete" />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
