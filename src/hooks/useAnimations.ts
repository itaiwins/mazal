/**
 * Animation Hooks
 *
 * Reusable animation hooks for consistent, premium interactions.
 * Built on React Native Reanimated 3.
 */

import { useMemo, useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  SharedValue,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SPRING_CONFIGS, TIMING_CONFIGS, STAGGER_DELAYS } from '@/constants/animations';
import { HapticPatterns } from '@/utils/haptics';

/**
 * Press animation with scale - for buttons and touchables
 */
export function usePressAnimation(
  config = SPRING_CONFIGS.QUICK,
  scaleDown = 0.95
) {
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    'worklet';
    scale.value = withSpring(scaleDown, config);
    isPressed.value = true;
    runOnJS(HapticPatterns.tap)();
  }, [scale, scaleDown, config, isPressed]);

  const onPressOut = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, config);
    isPressed.value = false;
  }, [scale, config, isPressed]);

  return { animatedStyle, onPressIn, onPressOut, scale, isPressed };
}

/**
 * Press animation for cards - includes slight lift and shadow
 */
export function useCardPressAnimation(config = SPRING_CONFIGS.CARD_LIFT) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const onPressIn = useCallback(() => {
    'worklet';
    scale.value = withSpring(1.02, config);
    translateY.value = withSpring(-4, config);
    runOnJS(HapticPatterns.tap)();
  }, [scale, translateY, config]);

  const onPressOut = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, config);
    translateY.value = withSpring(0, config);
  }, [scale, translateY, config]);

  return { animatedStyle, onPressIn, onPressOut };
}

/**
 * Parallax scroll effect for images and backgrounds
 */
export function useParallax(
  scrollY: SharedValue<number>,
  factor = 0.3,
  offset = 0
) {
  return useAnimatedStyle(() => ({
    transform: [
      { translateY: offset + scrollY.value * factor },
    ],
  }));
}

/**
 * Fade and slide based on scroll position
 */
export function useScrollFade(
  scrollY: SharedValue<number>,
  fadeStart: number,
  fadeEnd: number,
  direction: 'in' | 'out' = 'in'
) {
  return useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [fadeStart, fadeEnd],
      direction === 'in' ? [0, 1] : [1, 0],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [fadeStart, fadeEnd],
      direction === 'in' ? [20, 0] : [0, -20],
      Extrapolation.CLAMP
    );

    return { opacity, transform: [{ translateY }] };
  });
}

/**
 * Breath animation - subtle continuous scale oscillation
 */
export function useBreathAnimation(
  minScale = 0.98,
  maxScale = 1.02,
  duration = 2000
) {
  const progress = useSharedValue(0);

  // Start the breathing animation
  const startBreathing = useCallback(() => {
    progress.value = withTiming(1, { duration }, () => {
      progress.value = withTiming(0, { duration }, () => {
        // Loop
        runOnJS(startBreathing)();
      });
    });
  }, [progress, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.5, 1],
          [minScale, maxScale, minScale]
        ),
      },
    ],
  }));

  return { animatedStyle, startBreathing };
}

/**
 * 3D tilt effect based on touch position
 */
export function use3DTilt(
  maxRotation = 8,
  perspective = 1000
) {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const gesture = useMemo(() =>
    Gesture.Pan()
      .onBegin(() => {
        'worklet';
        scale.value = withSpring(1.02, SPRING_CONFIGS.CARD_LIFT);
      })
      .onUpdate((event) => {
        'worklet';
        // Map touch position to rotation
        // Assuming card is roughly 300x400
        rotateY.value = interpolate(
          event.x,
          [0, 300],
          [-maxRotation, maxRotation],
          Extrapolation.CLAMP
        );
        rotateX.value = interpolate(
          event.y,
          [0, 400],
          [maxRotation, -maxRotation],
          Extrapolation.CLAMP
        );
      })
      .onEnd(() => {
        'worklet';
        rotateX.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
        rotateY.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
        scale.value = withSpring(1, SPRING_CONFIGS.BOUNCE_BACK);
      }),
  [maxRotation, rotateX, rotateY, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: scale.value },
    ],
  }));

  return { gesture, animatedStyle, rotateX, rotateY, scale };
}

