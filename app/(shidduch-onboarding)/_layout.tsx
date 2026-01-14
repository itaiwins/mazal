/**
 * Shidduch Onboarding Layout
 *
 * A unique, elegant onboarding experience for Orthodox users
 * building their shidduch resume (profile).
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function ShidduchOnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: '#0a1628', // Deep navy
        },
        gestureEnabled: false, // Prevent accidental back navigation
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="basics" />
      <Stack.Screen name="family" />
      <Stack.Screen name="education" />
      <Stack.Screen name="hashkafa" />
      <Stack.Screen name="looking-for" />
      <Stack.Screen name="references" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
