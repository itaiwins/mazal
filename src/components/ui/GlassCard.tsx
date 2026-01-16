/**
 * GlassCard Component
 *
 * A premium glass-morphism card with blur backdrop.
 * Uses expo-blur for the frosted glass effect.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { borderRadius, shadows, spacing } from '@/theme/spacing';

interface GlassCardProps {
  children: React.ReactNode;
  /** Blur intensity (0-100) */
  intensity?: number;
  /** Background tint */
  tint?: 'light' | 'dark' | 'default';
  /** Border accent color */
  borderColor?: string;
  /** Show glow effect */
  glow?: boolean;
  /** Glow color */
  glowColor?: string;
  /** Border radius size */
  radius?: keyof typeof borderRadius;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Content padding */
  padding?: keyof typeof spacing;
  /** Animated opacity based on scroll or gesture */
  animatedOpacity?: SharedValue<number>;
}

export function GlassCard({
  children,
  intensity = 20,
  tint = 'dark',
  borderColor = colors.transparent.white20,
  glow = false,
  glowColor = colors.primary.gold,
  radius = 'xl',
  style,
  padding = 4,
  animatedOpacity,
}: GlassCardProps) {
  const animatedStyle = useAnimatedStyle(() => {
    if (!animatedOpacity) {
      return { opacity: 1 };
    }
    return {
      opacity: animatedOpacity.value,
    };
  });

  const containerStyle: ViewStyle = {
    borderRadius: borderRadius[radius],
    overflow: 'hidden',
    ...(glow && {
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    }),
  };

  return (
    <Animated.View style={[containerStyle, style, animatedStyle]}>
      {/* Blur backdrop */}
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />

      {/* Gradient overlay for glass effect */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.15)',
          'rgba(255, 255, 255, 0.05)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Content with border */}
      <View
        style={[
          styles.content,
          {
            padding: spacing[padding],
            borderRadius: borderRadius[radius],
            borderColor,
          },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * GlassCard variant with gold accent for premium features
 */
export function GoldGlassCard(props: Omit<GlassCardProps, 'borderColor' | 'glow' | 'glowColor'>) {
  return (
    <GlassCard
      {...props}
      borderColor={colors.transparent.gold30}
      glow
      glowColor={colors.primary.gold}
    />
  );
}

/**
 * GlassCard variant for Safta/matchmaker mode
 */
export function SaftaGlassCard(props: Omit<GlassCardProps, 'borderColor' | 'glow' | 'glowColor'>) {
  return (
    <GlassCard
      {...props}
      borderColor={colors.transparent.purple30}
      glow
      glowColor={colors.safta.primary}
    />
  );
}

/**
 * Solid card without blur (for better performance in lists)
 */
interface SolidCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'gold' | 'safta';
  radius?: keyof typeof borderRadius;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
}

export function SolidCard({
  children,
  variant = 'default',
  radius = 'xl',
  style,
  padding = 4,
}: SolidCardProps) {
  const variantStyles = {
    default: {
      backgroundColor: colors.dark.card,
      borderColor: colors.transparent.white10,
    },
    gold: {
      backgroundColor: colors.transparent.gold10,
      borderColor: colors.transparent.gold30,
    },
    safta: {
      backgroundColor: colors.transparent.purple10,
      borderColor: colors.transparent.purple30,
    },
  };

  return (
    <View
      style={[
        styles.solidCard,
        {
          ...variantStyles[variant],
          borderRadius: borderRadius[radius],
          padding: spacing[padding],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    borderWidth: 1,
  },
  solidCard: {
    borderWidth: 1,
    ...shadows.card,
  },
});

export default GlassCard;
