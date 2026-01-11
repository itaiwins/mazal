/**
 * Auth Layout
 *
 * Layout for authentication screens (login, register, etc.)
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function AuthLayout() {
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
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="phone-verify" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
