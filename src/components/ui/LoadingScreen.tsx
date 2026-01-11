/**
 * Loading Screen
 *
 * Full-screen loading indicator
 */

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.5, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, animatedStyle]}>
        <Text style={styles.logo}>✡️</Text>
      </Animated.View>
      <Text style={styles.brand}>Mazal</Text>
      <Text style={styles.message}>{message}</Text>
      <ActivityIndicator
        size="small"
        color={colors.primary.gold}
        style={styles.spinner}
      />
    </View>
  );
}

/**
 * Inline loading indicator
 */
export function LoadingIndicator({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  return (
    <View style={styles.inlineContainer}>
      <ActivityIndicator
        size={size === 'large' ? 'large' : 'small'}
        color={colors.primary.gold}
      />
    </View>
  );
}

/**
 * Skeleton loading placeholder
 */
export function Skeleton({
  width,
  height,
  borderRadius = 8,
}: {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
}) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Build style with proper types for Animated.View
  const sizeStyle = { width: width as number | `${number}%`, height, borderRadius };

  return (
    <Animated.View
      style={[
        styles.skeleton,
        sizeStyle,
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  logo: {
    fontSize: 48,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.navy,
    marginBottom: spacing[2],
  },
  message: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[4],
  },
  spinner: {
    marginTop: spacing[2],
  },
  inlineContainer: {
    padding: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    backgroundColor: colors.neutral[200],
  },
});
