/**
 * Orthodox Discover Screen
 *
 * Browse Orthodox singles with elegant styling
 * Uses the shared 3D Card Stack system for consistent UX
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { fetchPrimaryPhotoUrls } from '@/api/queries/primaryPhotos';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { CardStack, ActionButtons, ProfileData } from '@/components/discovery';
import { HapticPatterns } from '@/utils/haptics';
import { StarOfDavid } from '@/components/icons/StarOfDavid';

const { width, height } = Dimensions.get('window');

interface OrthodoxProfile {
  id: string;
  first_name: string;
  age: number;
  jewish_background: string;
  bio: string;
  occupation: string;
  photo_url: string | null;
}

export default function OrthodoxDiscoverScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [profiles, setProfiles] = useState<OrthodoxProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // View mode - card stack vs original
  const [viewMode, setViewMode] = useState<'cards' | 'story'>('cards');
  const [selectedProfileForModal, setSelectedProfileForModal] = useState<OrthodoxProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Fetch Orthodox profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user?.id) return;

      try {
        // `user_public_profiles`, not `users`: since 00013 (MEXA-261) that table serves the
        // caller's own row and nothing else, so this deck would come back empty. The view
        // carries the visibility rule the dropped policy used to - active, not you, no block
        // either way - and publishes display columns only.
        //
        // Photos are a second query rather than the `photos:user_photos(...)` embed this
        // used to carry: the view is not a table, so the typed client cannot describe an
        // embed hanging off it (MEXA-279).
        const { data, error } = await supabase
          .from('user_public_profiles')
          .select('id, first_name, date_of_birth, jewish_background, bio, occupation')
          .eq('is_orthodox_user', true)
          .eq('is_active', true)
          .neq('id', user.id)
          .limit(20);

        if (error) throw error;

        const photoUrls = await fetchPrimaryPhotoUrls((data ?? []).map((p) => p.id));

        const formattedProfiles = (data || []).map((profile) => ({
          id: profile.id,
          first_name: profile.first_name || 'Anonymous',
          age: profile.date_of_birth
            ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
            : 0,
          jewish_background: profile.jewish_background || '',
          bio: profile.bio || '',
          occupation: profile.occupation || '',
          photo_url: photoUrls.get(profile.id) ?? null,
        }));

        setProfiles(formattedProfiles);
      } catch (error) {
        console.error('Error fetching profiles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, [user?.id]);

  // Convert OrthodoxProfile to ProfileData for CardStack
  const cardStackProfiles: ProfileData[] = useMemo(() => {
    return profiles.map((profile) => ({
      id: profile.id,
      first_name: profile.first_name,
      age: profile.age,
      occupation: profile.occupation,
      jewish_background: profile.jewish_background,
      photos: profile.photo_url ? [{ id: '1', photo_url: profile.photo_url, photo_order: 0 }] : [],
      prompts: [],
    }));
  }, [profiles]);

  const currentProfile = profiles[currentIndex];
  const hasMoreProfiles = currentIndex < profiles.length;

  // CardStack Handlers
  const handleCardSwipeLeft = useCallback((profile: ProfileData) => {
    HapticPatterns.pass();
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleCardSwipeRight = useCallback(async (profile: ProfileData) => {
    HapticPatterns.like();
    if (user?.id) {
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        swiped_id: profile.id,
        action: 'like',
      });
    }
    setCurrentIndex((prev) => prev + 1);
  }, [user?.id]);

  const handleCardSwipeUp = useCallback((profile: ProfileData) => {
    const fullProfile = profiles.find((p) => p.id === profile.id);
    if (fullProfile) {
      setSelectedProfileForModal(fullProfile);
      setShowProfileModal(true);
    }
  }, [profiles]);

  const handleCardTap = useCallback((profile: ProfileData) => {
    const fullProfile = profiles.find((p) => p.id === profile.id);
    if (fullProfile) {
      setSelectedProfileForModal(fullProfile);
      setShowProfileModal(true);
    }
  }, [profiles]);

  const handleCardAdvance = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setShowProfileModal(false);
    setSelectedProfileForModal(null);
  }, []);

  // Button handlers
  const handlePass = useCallback(() => {
    HapticPatterns.pass();
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleLike = useCallback(async () => {
    HapticPatterns.like();
    if (currentProfile && user?.id) {
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        swiped_id: currentProfile.id,
        action: 'like',
      });
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentProfile, user?.id]);

  const handleSuperLike = useCallback(async () => {
    HapticPatterns.superLike();
    if (currentProfile && user?.id) {
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        swiped_id: currentProfile.id,
        action: 'super_like',
      });
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentProfile, user?.id]);

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => prev === 'cards' ? 'story' : 'cards');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <StarOfDavid size={32} color={colors.primary.gold} />
            <View>
              <Text style={styles.headerTitle}>Shidduch</Text>
              <Text style={styles.headerSubtitle}>Orthodox Matching</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {/* View Mode Toggle */}
            <Pressable style={styles.headerButton} onPress={toggleViewMode}>
              <Ionicons
                name={viewMode === 'cards' ? 'albums-outline' : 'layers-outline'}
                size={22}
                color={colors.primary.gold}
              />
            </Pressable>
            <Pressable style={styles.filterButton}>
              <Ionicons name="options-outline" size={24} color={colors.primary.gold} />
            </Pressable>
          </View>
        </View>

        {hasMoreProfiles && currentProfile ? (
          <>
            {/* 3D Card Stack */}
            <CardStack
              profiles={cardStackProfiles}
              currentIndex={currentIndex}
              onSwipeLeft={handleCardSwipeLeft}
              onSwipeRight={handleCardSwipeRight}
              onSwipeUp={handleCardSwipeUp}
              onTap={handleCardTap}
              onCardAdvance={handleCardAdvance}
            />

            {/* Orthodox-styled Action Buttons */}
            <ActionButtons
              onPass={handlePass}
              onLike={handleLike}
              onSuperLike={handleSuperLike}
              disabled={isTransitioning}
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <StarOfDavid size={64} color={colors.primary.gold} />
            <Text style={styles.emptyStateTitle}>No More Profiles</Text>
            <Text style={styles.emptyStateText}>
              Check back later for new matches in your community
            </Text>
          </View>
        )}
      </View>

      {/* Full Profile Modal */}
      {showProfileModal && selectedProfileForModal && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleCloseProfileModal}
        >
          <View style={styles.profileModalContainer}>
            <Pressable style={styles.profileModalClose} onPress={handleCloseProfileModal}>
              <Ionicons name="close" size={28} color={colors.primary.white} />
            </Pressable>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Hero Photo */}
              <View style={styles.heroContainer}>
                {selectedProfileForModal.photo_url ? (
                  <Image
                    source={{ uri: selectedProfileForModal.photo_url }}
                    style={styles.heroImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.heroImage, styles.heroPlaceholder]}>
                    <Ionicons name="person" size={80} color={colors.neutral[400]} />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(10,22,40,0.8)', 'rgba(10,22,40,0.98)']}
                  style={styles.heroGradient}
                />
                <View style={styles.heroInfo}>
                  <View style={styles.heroNameRow}>
                    <Text style={styles.heroName}>
                      {selectedProfileForModal.first_name}, {selectedProfileForModal.age}
                    </Text>
                    <View style={styles.verifiedBadge}>
                      <StarOfDavid size={16} color={colors.primary.navy} />
                    </View>
                  </View>
                  {selectedProfileForModal.jewish_background && (
                    <View style={styles.backgroundBadge}>
                      <Text style={styles.backgroundBadgeText}>
                        {selectedProfileForModal.jewish_background.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* About Section */}
              {selectedProfileForModal.bio && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <Text style={styles.bioText}>{selectedProfileForModal.bio}</Text>
                </View>
              )}

              {/* Occupation */}
              {selectedProfileForModal.occupation && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Occupation</Text>
                  <Text style={styles.bioText}>{selectedProfileForModal.occupation}</Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Action Footer */}
            <View style={[styles.modalActionFooter, { paddingBottom: insets.bottom + spacing[2] }]}>
              <Pressable style={styles.passButtonModal} onPress={() => {
                handleCloseProfileModal();
                handlePass();
              }}>
                <Ionicons name="close" size={28} color={colors.neutral[400]} />
              </Pressable>
              <Pressable style={styles.superLikeButtonModal} onPress={() => {
                handleCloseProfileModal();
                handleSuperLike();
              }}>
                <StarOfDavid size={24} color={colors.primary.navy} />
              </Pressable>
              <Pressable style={styles.likeButtonModal} onPress={() => {
                handleCloseProfileModal();
                handleLike();
              }}>
                <Ionicons name="heart" size={28} color={colors.primary.navy} />
                <Text style={styles.likeButtonText}>Like</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing[4],
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.transparent.white60,
    textAlign: 'center',
  },
  // Profile Modal Styles
  profileModalContainer: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  profileModalClose: {
    position: 'absolute',
    top: spacing[6],
    right: spacing[4],
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  heroContainer: {
    height: height * 0.5,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    backgroundColor: '#1a2d52',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing[2],
  },
  heroName: {
    fontSize: 32,
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
  section: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[4],
    backgroundColor: 'rgba(26, 45, 82, 0.8)',
    borderRadius: borderRadius.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.transparent.white80,
  },
  modalActionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    backgroundColor: '#0a1628',
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  passButtonModal: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.neutral[700],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  superLikeButtonModal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeButtonModal: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  likeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
