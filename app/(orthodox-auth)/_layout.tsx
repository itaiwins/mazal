/**
 * Orthodox Auth Layout
 *
 * Layout for Orthodox authentication screens
 * Uses a dark, elegant theme with Hebrew elements
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function OrthodoxAuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.primary.navy,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