/**
 * Staggered entrance for list items
 */
export function useStaggeredEntrance(
  index: number,
  delayMultiplier = STAGGER_DELAYS.NORMAL
) {
  const delay = index * delayMultiplier;

  return {
    entering: {
      delay,
      damping: SPRING_CONFIGS.GENTLE.damping,
      stiffness: SPRING_CONFIGS.GENTLE.stiffness,
    },
  };
}

/**
 * Swipe gesture with rotation for cards
 */
export function useSwipeGesture(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  onSwipeUp?: () => void,
  threshold = 120,
  velocityThreshold = 500
) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  const gesture = useMemo(() =>
    Gesture.Pan()
      .onUpdate((event) => {
        'worklet';
        translateX.value = event.translationX;
        translateY.value = event.translationY * 0.3; // Dampen Y

        // Rotation based on X translation
        rotation.value = interpolate(
          translateX.value,
          [-300, 0, 300],
          [-15, 0, 15],
          Extrapolation.CLAMP
        );

        // Scale up slightly when dragging
        scale.value = interpolate(
          Math.abs(translateX.value),
          [0, 100],
          [1, 1.02],
          Extrapolation.CLAMP
        );
      })
      .onEnd((event) => {
        'worklet';
        const shouldDismissX =
          Math.abs(event.velocityX) > velocityThreshold ||
          Math.abs(translateX.value) > threshold;

        const shouldDismissUp =
          onSwipeUp &&
          event.translationY < -threshold &&
          Math.abs(event.velocityY) > velocityThreshold * 0.5;

        if (shouldDismissUp) {
          // Swipe up - expand to profile
          runOnJS(onSwipeUp)();
          translateX.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          translateY.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          rotation.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          scale.value = withSpring(1, SPRING_CONFIGS.BOUNCE_BACK);
        } else if (shouldDismissX) {
          const direction = translateX.value > 0 ? 1 : -1;

          // Dismiss with velocity
          translateX.value = withSpring(
            direction * 500,
            { ...SPRING_CONFIGS.SWIPE_DISMISS, velocity: event.velocityX },
            () => {
              'worklet';
              if (direction > 0) {
                runOnJS(onSwipeRight)();
              } else {
                runOnJS(onSwipeLeft)();
              }
            }
          );
          rotation.value = withSpring(direction * 30, SPRING_CONFIGS.SWIPE_DISMISS);
          runOnJS(HapticPatterns.threshold)();
        } else {
          // Bounce back
          translateX.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          translateY.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          rotation.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          scale.value = withSpring(1, SPRING_CONFIGS.BOUNCE_BACK);
        }
      }),
  [translateX, translateY, rotation, scale, onSwipeLeft, onSwipeRight, onSwipeUp, threshold, velocityThreshold]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return {
    gesture,
    animatedStyle,
    translateX,
    translateY,
    rotation,
    scale,
  };
}

/**
 * Like indicator that appears during swipe
 */
export function useLikeIndicator(translateX: SharedValue<number>) {
  const likeOpacity = useDerivedValue(() =>
    interpolate(translateX.value, [0, 100], [0, 1], Extrapolation.CLAMP)
  );

  const passOpacity = useDerivedValue(() =>
    interpolate(translateX.value, [-100, 0], [1, 0], Extrapolation.CLAMP)
  );

  const likeStyle = useAnimatedStyle(() => ({
    opacity: likeOpacity.value,
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: passOpacity.value,
  }));

  return { likeStyle, passStyle };
}

/**
 * Shimmer effect for loading states and highlights
 */
export function useShimmer(duration = 1500) {
  const progress = useSharedValue(0);

  const startShimmer = useCallback(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration }, () => {
      'worklet';
      runOnJS(startShimmer)();
    });
  }, [progress, duration]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.5, 1],
      [0.3, 0.7, 0.3]
    ),
  }));

  return { shimmerStyle, startShimmer, progress };
}
