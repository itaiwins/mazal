/**
 * NewMatchCarousel Component
 *
 * Horizontal scroll carousel for new matches with golden thread overlay.
 * Features animated gold rings, sparkle effects on new matches,
 * and spring-based press animations.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeInRight,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { SPRING_CONFIGS } from '@/constants/animations';
import { GoldenThread } from './GoldenThread';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_SIZE = 72;
const AVATAR_SPACING = 90;

interface NewMatch {
  id: string;
  name: string;
  photo: string;
  matchedAt: Date;
  isNew?: boolean;
}

interface NewMatchCarouselProps {
  matches: NewMatch[];
  onMatchPress: (match: NewMatch) => void;
}

// Individual match avatar with animations
function MatchAvatar({
  match,
  index,
  onPress,
}: {
  match: NewMatch;
  index: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.8);

  // Pulsing ring animation for new matches
  useEffect(() => {
    if (match.isNew) {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1,
        true
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1200 }),
          withTiming(0.8, { duration: 1200 })
        ),
        -1,
        true
      );
    }
  }, [match.isNew]);

  const handlePressIn = () => {
    scale.value = withSpring(0.92, SPRING_CONFIGS.QUICK);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIGS.QUICK);
  };

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100).springify()}
      style={styles.matchItem}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Animated.View style={[styles.avatarContainer, avatarStyle]}>
          {/* Animated gold ring */}
          <Animated.View style={[styles.goldRing, ringStyle]} />

          {/* Avatar */}
          <Image
            source={{ uri: match.photo }}
            style={styles.avatar}
            contentFit="cover"
          />

          {/* NEW badge */}
          {match.isNew && (
            <View style={styles.newBadge}>
              <LinearGradient
                colors={[colors.primary.gold, '#DAA520']}
                style={styles.newBadgeGradient}
              >
                <Text style={styles.newBadgeText}>NEW</Text>
              </LinearGradient>
            </View>
          )}

          {/* Star sparkle for new matches */}
          {match.isNew && (
            <Animated.View style={styles.sparkle}>
              <Text style={styles.sparkleIcon}>✦</Text>
            </Animated.View>
          )}
        </Animated.View>

        <Text style={styles.matchName} numberOfLines={1}>
          {match.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function NewMatchCarousel({ matches, onMatchPress }: NewMatchCarouselProps) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>New Matches</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{matches.length}</Text>
        </View>
      </Animated.View>

      {/* Carousel with golden thread */}
      <View style={styles.carouselContainer}>
        {/* Golden thread connecting avatars */}
        <GoldenThread
          pointCount={matches.length}
          pointSpacing={AVATAR_SPACING}
          startX={50}
          yPosition={AVATAR_SIZE / 2 + 8}
          height={AVATAR_SIZE + 40}
        />

        {/* Scrollable avatars */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
        >
          {matches.map((match, index) => (
            <MatchAvatar
              key={match.id}
              match={match}
              index={index}
              onPress={() => onMatchPress(match)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.white,
  },
  headerBadge: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  carouselContainer: {
    position: 'relative',
    height: AVATAR_SIZE + 50,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  matchItem: {
    width: AVATAR_SPACING,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldRing: {
    position: 'absolute',
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.dark.background,
  },
  newBadge: {
    position: 'absolute',
    bottom: -4,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  newBadgeGradient: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary.navy,
    letterSpacing: 0.5,
  },
  sparkle: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  sparkleIcon: {
    fontSize: 16,
    color: colors.primary.gold,
    textShadowColor: colors.primary.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  matchName: {
    marginTop: spacing[2],
    fontSize: 12,
    fontWeight: '600',
    color: colors.transparent.white80,
    textAlign: 'center',
    width: AVATAR_SIZE + 10,
  },
});

export default NewMatchCarousel;
