/**
 * Safta Auth Layout
 *
 * Layout for parent/grandparent matchmaker authentication flow
 */

import { Redirect, Stack } from 'expo-router';
import { colors } from '@/theme/colors';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';

export default function SaftaAuthLayout() {
  // Parents/grandparents mode is hidden behind a flag (docs/ROADMAP.md)
  if (!FEATURE_SAFTA_MODE) {
    return <Redirect href="/" />;
  }

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
