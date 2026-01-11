/**
 * Premium Layout
 *
 * Stack navigator for premium screens
 */

import { Stack } from 'expo-router';

export default function PremiumLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
