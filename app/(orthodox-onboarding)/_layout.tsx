/**
 * Orthodox Onboarding Layout
 *
 * Layout for Orthodox user onboarding screens
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function OrthodoxOnboardingLayout() {
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
