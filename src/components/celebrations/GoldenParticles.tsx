/**
 * GoldenParticles Component
 *
 * Particle burst effect for match celebrations.
 * 50 particles with spring physics that burst outward
 * from the center and fade out.
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { SPRING_CONFIGS } from '@/constants/animations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PARTICLE_COUNT = 50;

interface ParticleConfig {
  id: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
  duration: number;
  shape: 'circle' | 'star' | 'diamond';
}

interface GoldenParticlesProps {
  /** Center X position */
  centerX?: number;
  /** Center Y position */
  centerY?: number;
  /** Whether to trigger the burst */
  active: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

// Generate random particle configurations
function generateParticles(): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  const shapes: ('circle' | 'star' | 'diamond')[] = ['circle', 'star', 'diamond'];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      id: i,
      angle: (360 / PARTICLE_COUNT) * i + Math.random() * 30 - 15,
      distance: 100 + Math.random() * 200,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 300,
      duration: 800 + Math.random() * 400,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  }

  return particles;
}

// Single particle component
function Particle({
  config,
  active,
  centerX,
  centerY,
}: {
  config: ParticleConfig;
  active: boolean;
  centerX: number;
  centerY: number;
}) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      // Start animation with delay
      progress.value = withDelay(
        config.delay,
        withSpring(1, {
          ...SPRING_CONFIGS.BOUNCY,
          damping: 12,
        })
      );

      opacity.value = withDelay(
        config.delay,
        withTiming(1, { duration: 150 }, () => {
          // Fade out after burst
          opacity.value = withDelay(
            config.duration - 300,
            withTiming(0, { duration: 300 })
          );
        })
      );
    } else {
      progress.value = 0;
      opacity.value = 0;
    }
  }, [active, config.delay, config.duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const angleRad = (config.angle * Math.PI) / 180;
    const x = centerX + Math.cos(angleRad) * config.distance * progress.value;
    const y = centerY + Math.sin(angleRad) * config.distance * progress.value;
    const rotation = progress.value * 360;

    return {
      position: 'absolute',
      left: x - config.size / 2,
      top: y - config.size / 2,
      width: config.size,
      height: config.size,
      opacity: opacity.value,
      transform: [
        { rotate: `${rotation}deg` },
        { scale: 1 - progress.value * 0.3 },
      ],
    };
  });

  const shapeStyle = useMemo(() => {
    switch (config.shape) {
      case 'star':
        return styles.star;
      case 'diamond':
        return styles.diamond;
      default:
        return styles.circle;
    }
  }, [config.shape]);

  return (
    <Animated.View style={[styles.particle, shapeStyle, animatedStyle]} />
  );
}

export function GoldenParticles({
  centerX = SCREEN_WIDTH / 2,
  centerY = SCREEN_HEIGHT / 2,
  active,
  onComplete,
}: GoldenParticlesProps) {
  const particles = useMemo(() => generateParticles(), []);

  useEffect(() => {
    if (active && onComplete) {
      // Call onComplete after animations finish
      const timeout = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [active, onComplete]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((config) => (
        <Particle
          key={config.id}
          config={config}
          active={active}
          centerX={centerX}
          centerY={centerY}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    backgroundColor: colors.primary.gold,
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  circle: {
    borderRadius: 100,
  },
  star: {
    backgroundColor: 'transparent',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.primary.gold,
    shadowColor: colors.primary.gold,
  },
  diamond: {
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
});

export default GoldenParticles;
