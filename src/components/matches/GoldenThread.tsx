/**
 * GoldenThread Component
 *
 * Animated SVG path connecting match avatars in the carousel.
 * Creates the "Constellation Dating" visual where matches are stars
 * connected by golden threads.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface GoldenThreadProps {
  /** Width of the thread container */
  width?: number;
  /** Height of the thread container */
  height?: number;
  /** Number of connection points (match avatars) */
  pointCount: number;
  /** Horizontal spacing between points */
  pointSpacing?: number;
  /** Starting X offset */
  startX?: number;
  /** Y position of the thread */
  yPosition?: number;
  /** Whether to animate the glow effect */
  animated?: boolean;
}

export function GoldenThread({
  width = SCREEN_WIDTH,
  height = 100,
  pointCount,
  pointSpacing = 90,
  startX = 50,
  yPosition = 50,
  animated = true,
}: GoldenThreadProps) {
  const strokeDashOffset = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);

  // Calculate path
  const generatePath = () => {
    if (pointCount < 2) return '';

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: startX + i * pointSpacing,
        y: yPosition,
      });
    }

    // Create smooth curve through points
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;

      // Add slight wave to the thread
      const waveHeight = 8;
      const controlY = yPosition + (i % 2 === 0 ? waveHeight : -waveHeight);

      path += ` Q ${midX} ${controlY}, ${curr.x} ${curr.y}`;
    }

    return path;
  };

  const pathD = generatePath();
  const pathLength = pointCount > 1 ? (pointCount - 1) * pointSpacing * 1.5 : 0;

  useEffect(() => {
    if (!animated) return;

    // Animate dash offset for "drawing" effect
    strokeDashOffset.value = withTiming(pathLength, {
      duration: 2000,
      easing: Easing.out(Easing.cubic),
    });

    // Pulsing glow effect
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [animated, pathLength]);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: animated ? pathLength - strokeDashOffset.value : 0,
  }));

  const animatedGlowProps = useAnimatedProps(() => ({
    opacity: glowOpacity.value,
  }));

  if (pointCount < 2) return null;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.primary.gold} stopOpacity="0.2" />
            <Stop offset="50%" stopColor={colors.primary.gold} stopOpacity="1" />
            <Stop offset="100%" stopColor={colors.primary.gold} stopOpacity="0.2" />
          </LinearGradient>
          <LinearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.primary.gold} stopOpacity="0" />
            <Stop offset="50%" stopColor={colors.primary.gold} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={colors.primary.gold} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Glow layer */}
        <AnimatedPath
          d={pathD}
          stroke="url(#glowGradient)"
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          animatedProps={animatedGlowProps}
        />

        {/* Main thread */}
        <AnimatedPath
          d={pathD}
          stroke="url(#goldGradient)"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={pathLength}
          animatedProps={animatedPathProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default GoldenThread;
