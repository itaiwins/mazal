/**
 * SwipeableCard Component
 *
 * A profile card with physics-based swipe gestures and 3D rotation.
 * Part of the "Constellation Dating" redesign.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { borderRadius, shadows, spacing } from '@/theme/spacing';
import { SPRING_CONFIGS, SWIPE_CONFIG, CARD_STACK_CONFIG } from '@/constants/animations';
import { HapticPatterns } from '@/utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Card dimensions
const CARD_WIDTH = SCREEN_WIDTH - spacing[8];
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

interface ProfilePhoto {
  id?: string;
  photo_url: string;
  photo_order?: number;
}

interface ProfilePrompt {
  prompt_id: string;
  question?: string;
  answer: string;
}

interface ProfileData {
  id: string;
  first_name: string;
  age: number;
  current_city?: string;
  current_state?: string;
  distance?: number;
  bio?: string;
  jewish_background?: string;
  observance_level?: string;
  occupation?: string;
  is_verified?: boolean;
  photos: ProfilePhoto[];
  prompts: ProfilePrompt[];
}

interface SwipeableCardProps {
  profile: ProfileData;
  index: number;
  totalCards: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onTap: () => void;
  isActive: boolean;
}

export function SwipeableCard({
  profile,
  index,
  totalCards,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onTap,
  isActive,
}: SwipeableCardProps) {
  // Animation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const hasTriggeredHaptic = useSharedValue(false);
  const isDragging = useSharedValue(false); // Track if actively dragging

  // Calculate position in stack
  const stackIndex = Math.min(index, CARD_STACK_CONFIG.VISIBLE_CARDS - 1);
  const baseScale = CARD_STACK_CONFIG.SCALES[stackIndex] ?? 0.85;
  const baseYOffset = CARD_STACK_CONFIG.Y_OFFSETS[stackIndex] ?? -16;
  const baseOpacity = CARD_STACK_CONFIG.OPACITIES[stackIndex] ?? 0.6;

  // Get primary photo
  const primaryPhoto = useMemo(() => {
    if (!profile.photos || profile.photos.length === 0) return null;
    const primary = profile.photos.find((p) => p.photo_order === 0) || profile.photos[0];
    return primary.photo_url;
  }, [profile.photos]);

  // Get first prompt snippet
  const promptSnippet = useMemo(() => {
    if (!profile.prompts || profile.prompts.length === 0) return null;
    const prompt = profile.prompts[0];
    return prompt.answer.length > 60
      ? prompt.answer.substring(0, 60) + '...'
      : prompt.answer;
  }, [profile.prompts]);

  // Location string
  const locationString = useMemo(() => {
    const parts = [profile.current_city, profile.current_state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [profile.current_city, profile.current_state]);

  // Pan gesture for swiping
  const panGesture = useMemo(() =>
    Gesture.Pan()
      .enabled(isActive)
      .onStart(() => {
        'worklet';
        isDragging.value = true;
      })
      .onUpdate((event) => {
        'worklet';
        translateX.value = event.translationX;
        translateY.value = event.translationY * SWIPE_CONFIG.Y_DAMPING;

        // Rotation based on X translation
        rotation.value = interpolate(
          translateX.value,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-SWIPE_CONFIG.MAX_ROTATION, 0, SWIPE_CONFIG.MAX_ROTATION],
          Extrapolation.CLAMP
        );

        // Scale up slightly when dragging
        scale.value = interpolate(
          Math.abs(translateX.value),
          [0, 100],
          [1, 1.02],
          Extrapolation.CLAMP
        );

        // Haptic feedback at threshold
        const threshold = SWIPE_CONFIG.THRESHOLD * 0.8;
        if (Math.abs(translateX.value) > threshold && !hasTriggeredHaptic.value) {
          hasTriggeredHaptic.value = true;
          runOnJS(HapticPatterns.threshold)();
        } else if (Math.abs(translateX.value) < threshold && hasTriggeredHaptic.value) {
          hasTriggeredHaptic.value = false;
        }
      })
      .onEnd((event) => {
        'worklet';
        hasTriggeredHaptic.value = false;
        isDragging.value = false;

        const shouldDismissX =
          Math.abs(event.velocityX) > SWIPE_CONFIG.VELOCITY_THRESHOLD ||
          Math.abs(translateX.value) > SWIPE_CONFIG.THRESHOLD;

        const shouldDismissUp =
          event.translationY < -SWIPE_CONFIG.THRESHOLD &&
          Math.abs(event.velocityY) > SWIPE_CONFIG.VELOCITY_THRESHOLD * 0.5;

        if (shouldDismissUp) {
          // Swipe up - expand to profile
          runOnJS(onSwipeUp)();
          translateX.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          translateY.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          rotation.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          scale.value = withSpring(1, SPRING_CONFIGS.BOUNCE_BACK);
        } else if (shouldDismissX) {
          const direction = translateX.value > 0 ? 1 : -1;
          const isLike = direction > 0;

          // Trigger appropriate haptic
          if (isLike) {
            runOnJS(HapticPatterns.like)();
          } else {
            runOnJS(HapticPatterns.pass)();
          }

          // Dismiss with velocity
          translateX.value = withSpring(
            direction * SCREEN_WIDTH * 1.5,
            { ...SPRING_CONFIGS.SWIPE_DISMISS, velocity: event.velocityX },
            (finished) => {
              'worklet';
              if (finished) {
                if (isLike) {
                  runOnJS(onSwipeRight)();
                } else {
                  runOnJS(onSwipeLeft)();
                }
              }
            }
          );
          rotation.value = withSpring(direction * 30, SPRING_CONFIGS.SWIPE_DISMISS);
        } else {
          // Bounce back
          translateX.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          translateY.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          rotation.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
          scale.value = withSpring(1, SPRING_CONFIGS.BOUNCE_BACK);
        }
      }),
  [isActive, translateX, translateY, rotation, scale, hasTriggeredHaptic, onSwipeLeft, onSwipeRight, onSwipeUp]);

  // Tap gesture
  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .enabled(isActive)
      .onEnd(() => {
        'worklet';
        runOnJS(HapticPatterns.tap)();
        runOnJS(onTap)();
      }),
  [isActive, onTap]);

  // Combine gestures
  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // Animated styles
  const cardStyle = useAnimatedStyle(() => {
    // For non-active cards, show them stacked behind with full opacity
    // to prevent blending - just use scale and position to create depth
    if (!isActive) {
      return {
        transform: [
          { scale: baseScale },
          { translateY: baseYOffset },
        ],
        opacity: 1, // Full opacity to prevent blending
        zIndex: totalCards - index,
      };
    }

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
      opacity: 1,
      zIndex: totalCards,
    };
  });

  // Like/Pass indicator styles - only show when actively dragging
  const likeIndicatorStyle = useAnimatedStyle(() => {
    // Only show when actively dragging right past threshold
    if (!isDragging.value || translateX.value <= 30) {
      return { opacity: 0, transform: [{ scale: 0.5 }] };
    }
    return {
      opacity: interpolate(translateX.value, [30, 100], [0, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(translateX.value, [30, 100], [0.5, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const passIndicatorStyle = useAnimatedStyle(() => {
    // Only show when actively dragging left past threshold
    if (!isDragging.value || translateX.value >= -30) {
      return { opacity: 0, transform: [{ scale: 0.5 }] };
    }
    return {
      opacity: interpolate(translateX.value, [-100, -30], [1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(translateX.value, [-100, -30], [1, 0.5], Extrapolation.CLAMP) },
      ],
    };
  });

  // Shadow style that intensifies on drag
  const shadowStyle = useAnimatedStyle(() => {
    const shadowIntensity = interpolate(
      Math.abs(translateX.value),
      [0, 100],
      [0.15, 0.3],
      Extrapolation.CLAMP
    );
    return {
      shadowOpacity: shadowIntensity,
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, cardStyle, shadowStyle]}>
        {/* Card Background */}
        <View style={styles.card}>
          {/* Profile Photo */}
          {primaryPhoto ? (
            <Image source={{ uri: primaryPhoto }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.placeholderPhoto]}>
              <Ionicons name="person" size={64} color={colors.neutral[600]} />
            </View>
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
            locations={[0, 0.4, 0.7, 1]}
            style={styles.gradient}
          />

          {/* Like Indicator */}
          <Animated.View style={[styles.likeIndicator, likeIndicatorStyle]}>
            <Text style={styles.indicatorText}>LIKE</Text>
          </Animated.View>

          {/* Pass Indicator */}
          <Animated.View style={[styles.passIndicator, passIndicatorStyle]}>
            <Text style={[styles.indicatorText, styles.passText]}>NOPE</Text>
          </Animated.View>

          {/* Profile Info */}
          <View style={styles.infoContainer}>
            {/* Name and Age */}
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {profile.first_name}
                <Text style={styles.age}>, {profile.age}</Text>
              </Text>
              {profile.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.semantic.info} />
                </View>
              )}
            </View>

            {/* Location and Distance */}
            {/* `distance` is a number, so it needs a ternary and not `&&` (MEXA-336) */}
            {locationString || profile.distance !== undefined ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={colors.transparent.white70} />
                <Text style={styles.locationText}>
                  {locationString}
                  {profile.distance !== undefined ? ` • ${Math.round(profile.distance)} mi` : null}
                </Text>
              </View>
            ) : null}

            {/* Jewish Background Badge */}
            {profile.jewish_background && (
              <View style={styles.badgeRow}>
                <View style={styles.backgroundBadge}>
                  <Text style={styles.badgeText}>{profile.jewish_background}</Text>
                </View>
                {profile.observance_level && (
                  <View style={styles.backgroundBadge}>
                    <Text style={styles.badgeText}>{profile.observance_level}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Prompt Snippet */}
            {promptSnippet && (
              <View style={styles.promptSnippet}>
                <Text style={styles.promptText} numberOfLines={2}>
                  "{promptSnippet}"
                </Text>
              </View>
            )}

            {/* Photo Dots */}
            {profile.photos.length > 1 && (
              <View style={styles.photoDots}>
                {profile.photos.slice(0, 5).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.photoDot, i === 0 && styles.photoDotActive]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Swipe Up Hint */}
          {isActive && (
            <View style={styles.swipeUpHint}>
              <Ionicons name="chevron-up" size={20} color={colors.transparent.white50} />
              <Text style={styles.swipeUpText}>Swipe up to see full profile</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    shadowColor: colors.primary.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.dark.card,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  placeholderPhoto: {
    backgroundColor: colors.dark.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  likeIndicator: {
    position: 'absolute',
    top: spacing[6],
    left: spacing[4],
    borderWidth: 4,
    borderColor: '#4CAF50',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    transform: [{ rotate: '-15deg' }],
  },
  passIndicator: {
    position: 'absolute',
    top: spacing[6],
    right: spacing[4],
    borderWidth: 4,
    borderColor: '#FF6B6B',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    transform: [{ rotate: '15deg' }],
  },
  indicatorText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4CAF50',
    letterSpacing: 2,
  },
  passText: {
    color: '#FF6B6B',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[5],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  age: {
    fontWeight: '400',
  },
  verifiedBadge: {
    marginLeft: spacing[1],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  locationText: {
    fontSize: 15,
    color: colors.transparent.white70,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  backgroundBadge: {
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  promptSnippet: {
    marginTop: spacing[3],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
  },
  promptText: {
    fontSize: 14,
    color: colors.transparent.white80,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  photoDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[1.5],
    marginTop: spacing[4],
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.transparent.white30,
  },
  photoDotActive: {
    backgroundColor: colors.primary.gold,
    width: 20,
  },
  swipeUpHint: {
    position: 'absolute',
    top: spacing[4],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.transparent.black50,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  swipeUpText: {
    fontSize: 12,
    color: colors.transparent.white50,
  },
});

export { CARD_WIDTH, CARD_HEIGHT };
export type { ProfileData };
