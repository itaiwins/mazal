/**
 * Safta Discover Tab
 *
 * Grandparents can browse ALL profiles and send recommendations
 * Can use grandchild's filters or set their own search criteria
 * Full scrollable profile view like regular user discovery
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useSaftaPremiumStore } from '@/stores/saftaPremiumStore';
import { SendToChatsModal } from '@/components/chat/SendToChatsModal';
import { supabase } from '@/api/supabase/client';

// Safta mode uses gold accent (same as user mode)
const SAFTA_ACCENT = colors.primary.gold;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Profile type for Safta discover
interface SaftaProfile {
  id: string;
  first_name: string;
  age: number;
  occupation?: string;
  company?: string;
  education?: string;
  school?: string;
  jewish_background?: string;
  observance_level?: string;
  keeps_shabbat?: string;
  keeps_kosher?: string;
  wants_children?: string;
  current_city?: string;
  current_state?: string;
  distance?: number;
  height_cm?: number;
  bio?: string;
  is_verified?: boolean;
  photos: { id: string; photo_url: string; photo_order: number }[];
  prompts: { prompt_id: string; answer: string }[];
  safta_approved_count: number;
}

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const JEWISH_BACKGROUNDS = [
  'Reform',
  'Conservative',
  'Modern Orthodox',
  'Orthodox',
  'Reconstructionist',
  'Just Jewish',
];

// Prompt question mapping
const PROMPT_QUESTIONS: Record<string, string> = {
  shabbat_looks_like: 'My Shabbat looks like...',
  jewish_food_take: 'Best Jewish food take:',
  bubbe_describes: 'My bubbe would describe me as...',
  favorite_holiday: 'Favorite Jewish holiday because...',
  jewish_tradition: 'A Jewish tradition I love is...',
  geek_out_on: 'I geek out on...',
  way_to_heart: 'The way to my heart is...',
  ideal_date: 'My ideal first date:',
  looking_for: "I'm looking for someone who...",
  currently_obsessed: 'Currently obsessed with:',
};

// Helper to format height
const formatHeight = (cm?: number) => {
  if (!cm) return null;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
};

// Helper to format observance
const formatObservance = (level?: string) => {
  const mapping: Record<string, string> = {
    very_observant: 'Very Observant',
    somewhat_observant: 'Somewhat Observant',
    culturally_jewish: 'Culturally Jewish',
    secular: 'Secular',
  };
  return level ? mapping[level] || level : null;
};

const formatShabbat = (level?: string) => {
  const mapping: Record<string, string> = {
    always: 'Always',
    sometimes: 'Sometimes',
    rarely: 'Rarely',
    never: 'Never',
  };
  return level ? mapping[level] || level : null;
};

const formatKosher = (level?: string) => {
  const mapping: Record<string, string> = {
    strict: 'Strict Kosher',
    kosher_style: 'Kosher Style',
    not_kosher: 'Not Kosher',
  };
  return level ? mapping[level] || level : null;
};

export default function SaftaDiscoverScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Premium store for daily limits
  const {
    isProSubscriber,
    dailyRecommendationsRemaining,
    canRecommend,
    useRecommendation,
    showPaywallModal,
    checkAndResetLimits,
  } = useSaftaPremiumStore();

  // Check and reset daily limits on mount
  useEffect(() => {
    checkAndResetLimits();
  }, []);

  // Filter state - default to custom filters (not using grandchild's preferences)
  const [useGrandchildFilters, setUseGrandchildFilters] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Custom filter state (when not using grandchild's preferences)
  const [customMinAge, setCustomMinAge] = useState(25);
  const [customMaxAge, setCustomMaxAge] = useState(35);
  const [customMaxDistance, setCustomMaxDistance] = useState(50);
  const [customBackgrounds, setCustomBackgrounds] = useState<string[]>(JEWISH_BACKGROUNDS);

  // Profile browsing state
  const [currentIndex, setCurrentIndex] = useState(0);

  // Send to chats modal state
  const [showSendToChatsModal, setShowSendToChatsModal] = useState(false);

  // Profiles state - fetched from Supabase
  const [profiles, setProfiles] = useState<SaftaProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch profiles from Supabase
  useEffect(() => {
    async function fetchProfiles() {
      setIsLoading(true);
      setError(null);

      try {
        // Calculate date range for age filter
        const today = new Date();
        const maxBirthDate = new Date(
          today.getFullYear() - customMinAge,
          today.getMonth(),
          today.getDate()
        );
        const minBirthDate = new Date(
          today.getFullYear() - customMaxAge - 1,
          today.getMonth(),
          today.getDate()
        );

        // Build query for users
        let query = supabase
          .from('users')
          .select('*')
          .eq('is_active', true)
          .eq('onboarding_complete', true)
          .gte('date_of_birth', minBirthDate.toISOString().split('T')[0])
          .lte('date_of_birth', maxBirthDate.toISOString().split('T')[0]);

        // Add Jewish background filter if not all selected
        if (customBackgrounds.length > 0 && customBackgrounds.length < JEWISH_BACKGROUNDS.length) {
          query = query.in('jewish_background', customBackgrounds);
        }

        query = query.limit(50);

        const { data: users, error: usersError } = await query;

        if (usersError) {
          throw usersError;
        }

        if (!users || users.length === 0) {
          setProfiles([]);
          setIsLoading(false);
          return;
        }

        // Fetch photos and prompts for users
        const userIds = users.map((u) => u.id);

        const [photosResult, promptsResult] = await Promise.all([
          supabase
            .from('user_photos')
            .select('*')
            .in('user_id', userIds)
            .order('photo_order', { ascending: true }),
          supabase
            .from('user_prompts')
            .select('*')
            .in('user_id', userIds)
            .order('display_order', { ascending: true }),
        ]);

        // Group photos and prompts by user
        const photosByUser: Record<string, { id: string; photo_url: string; photo_order: number }[]> = {};
        const promptsByUser: Record<string, { prompt_id: string; answer: string }[]> = {};

        (photosResult.data || []).forEach((p) => {
          if (!photosByUser[p.user_id]) photosByUser[p.user_id] = [];
          photosByUser[p.user_id].push({
            id: p.id,
            photo_url: p.photo_url,
            photo_order: p.photo_order,
          });
        });

        (promptsResult.data || []).forEach((p) => {
          if (!promptsByUser[p.user_id]) promptsByUser[p.user_id] = [];
          promptsByUser[p.user_id].push({
            prompt_id: p.prompt_id,
            answer: p.answer,
          });
        });

        // Build profile objects (converting null to undefined)
        const fetchedProfiles: SaftaProfile[] = users.map((user) => ({
          id: user.id,
          first_name: user.first_name || 'User',
          age: calculateAge(user.date_of_birth),
          occupation: user.occupation ?? undefined,
          company: user.company ?? undefined,
          education: user.education ?? undefined,
          school: user.school ?? undefined,
          jewish_background: user.jewish_background ?? undefined,
          observance_level: user.observance_level ?? undefined,
          keeps_shabbat: user.keeps_shabbat ?? undefined,
          keeps_kosher: user.keeps_kosher ?? undefined,
          wants_children: user.wants_children ?? undefined,
          current_city: user.current_city ?? undefined,
          current_state: user.current_state ?? undefined,
          height_cm: user.height_cm ?? undefined,
          bio: user.bio ?? undefined,
          is_verified: user.is_verified ?? undefined,
          photos: photosByUser[user.id] || [],
          prompts: promptsByUser[user.id] || [],
          safta_approved_count: 0, // TODO: Implement safta likes count
        }));

        setProfiles(fetchedProfiles);
      } catch (err) {
        console.error('Error fetching profiles:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch profiles');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfiles();
  }, [customMinAge, customMaxAge, customBackgrounds]);

  // Apply client-side filtering for backgrounds
  const filteredProfiles = useMemo(() => {
    if (customBackgrounds.length === 0) return [];
    return profiles.filter((profile) => {
      if (!profile.jewish_background) return true; // Include profiles without background set
      return customBackgrounds.includes(profile.jewish_background);
    });
  }, [profiles, customBackgrounds]);

  const currentProfile = filteredProfiles[currentIndex];

  const toggleBackground = (bg: string) => {
    setCustomBackgrounds((prev) =>
      prev.includes(bg) ? prev.filter((b) => b !== bg) : [...prev, bg]
    );
  };

  const handleRecommend = () => {
    // Check if user can recommend (daily limit check)
    if (!canRecommend()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Navigate to paywall
      router.push('/(safta-auth)/paywall');
      return;
    }

    // Use a recommendation from the daily limit
    const success = useRecommendation();
    if (!success) {
      // This shouldn't happen if canRecommend passed, but just in case
      router.push('/(safta-auth)/paywall');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // In production, this would send the recommendation to Supabase
    console.log('Recommending profile:', currentProfile.id);

    // Move to next profile immediately (like regular user's like button)
    if (currentIndex < filteredProfiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentIndex < filteredProfiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleOpenFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilterModal(true);
  };

  const handleApplyFilters = () => {
    setCurrentIndex(0); // Reset to first profile when filters change
    setShowFilterModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Share profile externally
  const handleShareExternal = useCallback(async () => {
    if (!currentProfile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await Share.share({
        message: `Check out ${currentProfile.first_name}'s profile on Mazal - the Jewish dating app! Download the app to see more: https://mazal.app/profile/${currentProfile.id}`,
        title: `Meet ${currentProfile.first_name} on Mazal`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [currentProfile]);

  // Share profile to messages (open send to chats modal)
  const handleShareToMessages = useCallback(() => {
    if (!currentProfile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSendToChatsModal(true);
  }, [currentProfile]);

  // Handle sending profile to selected chats
  const handleSendToChats = useCallback((chatIds: string[], message?: string) => {
    // In production, this would send the profile to the selected chats via Supabase
    console.log('Sending profile', currentProfile?.id, 'to chats:', chatIds, 'with message:', message);
    Alert.alert(
      'Profile Sent!',
      `${currentProfile?.first_name}'s profile has been sent to ${chatIds.length} chat${chatIds.length > 1 ? 's' : ''}.`,
      [{ text: 'OK' }]
    );
  }, [currentProfile]);

  // Get location string
  const locationString = useMemo(() => {
    if (!currentProfile) return '';
    const parts = [currentProfile.current_city, currentProfile.current_state].filter(Boolean);
    return parts.join(', ') || 'Nearby';
  }, [currentProfile]);

  return (
    <View style={[styles.container, { backgroundColor: colors.dark.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.logoText}>Mazal</Text>
            <View style={styles.saftaModeBadge}>
              <Text style={styles.saftaModeEmoji}>👵</Text>
              <Text style={styles.saftaModeText}>Safta Mode</Text>
            </View>
          </View>
        </View>
        <Pressable style={styles.filterButton} onPress={handleOpenFilters}>
          <Ionicons name="options-outline" size={24} color={colors.transparent.white70} />
        </Pressable>
      </View>

      {/* Daily Recommendations Limit Banner (for free users) */}
      {!isProSubscriber && (
        <Pressable
          style={styles.limitBanner}
          onPress={() => router.push('/(safta-auth)/paywall')}
        >
          <View style={styles.limitBannerLeft}>
            <Ionicons name="heart" size={18} color={dailyRecommendationsRemaining > 3 ? colors.primary.coral : colors.status.error} />
            <Text style={styles.limitBannerText}>
              {dailyRecommendationsRemaining} recommendation{dailyRecommendationsRemaining !== 1 ? 's' : ''} left today
            </Text>
          </View>
          <View style={styles.limitBannerUpgrade}>
            <Text style={styles.limitBannerUpgradeText}>Upgrade</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary.gold} />
          </View>
        </Pressable>
      )}

      {/* Pro Badge (for pro users) */}
      {isProSubscriber && (
        <View style={styles.proBadgeBanner}>
          <Ionicons name="infinite" size={18} color={colors.primary.gold} />
          <Text style={styles.proBadgeText}>Unlimited Recommendations</Text>
          <View style={styles.proBadgeIcon}>
            <Text style={styles.proBadgeIconText}>PRO</Text>
          </View>
        </View>
      )}

      {/* Filter Mode Indicator */}
      <View style={styles.filterIndicator}>
        <Ionicons
          name={useGrandchildFilters ? 'person' : 'options'}
          size={16}
          color={colors.primary.gold}
        />
        <Text style={styles.filterIndicatorText}>
          {useGrandchildFilters ? "Using connected user's preferences" : 'Using your custom filters'}
        </Text>
        <Pressable onPress={handleOpenFilters}>
          <Text style={styles.changeFilterText}>Change</Text>
        </Pressable>
      </View>

      {currentProfile ? (
        <Animated.View
          key={currentProfile.id}
          entering={SlideInRight.duration(400)}
          exiting={SlideOutLeft.duration(300)}
          style={styles.profileContainer}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Photo with Gradient Overlay */}
            <View style={styles.heroContainer}>
              <Image
                source={{ uri: currentProfile.photos[0]?.photo_url }}
                style={styles.heroImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
                style={styles.heroGradient}
              />
              <View style={styles.heroInfo}>
                <View style={styles.heroNameRow}>
                  <Text style={styles.heroName}>
                    {currentProfile.first_name}, {currentProfile.age}
                  </Text>
                  {currentProfile.is_verified && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
                  )}
                </View>
                <View style={styles.heroLocationRow}>
                  <Ionicons name="location" size={16} color={colors.transparent.white70} />
                  <Text style={styles.heroLocation}>{locationString}</Text>
                  {currentProfile.distance && (
                    <Text style={styles.heroDistance}>• {currentProfile.distance} mi</Text>
                  )}
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{currentProfile.jewish_background}</Text>
                </View>
              </View>

              {/* Share Button on Hero */}
              <Pressable style={styles.shareButton} onPress={handleShareExternal}>
                <Ionicons name="share-outline" size={22} color={colors.primary.white} />
              </Pressable>
            </View>

            {/* Photo Gallery */}
            {currentProfile.photos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoGallery}
              >
                {currentProfile.photos.slice(1).map((photo: any, index: number) => (
                  <Image
                    key={photo.id || index}
                    source={{ uri: photo.photo_url }}
                    style={styles.galleryPhoto}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
            )}

            {/* Prompts */}
            {currentProfile.prompts.map((prompt: any, index: number) => (
              <View key={prompt.prompt_id || index} style={styles.promptCard}>
                <Text style={styles.promptQuestion}>
                  {PROMPT_QUESTIONS[prompt.prompt_id] || 'My answer:'}
                </Text>
                <Text style={styles.promptAnswer}>{prompt.answer}</Text>
              </View>
            ))}

            {/* About Section */}
            {currentProfile.bio && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{currentProfile.bio}</Text>

                <View style={styles.aboutDetails}>
                  {currentProfile.height_cm && (
                    <View style={styles.detailRow}>
                      <Ionicons name="resize-outline" size={18} color={colors.transparent.white50} />
                      <Text style={styles.detailText}>{formatHeight(currentProfile.height_cm)}</Text>
                    </View>
                  )}
                  {currentProfile.occupation && (
                    <View style={styles.detailRow}>
                      <Ionicons name="briefcase-outline" size={18} color={colors.transparent.white50} />
                      <Text style={styles.detailText}>
                        {currentProfile.occupation}
                        {currentProfile.company ? ` at ${currentProfile.company}` : ''}
                      </Text>
                    </View>
                  )}
                  {currentProfile.education && (
                    <View style={styles.detailRow}>
                      <Ionicons name="school-outline" size={18} color={colors.transparent.white50} />
                      <Text style={styles.detailText}>
                        {currentProfile.education}
                        {currentProfile.school ? `, ${currentProfile.school}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Jewish Life Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jewish Life</Text>
              <View style={styles.jewishLifeGrid}>
                {currentProfile.observance_level && (
                  <View style={styles.jewishLifeItem}>
                    <Ionicons name="star" size={20} color={colors.primary.gold} />
                    <Text style={styles.jewishLifeLabel}>Observance</Text>
                    <Text style={styles.jewishLifeValue}>{formatObservance(currentProfile.observance_level)}</Text>
                  </View>
                )}
                {currentProfile.keeps_shabbat && (
                  <View style={styles.jewishLifeItem}>
                    <Ionicons name="moon" size={20} color={colors.primary.gold} />
                    <Text style={styles.jewishLifeLabel}>Shabbat</Text>
                    <Text style={styles.jewishLifeValue}>{formatShabbat(currentProfile.keeps_shabbat)}</Text>
                  </View>
                )}
                {currentProfile.keeps_kosher && (
                  <View style={styles.jewishLifeItem}>
                    <Ionicons name="restaurant" size={20} color={colors.primary.gold} />
                    <Text style={styles.jewishLifeLabel}>Kosher</Text>
                    <Text style={styles.jewishLifeValue}>{formatKosher(currentProfile.keeps_kosher)}</Text>
                  </View>
                )}
                {currentProfile.wants_children && (
                  <View style={styles.jewishLifeItem}>
                    <Ionicons name="people" size={20} color={colors.primary.gold} />
                    <Text style={styles.jewishLifeLabel}>Children</Text>
                    <Text style={styles.jewishLifeValue}>
                      {currentProfile.wants_children === 'yes' ? 'Wants kids' :
                       currentProfile.wants_children === 'open' ? 'Open to kids' : 'Not sure'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Safta Approvals */}
            {currentProfile.safta_approved_count > 0 && (
              <View style={styles.saftaApprovalBanner}>
                <Text style={styles.saftaApprovalEmoji}>👵</Text>
                <View style={styles.saftaApprovalText}>
                  <Text style={styles.saftaApprovalTitle}>
                    {currentProfile.safta_approved_count} Safta{currentProfile.safta_approved_count > 1 ? 's' : ''} Approve
                  </Text>
                  <Text style={styles.saftaApprovalSubtitle}>
                    Other matchmakers have recommended this profile
                  </Text>
                </View>
              </View>
            )}

            {/* Info Note */}
            <View style={styles.infoNote}>
              <Ionicons name="information-circle" size={18} color={colors.primary.gold} />
              <Text style={styles.infoNoteText}>
                Send this profile to Sarah with a personal note about why you think they'd be a great match!
              </Text>
            </View>
          </ScrollView>

          {/* Sticky Action Footer */}
          <View style={[styles.actionFooter, { paddingBottom: insets.bottom + spacing[2] }]}>
            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <Ionicons name="close" size={28} color={colors.neutral[400]} />
            </Pressable>
            <Pressable style={styles.sendToChatsButton} onPress={handleShareToMessages}>
              <Ionicons name="chatbubbles-outline" size={24} color={colors.primary.gold} />
            </Pressable>
            <Pressable style={styles.recommendButton} onPress={handleRecommend}>
              <Ionicons name="heart" size={24} color={colors.primary.navy} />
              <Text style={styles.recommendButtonText}>Recommend</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary.gold} />
          <Text style={styles.emptyTitle}>Loading profiles...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>😕</Text>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👀</Text>
          <Text style={styles.emptyTitle}>No profiles found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your filters or check back later for more profiles
          </Text>
        </View>
      )}

      {/* Send to Chats Modal */}
      {currentProfile && (
        <SendToChatsModal
          visible={showSendToChatsModal}
          onClose={() => setShowSendToChatsModal(false)}
          profile={{
            id: currentProfile.id,
            name: currentProfile.first_name,
            age: currentProfile.age,
            photo: currentProfile.photos[0]?.photo_url || '',
          }}
          onSend={handleSendToChats}
          title="Send Profile"
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Search Filters
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: spacing[8] }}
          >
            {/* Filter Mode Toggle */}
            <View style={[styles.filterSection, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.filterToggleRow}>
                <View style={styles.filterToggleInfo}>
                  <Ionicons name="person" size={22} color={colors.primary.gold} />
                  <View style={styles.filterToggleText}>
                    <Text style={[styles.filterToggleLabel, { color: theme.colors.text }]}>
                      Use Connected User's Preferences
                    </Text>
                    <Text style={[styles.filterToggleDesc, { color: theme.colors.textTertiary }]}>
                      Search using the same filters as your connected family member
                    </Text>
                  </View>
                </View>
                <Switch
                  value={useGrandchildFilters}
                  onValueChange={setUseGrandchildFilters}
                  trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                  thumbColor={colors.primary.white}
                />
              </View>
            </View>

            {!useGrandchildFilters && (
              <Animated.View entering={FadeInDown.springify()}>
                {/* Age Range */}
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterGroupTitle, { color: theme.colors.text }]}>
                    Age Range
                  </Text>
                  <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.stepperRow}>
                      <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>
                        Minimum Age
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMinAge(Math.max(18, customMinAge - 1))}
                        >
                          <Ionicons name="remove" size={20} color={colors.primary.navy} />
                        </Pressable>
                        <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                          {customMinAge}
                        </Text>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMinAge(Math.min(customMaxAge - 1, customMinAge + 1))}
                        >
                          <Ionicons name="add" size={20} color={colors.primary.navy} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.stepperRow}>
                      <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>
                        Maximum Age
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxAge(Math.max(customMinAge + 1, customMaxAge - 1))}
                        >
                          <Ionicons name="remove" size={20} color={colors.primary.navy} />
                        </Pressable>
                        <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                          {customMaxAge}
                        </Text>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxAge(Math.min(80, customMaxAge + 1))}
                        >
                          <Ionicons name="add" size={20} color={colors.primary.navy} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Distance */}
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterGroupTitle, { color: theme.colors.text }]}>
                    Maximum Distance
                  </Text>
                  <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.stepperRow}>
                      <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>
                        Miles
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxDistance(Math.max(5, customMaxDistance - 5))}
                        >
                          <Ionicons name="remove" size={20} color={colors.primary.navy} />
                        </Pressable>
                        <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                          {customMaxDistance}
                        </Text>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxDistance(Math.min(500, customMaxDistance + 5))}
                        >
                          <Ionicons name="add" size={20} color={colors.primary.navy} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Jewish Background */}
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterGroupTitle, { color: theme.colors.text }]}>
                    Jewish Background
                  </Text>
                  <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
                    {JEWISH_BACKGROUNDS.map((bg) => (
                      <Pressable
                        key={bg}
                        style={styles.backgroundOption}
                        onPress={() => toggleBackground(bg)}
                      >
                        <Text style={[styles.backgroundLabel, { color: theme.colors.text }]}>
                          {bg}
                        </Text>
                        <Ionicons
                          name={customBackgrounds.includes(bg) ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={customBackgrounds.includes(bg) ? colors.primary.gold : colors.neutral[400]}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}

            {useGrandchildFilters && (
              <View style={[styles.preferencesPreview, { backgroundColor: colors.transparent.gold20 }]}>
                <Text style={[styles.preferencesTitle, { color: theme.colors.text }]}>
                  Connected User's Preferences
                </Text>
                <Text style={[styles.preferencesDetail, { color: theme.colors.textSecondary }]}>
                  No connected users yet. Connect with a grandchild to use their preferences.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.applyButton} onPress={handleApplyFilters}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
  },
  headerLeft: {
    flex: 1,
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
  saftaModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  saftaModeEmoji: {
    fontSize: 12,
  },
  saftaModeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    backgroundColor: colors.transparent.gold20,
    gap: spacing[2],
  },
  filterIndicatorText: {
    fontSize: 13,
    flex: 1,
    color: colors.transparent.white70,
  },
  changeFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  profileContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  // Hero Section
  heroContainer: {
    height: SCREEN_WIDTH * 1.2,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  heroInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[4],
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  heroName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary.white,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[3],
  },
  heroLocation: {
    fontSize: 14,
    color: colors.transparent.white70,
  },
  heroDistance: {
    fontSize: 14,
    color: colors.transparent.white50,
    marginLeft: spacing[1],
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.transparent.white20,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  heroBadgeText: {
    fontSize: 13,
    color: colors.primary.white,
    fontWeight: '600',
  },
  shareButton: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.black40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Photo Gallery
  photoGallery: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  galleryPhoto: {
    width: 120,
    height: 160,
    borderRadius: borderRadius.lg,
  },
  // Prompts
  promptCard: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.gold,
  },
  promptQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.transparent.white50,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  promptAnswer: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.primary.white,
  },
  // Sections
  section: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[4],
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[3],
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.transparent.white80,
    marginBottom: spacing[3],
  },
  aboutDetails: {
    gap: spacing[2],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  detailText: {
    fontSize: 14,
    color: colors.transparent.white70,
  },
  // Jewish Life
  jewishLifeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  jewishLifeItem: {
    width: '47%',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.lg,
  },
  jewishLifeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.transparent.white50,
    textTransform: 'uppercase',
    marginTop: spacing[1],
  },
  jewishLifeValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.white,
    marginTop: spacing[0.5],
    textAlign: 'center',
  },
  // Safta Approval Banner
  saftaApprovalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[4],
    backgroundColor: colors.transparent.gold20,
    borderRadius: borderRadius.xl,
    gap: spacing[3],
  },
  saftaApprovalEmoji: {
    fontSize: 32,
  },
  saftaApprovalText: {
    flex: 1,
  },
  saftaApprovalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.white,
  },
  saftaApprovalSubtitle: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: spacing[0.5],
  },
  // Info Note
  infoNote: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[3],
    backgroundColor: colors.transparent.gold20,
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.transparent.white80,
  },
  // Action Footer
  actionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    backgroundColor: colors.dark.background,
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.transparent.white10,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.neutral[700],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
  },
  sendToChatsButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.transparent.gold10,
  },
  recommendButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  recommendButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.transparent.white50,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
  },
  modalClose: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  modalSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.transparent.white70,
    marginBottom: spacing[4],
  },
  noteInput: {
    fontSize: 16,
    lineHeight: 24,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: colors.dark.card,
    color: colors.primary.white,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    color: colors.transparent.white50,
    marginTop: spacing[2],
  },
  modalFooter: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  // Filter Modal Styles
  filterSection: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  filterToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  filterToggleText: {
    flex: 1,
  },
  filterToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterToggleDesc: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },
  filterGroup: {
    marginBottom: spacing[4],
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  filterCard: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[800],
  },
  stepperLabel: {
    fontSize: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  backgroundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[800],
  },
  backgroundLabel: {
    fontSize: 16,
  },
  preferencesPreview: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
  },
  preferencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  preferencesDetail: {
    fontSize: 14,
    marginBottom: spacing[1],
  },
  applyButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  // Limit Banner Styles
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    backgroundColor: colors.transparent.coral20,
    borderWidth: 1,
    borderColor: colors.transparent.coral40,
  },
  limitBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  limitBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.white,
  },
  limitBannerUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  limitBannerUpgradeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  // Pro Badge Banner Styles
  proBadgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    backgroundColor: colors.transparent.gold20,
    gap: spacing[2],
  },
  proBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  proBadgeIcon: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  proBadgeIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.navy,
    letterSpacing: 0.5,
  },
});
