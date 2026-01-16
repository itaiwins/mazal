/**
 * CardStack Component
 *
 * Manages the stack of swipeable profile cards.
 * Shows 3 cards at a time with depth/scale for premium feel.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { SPRING_CONFIGS, CARD_STACK_CONFIG } from '@/constants/animations';
import { SwipeableCard, CARD_HEIGHT, ProfileData } from './SwipeableCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CardStackProps {
  profiles: ProfileData[];
  currentIndex: number;
  onSwipeLeft: (profile: ProfileData) => void;
  onSwipeRight: (profile: ProfileData) => void;
  onSwipeUp: (profile: ProfileData) => void;
  onTap: (profile: ProfileData) => void;
  onCardAdvance: () => void;
}

export function CardStack({
  profiles,
  currentIndex,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onTap,
  onCardAdvance,
}: CardStackProps) {
  // Get visible cards (current + next 2)
  const visibleCards = useMemo(() => {
    return profiles.slice(currentIndex, currentIndex + CARD_STACK_CONFIG.VISIBLE_CARDS);
  }, [profiles, currentIndex]);

  // Handle swipe actions
  const handleSwipeLeft = useCallback((profile: ProfileData) => {
    onSwipeLeft(profile);
    onCardAdvance();
  }, [onSwipeLeft, onCardAdvance]);

  const handleSwipeRight = useCallback((profile: ProfileData) => {
    onSwipeRight(profile);
    onCardAdvance();
  }, [onSwipeRight, onCardAdvance]);

  const handleSwipeUp = useCallback((profile: ProfileData) => {
    onSwipeUp(profile);
  }, [onSwipeUp]);

  const handleTap = useCallback((profile: ProfileData) => {
    onTap(profile);
  }, [onTap]);

  return (
    <View style={styles.container}>
      {/* Background ambient glow */}
      <View style={styles.ambientGlow} />

      {/* Cards - render in reverse order so first card is on top */}
      {visibleCards.map((profile, arrayIndex) => {
        // The actual index in the stack (0 = front, 1 = middle, 2 = back)
        const stackPosition = arrayIndex;
        const isActive = stackPosition === 0;

        return (
          <SwipeableCard
            key={profile.id}
            profile={profile}
            index={stackPosition}
            totalCards={visibleCards.length}
            onSwipeLeft={() => handleSwipeLeft(profile)}
            onSwipeRight={() => handleSwipeRight(profile)}
            onSwipeUp={() => handleSwipeUp(profile)}
            onTap={() => handleTap(profile)}
            isActive={isActive}
          />
        );
      }).reverse()}
    </View>
  );
}

/**
 * CardStackWrapper - Adds entry animation and handles empty state
 */
interface CardStackWrapperProps extends CardStackProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  onRefresh?: () => void;
}

export function CardStackWrapper({
  profiles,
  currentIndex,
  isLoading,
  isEmpty,
  onRefresh,
  ...props
}: CardStackWrapperProps) {
  const hasCards = profiles.length > currentIndex;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingCards />
        </View>
      </View>
    );
  }

  if (isEmpty || !hasCards) {
    return null; // Parent component handles empty state
  }

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={styles.wrapper}
    >
      <CardStack
        profiles={profiles}
        currentIndex={currentIndex}
        {...props}
      />
    </Animated.View>
  );
}

/**
 * Loading skeleton cards
 */
function LoadingCards() {
  return (
    <View style={styles.loadingStack}>
      {[2, 1, 0].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.loadingCard,
            {
              transform: [
                { scale: CARD_STACK_CONFIG.SCALES[i] ?? 0.85 },
                { translateY: CARD_STACK_CONFIG.Y_OFFSETS[i] ?? -16 },
              ],
              opacity: CARD_STACK_CONFIG.OPACITIES[i] ?? 0.6,
              zIndex: 3 - i,
            },
          ]}
        >
          <SkeletonPulse />
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * Skeleton pulse animation
 */
function SkeletonPulse() {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    const animate = () => {
      opacity.value = withTiming(0.6, { duration: 800 }, () => {
        opacity.value = withTiming(0.3, { duration: 800 }, () => {
          animate();
        });
      });
    };
    animate();
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.skeleton, animatedStyle]}>
      {/* Photo area skeleton */}
      <View style={styles.skeletonPhoto} />

      {/* Content skeleton */}
      <View style={styles.skeletonContent}>
        <View style={styles.skeletonName} />
        <View style={styles.skeletonLocation} />
        <View style={styles.skeletonBadges}>
          <View style={styles.skeletonBadge} />
          <View style={styles.skeletonBadge} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing[4],
  },
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  ambientGlow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.1,
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH * 0.4,
    backgroundColor: colors.primary.gold,
    opacity: 0.03,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingStack: {
    width: SCREEN_WIDTH - spacing[8],
    height: CARD_HEIGHT,
    alignItems: 'center',
  },
  loadingCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.dark.card,
  },
  skeleton: {
    flex: 1,
  },
  skeletonPhoto: {
    flex: 1,
    backgroundColor: colors.dark.elevated,
  },
  skeletonContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[5],
  },
  skeletonName: {
    width: 150,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.transparent.white10,
  },
  skeletonLocation: {
    width: 100,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.transparent.white10,
    marginTop: spacing[2],
  },
  skeletonBadges: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  skeletonBadge: {
    width: 80,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.transparent.white10,
  },
});

export default CardStack;
