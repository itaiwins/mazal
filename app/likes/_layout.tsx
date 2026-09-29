/**
 * Likes Layout
 *
 * Stack navigator for the "Likes You" screen (MEXA-315). A card presentation rather than
 * the `premium` group's modal: this is a list you come back from to the Matches tab, not a
 * purchase sheet.
 */

import { Stack } from 'expo-router';

export default function LikesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
