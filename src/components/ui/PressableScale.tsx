/**
 * PressableScale Component
 *
 * A pressable component with spring scale animation.
 * Provides premium tactile feedback for all interactive elements.
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  PressableProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { SPRING_CONFIGS } from '@/constants/animations';
import { HapticPatterns } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  /** Scale when pressed (default: 0.95) */
  activeScale?: number;
  /** Spring configuration */
  springConfig?: typeof SPRING_CONFIGS[keyof typeof SPRING_CONFIGS];
  /** Enable haptic feedback (default: true) */
  haptic?: boolean;
  /** Haptic pattern to use */
  hapticPattern?: keyof typeof HapticPatterns;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Disabled state */
  disabled?: boolean;
}

export function PressableScale({
  children,
  activeScale = 0.95,
  springConfig = SPRING_CONFIGS.QUICK,
  haptic = true,
  hapticPattern = 'tap',
  style,
  disabled = false,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  const handlePressIn = useCallback((event: any) => {
    scale.value = withSpring(activeScale, springConfig);
    if (haptic) {
      HapticPatterns[hapticPattern]();
    }
    onPressIn?.(event);
  }, [scale, activeScale, springConfig, haptic, hapticPattern, onPressIn]);

  const handlePressOut = useCallback((event: any) => {
    scale.value = withSpring(1, springConfig);
    onPressOut?.(event);
  }, [scale, springConfig, onPressOut]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * PressableScale variant for larger elements (cards)
 */
export function PressableCard({
  children,
  style,
  ...props
}: PressableScaleProps) {
  return (
    <PressableScale
      activeScale={0.98}
      springConfig={SPRING_CONFIGS.CARD_LIFT}
      {...props}
      style={style}
    >
      {children}
    </PressableScale>
  );
}

/**
 * PressableScale variant for buttons with medium feedback
 */
export function PressableButton({
  children,
  style,
  hapticPattern = 'select',
  ...props
}: PressableScaleProps) {
  return (
    <PressableScale
      activeScale={0.92}
      springConfig={SPRING_CONFIGS.INTERACTIVE}
      hapticPattern={hapticPattern}
      {...props}
      style={style}
    >
      {children}
    </PressableScale>
  );
}

/**
 * PressableScale variant for icons and small touchables
 */
export function PressableIcon({
  children,
  style,
  hapticPattern = 'tap',
  ...props
}: PressableScaleProps) {
  return (
    <PressableScale
      activeScale={0.85}
      springConfig={SPRING_CONFIGS.QUICK}
      hapticPattern={hapticPattern}
      {...props}
      style={style}
    >
      {children}
    </PressableScale>
  );
}

/**
 * PressableScale with lift effect (translateY on press)
 */
interface PressableLiftProps extends PressableScaleProps {
  liftAmount?: number;
}

export function PressableLift({
  children,
  liftAmount = 4,
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressableLiftProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const handlePressIn = useCallback((event: any) => {
    scale.value = withSpring(1.02, SPRING_CONFIGS.CARD_LIFT);
    translateY.value = withSpring(-liftAmount, SPRING_CONFIGS.CARD_LIFT);
    HapticPatterns.tap();
    onPressIn?.(event);
  }, [scale, translateY, liftAmount, onPressIn]);

  const handlePressOut = useCallback((event: any) => {
    scale.value = withSpring(1, SPRING_CONFIGS.CARD_LIFT);
    translateY.value = withSpring(0, SPRING_CONFIGS.CARD_LIFT);
    onPressOut?.(event);
  }, [scale, translateY, onPressOut]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
