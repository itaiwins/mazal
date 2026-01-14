/**
 * Like Animation Component
 *
 * Heart burst animation with gold particles for when users like content
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

interface LikeAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  size?: number;
}

// Particle component for burst effect
function Particle({ delay, angle, distance }: { delay: number; angle: number; distance: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const radians = (angle * Math.PI) / 180;
    const targetX = Math.cos(radians) * distance;
    const targetY = Math.sin(radians) * distance;

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(200, withTiming(0, { duration: 300 }))
    ));
    scale.value = withDelay(delay, withSequence(
      withSpring(1, { damping: 8 }),
      withDelay(200, withTiming(0, { duration: 300 }))
    ));
    translateX.value = withDelay(delay, withSpring(targetX, { damping: 12 }));
    translateY.value = withDelay(delay, withSpring(targetY, { damping: 12 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.particle, animatedStyle]}>
      <View style={styles.particleDot} />
    </Animated.View>
  );
}

export function LikeAnimation({ visible, onComplete, size = 80 }: LikeAnimationProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 100 });
      scale.value = withSequence(
        withSpring(1.4, { damping: 6, stiffness: 200 }),
        withSpring(1, { damping: 8 }),
        withDelay(400, withTiming(0, { duration: 200 }, () => {
          if (onComplete) {
            runOnJS(onComplete)();
          }
        }))
      );
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  // Generate particles at different angles
  const particles = [0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
    <Particle
      key={angle}
      angle={angle}
      delay={i * 30}
      distance={50 + Math.random() * 20}
    />
  ));

  return (
    <View style={styles.container}>
      {particles}
      <Animated.View style={[styles.heartContainer, heartStyle, { width: size, height: size }]}>
        <Ionicons name="heart" size={size * 0.6} color={colors.primary.gold} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  heartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 100,
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  particle: {
    position: 'absolute',
  },
  particleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.gold,
  },
});
