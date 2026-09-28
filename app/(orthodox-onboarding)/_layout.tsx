/**
 * Orthodox Onboarding Layout
 *
 * Layout for Orthodox user onboarding screens
 */

import { Redirect, Stack } from 'expo-router';
import { colors } from '@/theme/colors';
import { FEATURE_ORTHODOX_MODE } from '@/lib/config/features';

export default function OrthodoxOnboardingLayout() {
  // Orthodox mode is hidden behind a flag (docs/ROADMAP.md)
  if (!FEATURE_ORTHODOX_MODE) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#0a1628',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="basics" />
      <Stack.Screen name="background" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
