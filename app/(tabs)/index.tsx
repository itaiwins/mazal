/**
 * Discovery Screen
 *
 * Profile Story experience - scroll through full profiles and engage with content
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator, Modal, ScrollView, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useMatchStore } from '@/stores/matchStore';
import { useUIStore } from '@/stores/uiStore';
import { useDiscoveryStore } from '@/stores/discoveryStore';
import { useAuthStore } from '@/stores/authStore';
import { usePremiumStore } from '@/stores/premiumStore';
import { useSuperLikes, useSwipeLimits } from '@/features/premium/hooks/usePremium';
import { useDiscoveryProfiles } from '@/api/queries';
import { useSwipe } from '@/api/mutations';
import { useMatchesSubscription } from '@/api/realtime';
import { StarOfDavid } from '@/components/icons/StarOfDavid';
import { ProfileStory } from '@/components/discovery';
import { AdBanner, useInterstitialAd } from '@/components/ads';
import { AnimatedHeader } from '@/components/ui/AnimatedHeader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Match Celebration Component
function MatchCelebration({
  match,
  onClose,
  onSendMessage
}: {
  match: any;
  onClose: () => void;
  onSendMessage: () => void;
}) {
  const celebrationScale = useSharedValue(0);
  const celebrationOpacity = useSharedValue(0);
  const starRotation = useSharedValue(0);
  const photoScale = useSharedValue(0);

  useEffect(() => {
    celebrationOpacity.value = withTiming(1, { duration: 300 });
    celebrationScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    photoScale.value = withSpring(1, { damping: 10, stiffness: 80 });
    starRotation.value = withTiming(360, { duration: 2000 });

    const interval = setInterval(() => {
      starRotation.value = withTiming(starRotation.value + 360, { duration: 3000 });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: celebrationOpacity.value,
    transform: [{ scale: celebrationScale.value }],
  }));

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: photoScale.value }],
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${starRotation.value}deg` }],
  }));

  return (
    <Modal visible={true} transparent animationType="none">
      <Animated.View style={[celebrationStyles.overlay, containerStyle]}>
        <LinearGradient
          colors={['rgba(20, 35, 75, 0.98)', 'rgba(10, 20, 50, 0.98)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={celebrationStyles.starsBackground}>
          {[...Array(12)].map((_, i) => (
            <View
              key={i}
              style={[
                celebrationStyles.backgroundStar,
                {
                  top: `${10 + Math.random() * 80}%`,
                  left: `${5 + Math.random() * 90}%`,
                  opacity: 0.3 + Math.random() * 0.4,
                }
              ]}
            >
              <StarOfDavid size={16 + Math.random() * 24} color={colors.primary.gold} />
            </View>
          ))}
        </View>

        <View style={celebrationStyles.content}>
          <Animated.View style={starStyle}>
            <StarOfDavid size={80} color={colors.primary.gold} />
          </Animated.View>

          <Text style={celebrationStyles.mazalText}>Mazal Tov!</Text>
          <Text style={celebrationStyles.subtitle}>It's a Match</Text>

          <Animated.View style={[celebrationStyles.photoContainer, photoStyle]}>
            <View style={celebrationStyles.photoGlow} />
            <Image
              source={{ uri: match?.other_user?.primary_photo_url || 'https://via.placeholder.com/150' }}
              style={celebrationStyles.photo}
            />
          </Animated.View>

          <Text style={celebrationStyles.matchName}>
            You and {match?.other_user?.first_name || 'Someone special'}
          </Text>
          <Text style={celebrationStyles.matchHint}>
            The stars have aligned
          </Text>
        </View>

        <View style={celebrationStyles.actions}>
          <Pressable style={celebrationStyles.messageButton} onPress={onSendMessage}>
            <LinearGradient
              colors={[colors.primary.gold, '#B8860B']}
              style={celebrationStyles.buttonGradient}
            >
              <Ionicons name="chatbubble" size={20} color={colors.primary.navy} />
              <Text style={celebrationStyles.messageButtonText}>Send a Message</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={celebrationStyles.keepSwipingButton} onPress={onClose}>
            <Text style={celebrationStyles.keepSwipingText}>Keep Browsing</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

// Discovery mode tabs
type DiscoveryMode = 'profiles' | 'saftas';

// Safta type for discovery
type SaftaItem = {
  id: string;
  name: string;
  photo: string;
  relationship: string;
  matchesCreated: number;
  followers: number;
  bio: string;
  isVerified: boolean;
  isFollowing: boolean;
};

// Safta Card Component
function SaftaCard({
  safta,
  onFollow,
  onMessage,
}: {
  safta: SaftaItem;
  onFollow: () => void;
  onMessage: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[saftaStyles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={saftaStyles.cardHeader}>
        <Image source={{ uri: safta.photo }} style={saftaStyles.avatar} />
        <View style={saftaStyles.headerInfo}>
          <View style={saftaStyles.nameRow}>
            <Text style={[saftaStyles.name, { color: theme.colors.text }]}>{safta.name}</Text>
            {safta.isVerified && (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary.gold} />
            )}
          </View>
          <View style={saftaStyles.relationshipBadge}>
            <Text style={saftaStyles.relationshipText}>{safta.relationship}</Text>
          </View>
        </View>
      </View>

      <Text style={[saftaStyles.bio, { color: theme.colors.textSecondary }]} numberOfLines={2}>
        {safta.bio}
      </Text>

      <View style={saftaStyles.stats}>
        <View style={saftaStyles.stat}>
          <Text style={[saftaStyles.statNumber, { color: theme.colors.text }]}>{safta.matchesCreated}</Text>
          <Text style={[saftaStyles.statLabel, { color: theme.colors.textSecondary }]}>Matches</Text>
        </View>
        <View style={saftaStyles.statDivider} />
        <View style={saftaStyles.stat}>
          <Text style={[saftaStyles.statNumber, { color: theme.colors.text }]}>{safta.followers}</Text>
          <Text style={[saftaStyles.statLabel, { color: theme.colors.textSecondary }]}>Followers</Text>
        </View>
      </View>

      <View style={saftaStyles.actions}>
        <Pressable
          style={[saftaStyles.followButton, safta.isFollowing && saftaStyles.followingButton]}
          onPress={onFollow}
        >
          <Ionicons
            name={safta.isFollowing ? 'checkmark' : 'add'}
            size={18}
            color={safta.isFollowing ? colors.primary.gold : colors.primary.white}
          />
          <Text style={[saftaStyles.followButtonText, safta.isFollowing && saftaStyles.followingButtonText]}>
            {safta.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
        <Pressable style={saftaStyles.messageButton} onPress={onMessage}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.primary.gold} />
        </Pressable>
      </View>
    </View>
  );
}

export default function DiscoveryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Match state
  const showMatchCelebration = useMatchStore((s) => s.showMatchCelebration);
  const newMatch = useMatchStore((s) => s.newMatch);
  const hideCelebration = useMatchStore((s) => s.hideCelebration);
  const showCelebration = useMatchStore((s) => s.showCelebration);

  // Premium state and hooks
  const showPaywallModal = usePremiumStore((s) => s.showPaywallModal);
  const { remaining: superLikesRemaining, canUseSuperLike, useSuperLike } = useSuperLikes();
  const { canSwipe, useSwipe: useSwipeLimit, isUnlimited, remaining: swipesRemaining, checkAndResetLimits } = useSwipeLimits();

  // Interstitial ads - tracks swipes and shows ad every 10 swipes
  const { trackSwipe } = useInterstitialAd();

  // Check and reset limits on mount
  useEffect(() => {
    checkAndResetLimits();
  }, []);

  // Orthodox mode
  const isOrthodoxMode = useUIStore((s) => s.isOrthodoxMode);
  const hasOrthodoxSubscription = useUIStore((s) => s.hasOrthodoxSubscription);

  // User profile for gender preference sync
  const user = useAuthStore((s) => s.user);
  const setFilters = useDiscoveryStore((s) => s.setFilters);
  const filters = useDiscoveryStore((s) => s.filters);

  // Sync user's gender preference to discovery filters on mount
  useEffect(() => {
    if (user?.gender_preference && user.gender_preference.length > 0) {
      // Only sync if discovery filters are empty (default)
      if (filters.gender_preference.length === 0) {
        console.log('[Discovery] Syncing gender preference from user profile:', user.gender_preference);
        setFilters({ gender_preference: user.gender_preference });
      }
    }
  }, [user?.gender_preference]);

  // Discovery mode
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('profiles');
  // Saftas - empty until feature is implemented with real data from Supabase
  const [saftas, setSaftas] = useState<SaftaItem[]>([]);

  // API queries
  const { data: apiProfiles, isLoading, refetch } = useDiscoveryProfiles();
  const swipeMutation = useSwipe();

  // Subscribe to matches
  useMatchesSubscription(() => {});

  // Use API profiles only - no demo data fallback for authenticated users
  const profiles = useMemo(() => {
    if (apiProfiles && apiProfiles.length > 0) {
      return apiProfiles.map((p: any) => ({
        ...p,
        photos: p.photos || [],
        prompts: p.prompts || [],
      }));
    }
    // Return empty array - don't show sample/fake profiles to real users
    return [];
  }, [apiProfiles]);

  const currentProfile = profiles[currentIndex];
  const hasMoreProfiles = currentIndex < profiles.length;

  // Helper to get primary photo URL
  const getPhotoUrl = useCallback((profile: any) => {
    if (!profile?.photos?.length) return null;
    const primary = profile.photos.find((p: any) => p.photo_order === 0) || profile.photos[0];
    return typeof primary === 'string' ? primary : primary?.photo_url;
  }, []);

  // Handle pass
  const handlePass = useCallback(() => {
    if (!currentProfile || isTransitioning) return;

    // Check swipe limit for non-premium users
    if (!canSwipe) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showPaywallModal(
        'You\'ve used all your daily swipes! Upgrade to Mazal Gold for unlimited swipes.',
        'gold'
      );
      return;
    }

    // Use a swipe from the limit
    if (!isUnlimited) {
      useSwipeLimit();
    }

    setIsTransitioning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    swipeMutation.mutate(
      { swipedUserId: currentProfile.id, action: 'pass' },
      {
        onSettled: () => {
          // Move to next profile after swipe completes
          setCurrentIndex((prev) => prev + 1);
          setIsTransitioning(false);
          // Track swipe for interstitial ads
          trackSwipe();
        },
      }
    );
  }, [currentProfile, swipeMutation, isTransitioning, canSwipe, isUnlimited, useSwipeLimit, showPaywallModal, trackSwipe]);

  // Handle like
  const handleLike = useCallback((likedContent: any[]) => {
    if (!currentProfile || isTransitioning) return;

    // Check if this is a super like (has message)
    const isSuperLike = likedContent.some((l) => l.type === 'prompt' && l.message);

    // Check super like availability for super likes
    if (isSuperLike) {
      if (!canUseSuperLike) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showPaywallModal(
          `You've used all your Super Likes this week! Upgrade to get 5 Super Likes per week.`,
          'gold'
        );
        return;
      }
      useSuperLike();
    } else {
      // Regular like - check swipe limit
      if (!canSwipe) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showPaywallModal(
          'You\'ve used all your daily swipes! Upgrade to Mazal Gold for unlimited swipes.',
          'gold'
        );
        return;
      }
      if (!isUnlimited) {
        useSwipeLimit();
      }
    }

    setIsTransitioning(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const action = isSuperLike ? 'super_like' : 'like';

    swipeMutation.mutate(
      { swipedUserId: currentProfile.id, action },
      {
        onSuccess: (result) => {
          if (result.isMatch) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showCelebration({
              id: result.matchId || `match-${currentProfile.id}`,
              created_at: new Date().toISOString(),
              other_user: {
                id: currentProfile.id,
                first_name: currentProfile.first_name,
                display_name: currentProfile.first_name,
                primary_photo_url: getPhotoUrl(currentProfile),
              },
              unread_count: 0,
            });
          }
        },
        onSettled: () => {
          // Move to next profile after swipe completes
          setCurrentIndex((prev) => prev + 1);
          setIsTransitioning(false);
          // Track swipe for interstitial ads
          trackSwipe();
        },
      }
    );
  }, [currentProfile, swipeMutation, showCelebration, getPhotoUrl, isTransitioning, canSwipe, canUseSuperLike, isUnlimited, useSwipeLimit, useSuperLike, showPaywallModal, trackSwipe]);

  // Handle super like (Bashert)
  const handleSuperLike = useCallback(() => {
    if (!currentProfile || isTransitioning) return;

    // Check super like availability
    if (!canUseSuperLike) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showPaywallModal(
        `You've used all your Super Likes this week! Upgrade to get 5 Super Likes per week.`,
        'gold'
      );
      return;
    }

    // Use the super like
    useSuperLike();

    setIsTransitioning(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    swipeMutation.mutate(
      { swipedUserId: currentProfile.id, action: 'super_like' },
      {
        onSuccess: (result) => {
          if (result.isMatch) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showCelebration({
              id: result.matchId || `match-${currentProfile.id}`,
              created_at: new Date().toISOString(),
              other_user: {
                id: currentProfile.id,
                first_name: currentProfile.first_name,
                display_name: currentProfile.first_name,
                primary_photo_url: getPhotoUrl(currentProfile),
              },
              unread_count: 0,
            });
          }
        },
        onSettled: () => {
          // Move to next profile after swipe completes
          setCurrentIndex((prev) => prev + 1);
          setIsTransitioning(false);
          // Track swipe for interstitial ads
          trackSwipe();
        },
      }
    );
  }, [currentProfile, swipeMutation, showCelebration, getPhotoUrl, isTransitioning, canUseSuperLike, useSuperLike, showPaywallModal, trackSwipe]);

  // Reset on profile change
  useEffect(() => {
    setCurrentIndex(0);
  }, [apiProfiles]);

  // Safta handlers
  const handleFollowSafta = useCallback((saftaId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaftas((prev) =>
      prev.map((s) =>
        s.id === saftaId
          ? { ...s, isFollowing: !s.isFollowing, followers: s.isFollowing ? s.followers - 1 : s.followers + 1 }
          : s
      )
    );
  }, []);

  const handleMessageSafta = useCallback((saftaId: string, saftaName: string, isFollowing: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isFollowing) {
      Alert.alert('Follow First', `You need to follow ${saftaName} before you can message them.`);
      return;
    }
    router.push(`/(tabs)/messages/${saftaId}`);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.dark.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerTitleRow}>
          <AnimatedHeader title="Mazal" size="medium" />
          {isOrthodoxMode && hasOrthodoxSubscription && (
            <View style={styles.orthodoxBadge}>
              <StarOfDavid size={14} color={colors.primary.gold} />
              <Text style={styles.orthodoxBadgeText}>Orthodox</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.headerButton} onPress={() => router.push('/settings')}>
          <Ionicons name="options-outline" size={24} color={colors.transparent.white70} />
        </Pressable>
      </View>

      {/* Ad Banner - only shows for free users */}
      <AdBanner />

      {/* Mode Tabs */}
      <View style={styles.modeTabs}>
        <Pressable
          style={[styles.modeTab, discoveryMode === 'profiles' && styles.modeTabActive]}
          onPress={() => setDiscoveryMode('profiles')}
        >
          <Ionicons
            name="heart"
            size={18}
            color={discoveryMode === 'profiles' ? colors.primary.gold : colors.transparent.white50}
          />
          <Text style={[styles.modeTabText, discoveryMode === 'profiles' && styles.modeTabTextActive]}>
            Discover
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, discoveryMode === 'saftas' && styles.modeTabActive]}
          onPress={() => setDiscoveryMode('saftas')}
        >
          <Text style={styles.modeTabEmoji}>👵</Text>
          <Text style={[styles.modeTabText, discoveryMode === 'saftas' && styles.modeTabTextActive]}>
            Saftas
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {discoveryMode === 'profiles' ? (
        <View style={styles.profileContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary.gold} />
              <Text style={styles.loadingText}>Finding great people...</Text>
            </View>
          ) : hasMoreProfiles && currentProfile ? (
            <Animated.View
              key={currentProfile.id}
              entering={SlideInRight.duration(400)}
              exiting={SlideOutLeft.duration(300)}
              style={styles.profileStoryContainer}
            >
              <ProfileStory
                profile={currentProfile}
                onPass={handlePass}
                onLike={handleLike}
                onSuperLike={handleSuperLike}
              />
            </Animated.View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <StarOfDavid size={48} color={colors.neutral[600]} />
              </View>
              <Text style={styles.emptyTitle}>You've seen everyone!</Text>
              <Text style={styles.emptySubtitle}>
                Check back later for new profiles, or adjust your preferences.
              </Text>
              <Pressable style={styles.refreshButton} onPress={() => refetch()}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.saftaScrollView}
          contentContainerStyle={[styles.saftaScrollContent, { paddingBottom: insets.bottom + spacing[4] }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.saftaSectionTitle}>Discover Matchmakers</Text>
          <Text style={styles.saftaSectionSubtitle}>
            Follow Saftas to get personalized match recommendations
          </Text>

          {saftas.map((safta) => (
            <SaftaCard
              key={safta.id}
              safta={safta}
              onFollow={() => handleFollowSafta(safta.id)}
              onMessage={() => handleMessageSafta(safta.id, safta.name, safta.isFollowing)}
            />
          ))}
        </ScrollView>
      )}

      {/* Match Celebration */}
      {showMatchCelebration && newMatch && (
        <MatchCelebration
          match={newMatch}
          onClose={hideCelebration}
          onSendMessage={() => {
            hideCelebration();
            router.push(`/(tabs)/messages/${newMatch.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  orthodoxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  orthodoxBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    padding: spacing[1],
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
  },
  modeTabActive: {
    backgroundColor: colors.transparent.gold20,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.transparent.white50,
  },
  modeTabTextActive: {
    color: colors.primary.gold,
  },
  modeTabEmoji: {
    fontSize: 16,
  },
  profileContainer: {
    flex: 1,
  },
  profileStoryContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  loadingText: {
    fontSize: 16,
    color: colors.transparent.white60,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.white10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary.white,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.transparent.white60,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[6],
  },
  refreshButton: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  saftaScrollView: {
    flex: 1,
  },
  saftaScrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
  },
  saftaSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[1],
  },
  saftaSectionSubtitle: {
    fontSize: 14,
    color: colors.transparent.white60,
    marginBottom: spacing[5],
  },
});

const saftaStyles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
  },
  relationshipBadge: {
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing[1],
  },
  relationshipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing[3],
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.neutral[700],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  followingButton: {
    backgroundColor: colors.transparent.gold20,
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  followingButtonText: {
    color: colors.primary.gold,
  },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const celebrationStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starsBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundStar: {
    position: 'absolute',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  mazalText: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.primary.gold,
    textAlign: 'center',
    marginTop: spacing[4],
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.primary.white,
    marginTop: spacing[2],
    marginBottom: spacing[8],
  },
  photoContainer: {
    position: 'relative',
    marginBottom: spacing[6],
  },
  photoGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 84,
    backgroundColor: colors.primary.gold,
    opacity: 0.3,
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: colors.primary.gold,
  },
  matchName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
    textAlign: 'center',
  },
  matchHint: {
    fontSize: 16,
    color: colors.transparent.white70,
    marginTop: spacing[2],
  },
  actions: {
    position: 'absolute',
    bottom: 60,
    left: spacing[6],
    right: spacing[6],
    gap: spacing[3],
  },
  messageButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  messageButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  keepSwipingButton: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  keepSwipingText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.transparent.white70,
  },
});
