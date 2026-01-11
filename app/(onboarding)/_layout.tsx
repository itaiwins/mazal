/**
 * Onboarding Layout
 *
 * Stack navigator with progress tracking for 13-step profile creation
 */

import { Stack, usePathname } from 'expo-router';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = [
  'welcome',
  'basics',
  'photos',
  'jewish-identity',
  'location',
  'education',
  'lifestyle',
  'relationship-goals',
  'dealbreakers',
  'prompts',
  'preferences',
  'notifications',
  'complete',
];

function ProgressBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Extract current step from pathname
  const currentStep = pathname.split('/').pop() || 'welcome';
  const currentIndex = STEPS.indexOf(currentStep);
  const progress = currentIndex >= 0 ? (currentIndex + 1) / STEPS.length : 0;

  // Don't show progress on welcome and complete screens
  const showProgress = currentIndex > 0 && currentIndex < STEPS.length - 1;

  // Calculate the progress bar width (accounting for padding)
  const trackWidth = SCREEN_WIDTH - spacing[6] * 2;
  const progressWidth = trackWidth * progress;

  const progressStyle = useAnimatedStyle(() => ({
    width: withSpring(progressWidth, {
      damping: 15,
      stiffness: 100,
    }),
  }));

  if (!showProgress) return null;

  return (
    <View style={[styles.progressContainer, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>
    </View>
  );
}

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ProgressBar />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="basics" />
        <Stack.Screen name="photos" />
        <Stack.Screen name="jewish-identity" />
        <Stack.Screen name="location" />
        <Stack.Screen name="education" />
        <Stack.Screen name="lifestyle" />
        <Stack.Screen name="relationship-goals" />
        <Stack.Screen name="dealbreakers" />
        <Stack.Screen name="prompts" />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="complete" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: spacing[6],
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.neutral[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.gold,
    borderRadius: 2,
  },
});
