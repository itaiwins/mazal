/**
 * Messages Layout
 *
 * Stack navigator for messages section
 */

import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function MessagesLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[matchId]"
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
