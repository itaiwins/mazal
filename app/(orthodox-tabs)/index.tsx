/**
 * Orthodox Discover Screen
 *
 * Browse Orthodox singles with elegant styling
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - spacing[8];
const CARD_HEIGHT = height * 0.6;
const SWIPE_THRESHOLD = width * 0.3;

interface Profile {
  id: string;
  first_name: string;
  age: number;
  jewish_background: string;
  bio: string;
  occupation: string;
  photo_url: string | null;
}

// Animated Header with Star of David
function OrthodoxHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.starOfDavid}>✡</Text>
        <View>
          <Text style={styles.headerTitle}>Shidduch</Text>
          <Text style={styles.headerSubtitle}>Orthodox Matching</Text>
        </View>
      </View>
      <Pressable style={styles.filterButton}>
        <Ionicons name="options-outline" size={24} color={colors.primary.gold} />
      </Pressable>
    </View>
  );
}

// Profile Card Component
function ProfileCard({
  profile,
  isFirst,
  onSwipeLeft,
  onSwipeRight,
}: {
  profile: Profile;
  isFirst: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(isFirst ? 1 : 0.95);

  useEffect(() => {
    scale.value = withSpring(isFirst ? 1 : 0.95);
  }, [isFirst]);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (!isFirst) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3;
      rotation.value = event.translationX * 0.1;
    })
    .onEnd((event) => {
      if (!isFirst) return;

      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(width * 1.5, { duration: 300 });
        runOnJS(onSwipeRight)();
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-width * 1.5, { duration: 300 });
        runOnJS(onSwipeLeft)();
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {profile.photo_url ? (
          <Image
            source={{ uri: profile.photo_url }}
            style={styles.cardImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="person" size={80} color={colors.neutral[400]} />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(10, 22, 40, 0.8)', 'rgba(10, 22, 40, 0.95)']}
          style={styles.cardGradient}
        >
          <View style={styles.cardContent}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{profile.first_name}, {profile.age}</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✡</Text>
              </View>
            </View>

            {profile.jewish_background && (
              <View style={styles.backgroundBadge}>
                <Text style={styles.backgroundBadgeText}>
                  {profile.jewish_background.replace(/_/g, ' ')}
                </Text>
              </View>
            )}

            {profile.occupation && (
              <Text style={styles.cardOccupation}>{profile.occupation}</Text>
            )}

            {profile.bio && (
              <Text style={styles.cardBio} numberOfLines={2}>
                {profile.bio}
              </Text>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </GestureDetector>
  );
}

export default function OrthodoxDiscoverScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch Orthodox profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user?.id) return;

      try {
        // Note: is_orthodox_user column added via migration
        const { data, error } = await (supabase as any)
          .from('users')
          .select(`
            id,
            first_name,
            date_of_birth,
            jewish_background,
            bio,
            occupation,
            photos:user_photos(photo_url, photo_order)
          `)
          .eq('is_orthodox_user', true)
          .eq('is_active', true)
          .neq('id', user.id)
          .limit(20);

        if (error) throw error;

        const formattedProfiles = (data || []).map((profile: any) => {
          const primaryPhoto = profile.photos?.find((p: any) => p.photo_order === 0) ||
                              profile.photos?.[0];

          return {
            id: profile.id,
            first_name: profile.first_name || 'Anonymous',
            age: profile.date_of_birth
              ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
              : 0,
            jewish_background: profile.jewish_background || '',
            bio: profile.bio || '',
            occupation: profile.occupation || '',
            photo_url: primaryPhoto?.photo_url || null,
          };
        });

        setProfiles(formattedProfiles);
      } catch (error) {
        console.error('Error fetching profiles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, [user?.id]);

  const handleSwipeLeft = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSwipeRight = async () => {
    const likedProfile = profiles[currentIndex];
    if (likedProfile && user?.id) {
      // Record the like
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        swiped_id: likedProfile.id,
        action: 'like',
      });
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handleButtonSwipe = (isLike: boolean) => {
    if (isLike) {
      handleSwipeRight();
    } else {
      handleSwipeLeft();
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LinearGradient
          colors={['#0a1628', '#0f1d36', '#1a2d52']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={colors.primary.gold} />
        <Text style={styles.loadingText}>Finding matches...</Text>
      </View>
    );
  }

  const visibleProfiles = profiles.slice(currentIndex, currentIndex + 2);

  return (
    <GestureHandlerRootView style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top }]}>
        <OrthodoxHeader />

        {visibleProfiles.length > 0 ? (
          <>
            <View style={styles.cardsContainer}>
              {visibleProfiles.map((profile, index) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isFirst={index === 0}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                />
              )).reverse()}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.actionButton, styles.passButton]}
                onPress={() => handleButtonSwipe(false)}
              >
                <Ionicons name="close" size={32} color="#ff6b6b" />
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.superLikeButton]}
                onPress={() => {/* Super like */}}
              >
                <Text style={styles.superLikeIcon}>✡</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.likeButton]}
                onPress={() => handleButtonSwipe(true)}
              >
                <Ionicons name="heart" size={32} color={colors.primary.gold} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✡</Text>
            <Text style={styles.emptyStateTitle}>No More Profiles</Text>
            <Text style={styles.emptyStateText}>
              Check back later for new matches in your community
            </Text>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  starOfDavid: {
    fontSize: 32,
    color: colors.primary.gold,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.primary.gold,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#1a2d52',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a2d52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: spacing[5],
  },
  cardContent: {
    gap: spacing[2],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  cardName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  verifiedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadgeText: {
    fontSize: 16,
    color: colors.primary.navy,
  },
  backgroundBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  backgroundBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.gold,
    textTransform: 'capitalize',
  },
  cardOccupation: {
    fontSize: 16,
    color: colors.transparent.white80,
  },
  cardBio: {
    fontSize: 14,
    color: colors.transparent.white60,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[5],
    paddingVertical: spacing[4],
    paddingBottom: spacing[6],
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  passButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.5)',
  },
  superLikeButton: {
    backgroundColor: colors.primary.gold,
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  superLikeIcon: {
    fontSize: 32,
    color: colors.primary.navy,
  },
  likeButton: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.transparent.white60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  emptyStateIcon: {
    fontSize: 64,
    color: colors.primary.gold,
    marginBottom: spacing[4],
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.transparent.white60,
    textAlign: 'center',
  },
});
