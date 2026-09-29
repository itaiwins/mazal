/**
 * Profile Screen
 *
 * Premium redesigned profile view with hero header and stats
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useUserProfile } from '@/api/queries';
import { supabase } from '@/api/supabase/client';
import { DEMO_PROFILES } from '@/lib/demo/demoProfiles';
import { FEATURE_PHOTO_VERIFICATION, FEATURE_SAFTA_MODE } from '@/lib/config/features';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = 140;

// Helper to calculate age from date of birth
function calculateAge(dateOfBirth: string | null): number {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const BADGES = {
  birthright: { label: 'Birthright', emoji: '✈️', color: '#4A90D9' },
  hebrew_speaker: { label: 'Hebrew', emoji: '🗣️', color: '#E67E22' },
  day_school: { label: 'Day School', emoji: '🎓', color: '#9B59B6' },
  verified_jewish: { label: 'Verified', emoji: '🔯', color: colors.primary.gold },
  verified: { label: 'Verified', emoji: '✓', color: colors.primary.gold },
};

// Stat Card Component
function StatCard({
  value,
  label,
  icon,
  delay = 0
}: {
  value: string | number;
  label: string;
  icon: string;
  delay?: number;
}) {
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).springify()}
      style={styles.statCard}
    >
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={20} color={colors.primary.gold} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// Action Button Component
function ActionButton({
  icon,
  label,
  onPress,
  variant = 'default',
  delay = 0
}: {
  icon: string;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'gold';
  delay?: number;
}) {
  const isPrimary = variant === 'primary';
  const isGold = variant === 'gold';

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()}>
      <Pressable
        style={[
          styles.actionButton,
          isPrimary && styles.actionButtonPrimary,
          isGold && styles.actionButtonGold,
        ]}
        onPress={onPress}
      >
        <View style={[
          styles.actionIconContainer,
          isPrimary && styles.actionIconPrimary,
          isGold && styles.actionIconGold,
        ]}>
          <Ionicons
            name={icon as any}
            size={22}
            color={isGold ? colors.primary.gold : isPrimary ? colors.primary.white : colors.primary.white}
          />
        </View>
        <Text style={[
          styles.actionLabel,
          isGold && styles.actionLabelGold,
        ]}>{label}</Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={isGold ? colors.primary.gold : colors.transparent.white50}
        />
      </Pressable>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const [saftasLikedCount, setSaftasLikedCount] = useState(0);

  // Fetch complete profile with photos, prompts, and badges
  const { data: userProfile, isLoading: isLoadingProfile } = useUserProfile();

  // Demo mode profile data
  const demoProfile = DEMO_PROFILES[0];

  // Fetch count of saftas who have liked/approved this user
  // (skipped entirely while parents/grandparents mode is hidden - docs/ROADMAP.md)
  useEffect(() => {
    if (FEATURE_SAFTA_MODE && user?.id && !isDemoMode) {
      supabase
        .from('safta_likes')
        .select('id', { count: 'exact', head: true })
        .eq('liked_user_id', user.id)
        .then(({ count }) => {
          setSaftasLikedCount(count || 0);
        });
    }
  }, [user?.id, isDemoMode]);

  // Get primary photo from photos array (use demo data if in demo mode)
  const primaryPhoto = isDemoMode
    ? demoProfile?.photos?.[0]?.photo_url
    : userProfile?.photos?.find((p) => p.photo_order === 0)?.photo_url ||
      userProfile?.photos?.[0]?.photo_url || null;

  // Get all photos for preview
  const allPhotos = isDemoMode
    ? demoProfile?.photos || []
    : userProfile?.photos || [];

  // Get badge IDs from user badges
  const userBadgeIds = isDemoMode
    ? demoProfile?.badges?.map((b) => b.badge_type) || ['verified']
    : userProfile?.badges?.map((b) => b.badge_type) || [];

  // Build profile object with fetched data (or demo data if in demo mode)
  const profile = isDemoMode ? {
    first_name: demoProfile?.first_name || 'Demo User',
    age: demoProfile?.age || 28,
    bio: demoProfile?.bio || '',
    photos: allPhotos,
    jewish_background: demoProfile?.jewish_background || 'Conservative',
    occupation: demoProfile?.occupation || 'Professional',
    school: demoProfile?.education || 'University',
    location: demoProfile?.current_city || 'New York',
    prompts: demoProfile?.prompts || [],
    badges: userBadgeIds,
    is_verified: true,
    is_premium: true,
    primary_photo: primaryPhoto,
    saftas_liked: demoProfile?.safta_approved_count || 4,
    matches_count: 12,
    profile_views: 87,
  } : {
    first_name: userProfile?.first_name || user?.first_name || 'User',
    age: userProfile?.age || calculateAge(user?.date_of_birth || null),
    bio: userProfile?.bio || user?.bio || '',
    photos: allPhotos,
    jewish_background: userProfile?.jewish_background || user?.jewish_background || '',
    occupation: userProfile?.occupation || user?.occupation || '',
    school: userProfile?.school || user?.school || '',
    location: userProfile?.current_city || user?.current_city || '',
    prompts: userProfile?.prompts || [],
    badges: userBadgeIds,
    is_verified: userProfile?.is_verified || user?.is_verified || false,
    is_premium: userProfile?.is_premium || user?.is_premium || false,
    primary_photo: primaryPhoto,
    saftas_liked: saftasLikedCount,
    matches_count: 0,
    profile_views: 0,
  };

  // Calculate profile completeness
  const calculateCompleteness = () => {
    let complete = 0;
    let total = 7;
    if (profile.first_name) complete++;
    if (profile.primary_photo) complete++;
    if (profile.bio) complete++;
    if (profile.occupation) complete++;
    if (profile.jewish_background) complete++;
    if (profile.prompts?.length >= 2) complete++;
    if (profile.photos?.length >= 3) complete++;
    return Math.round((complete / total) * 100);
  };

  const completeness = calculateCompleteness();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.replace('/(auth)/welcome');
  };

  // Show loading while fetching profile (bypass in demo mode)
  if (isLoadingProfile && !isDemoMode) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header with Gradient */}
        <LinearGradient
          colors={[colors.primary.navy, colors.dark.background]}
          style={[styles.heroContainer, { paddingTop: insets.top + spacing[4] }]}
        >
          {/* Settings Button */}
          <Animated.View
            entering={FadeIn.delay(100)}
            style={styles.headerActions}
          >
            <Pressable
              style={styles.settingsButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={24} color={colors.primary.white} />
            </Pressable>
          </Animated.View>

          {/* Profile Photo */}
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={styles.photoContainer}
          >
            {profile.primary_photo ? (
              <Image
                source={{ uri: profile.primary_photo }}
                style={styles.mainPhoto}
              />
            ) : (
              <View style={[styles.mainPhoto, styles.photoPlaceholder]}>
                <Ionicons name="person" size={56} color={colors.transparent.white30} />
              </View>
            )}
            {/* Verified Badge */}
            {profile.is_verified && (
              <View style={styles.verifiedBadgeOverlay}>
                <Ionicons name="checkmark-circle" size={28} color={colors.semantic.info} />
              </View>
            )}
            {/* Edit Photo Button */}
            <Pressable
              style={styles.editPhotoButton}
              onPress={() => router.push('/profile/edit')}
            >
              <Ionicons name="camera" size={16} color={colors.primary.white} />
            </Pressable>
          </Animated.View>

          {/* Name and Info */}
          <Animated.View
            entering={FadeInUp.delay(300).springify()}
            style={styles.profileInfo}
          >
            <Text style={styles.name}>{profile.first_name}, {profile.age}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.transparent.white60} />
              <Text style={styles.location}>{profile.location || 'Add location'}</Text>
            </View>
            {profile.occupation && (
              <Text style={styles.occupation}>{profile.occupation}</Text>
            )}
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View
            entering={FadeInUp.delay(400).springify()}
            style={styles.quickActions}
          >
            <Pressable
              style={styles.quickActionButton}
              onPress={() => router.push('/profile/edit')}
            >
              <Ionicons name="pencil" size={18} color={colors.primary.gold} />
              <Text style={styles.quickActionText}>Edit Profile</Text>
            </Pressable>
            <View style={styles.quickActionDivider} />
            <Pressable
              style={styles.quickActionButton}
              onPress={() => router.push('/profile/preview')}
            >
              <Ionicons name="eye-outline" size={18} color={colors.primary.white} />
              <Text style={styles.quickActionTextLight}>Preview</Text>
            </Pressable>
          </Animated.View>
        </LinearGradient>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          {/* Safta Approvals - hidden behind a flag (docs/ROADMAP.md) */}
          {FEATURE_SAFTA_MODE && (
            <StatCard
              value={profile.saftas_liked}
              label="Safta Approvals"
              icon="heart"
              delay={500}
            />
          )}
          <StatCard
            value={profile.matches_count}
            label="Matches"
            icon="people"
            delay={600}
          />
          <StatCard
            value={`${completeness}%`}
            label="Complete"
            icon="checkmark-done"
            delay={700}
          />
        </View>

        {/* Profile Completeness Bar */}
        {completeness < 100 && (
          <Animated.View entering={FadeInUp.delay(800).springify()}>
            <Pressable
              style={styles.completenessCard}
              onPress={() => router.push('/profile/edit')}
            >
              <View style={styles.completenessHeader}>
                <Text style={styles.completenessTitle}>Complete Your Profile</Text>
                <View style={styles.completenessRight}>
                  <Text style={styles.completenessPercent}>{completeness}%</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary.gold} />
                </View>
              </View>
              <View style={styles.completenessBarBg}>
                <Animated.View
                  style={[styles.completenessBarFill, { width: `${completeness}%` }]}
                />
              </View>
              <Text style={styles.completenessHint}>
                Complete profiles get 3x more matches
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Badges Section */}
        {profile.badges.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(900).springify()}
            style={styles.badgesSection}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Badges</Text>
              <Pressable onPress={() => router.push('/profile/badges')}>
                <Text style={styles.sectionAction}>Add More</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgesList}
            >
              {profile.badges.map((badgeId) => {
                const badge = BADGES[badgeId as keyof typeof BADGES];
                if (!badge) return null;
                return (
                  <View
                    key={badgeId}
                    style={[styles.badge, { borderColor: badge.color + '50' }]}
                  >
                    <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                    <Text style={styles.badgeLabel}>{badge.label}</Text>
                  </View>
                );
              })}
              <Pressable
                style={styles.addBadge}
                onPress={() => router.push('/profile/badges')}
              >
                <Ionicons name="add" size={20} color={colors.primary.gold} />
              </Pressable>
            </ScrollView>
          </Animated.View>
        )}

        {/* Photo Gallery Preview */}
        {profile.photos.length > 1 && (
          <Animated.View
            entering={FadeInUp.delay(1000).springify()}
            style={styles.photosSection}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Photos</Text>
              <Pressable onPress={() => router.push('/profile/edit')}>
                <Text style={styles.sectionAction}>Manage</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosList}
            >
              {profile.photos.slice(0, 6).map((photo: any, index: number) => (
                <Pressable
                  key={photo.id || index}
                  style={styles.photoThumbnail}
                  onPress={() => router.push('/profile/edit')}
                >
                  <Image
                    source={{ uri: photo.photo_url }}
                    style={styles.thumbnailImage}
                  />
                </Pressable>
              ))}
              <Pressable
                style={styles.addPhoto}
                onPress={() => router.push('/profile/edit')}
              >
                <Ionicons name="add" size={24} color={colors.primary.gold} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        )}

        {/* Premium Upsell */}
        {!profile.is_premium && (
          <Animated.View entering={FadeInUp.delay(1100).springify()}>
            <Pressable
              style={styles.premiumCard}
              onPress={() => router.push('/premium')}
            >
              <LinearGradient
                colors={['rgba(201, 162, 39, 0.2)', 'rgba(201, 162, 39, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumGradient}
              >
                <View style={styles.premiumContent}>
                  <View style={styles.premiumIconContainer}>
                    <Ionicons name="star" size={24} color={colors.primary.gold} />
                  </View>
                  <View style={styles.premiumText}>
                    <Text style={styles.premiumTitle}>Upgrade to Mazal Gold</Text>
                    <Text style={styles.premiumSubtitle}>
                      See who likes you, unlimited swipes & more
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.primary.gold} />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsSectionTitle}>Account</Text>

          <ActionButton
            icon="heart-outline"
            label="Discovery Preferences"
            onPress={() => router.push('/settings/preferences')}
            delay={1200}
          />
          {/* Photo verification is off until it moves server-side (MEXA-359) */}
          {FEATURE_PHOTO_VERIFICATION && (
            <ActionButton
              icon="shield-checkmark-outline"
              label="Verify Your Profile"
              onPress={() => router.push('/profile/verify')}
              variant="gold"
              delay={1300}
            />
          )}
          <ActionButton
            icon="moon-outline"
            label="Shabbat Mode"
            onPress={() => router.push('/settings')}
            delay={1400}
          />
        </View>

        {/* Logout Button */}
        <Animated.View
          entering={FadeInUp.delay(1500).springify()}
          style={styles.logoutContainer}
        >
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.semantic.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.versionText}>Mazal v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContainer: {
    paddingBottom: spacing[6],
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  mainPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.primary.gold,
  },
  photoPlaceholder: {
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadgeOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: colors.dark.background,
    borderRadius: 14,
    padding: 2,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: SCREEN_WIDTH / 2 - PHOTO_SIZE / 2 - 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary.navy,
  },
  profileInfo: {
    alignItems: 'center',
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[1],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[1],
  },
  location: {
    fontSize: 14,
    color: colors.transparent.white60,
  },
  occupation: {
    fontSize: 15,
    color: colors.transparent.white80,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[5],
    backgroundColor: colors.transparent.white10,
    marginHorizontal: spacing[6],
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  quickActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.transparent.white20,
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  quickActionTextLight: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary.white,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    marginTop: -spacing[4],
    marginBottom: spacing[4],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.transparent.white10,
    marginHorizontal: spacing[1.5],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.white,
  },
  statLabel: {
    fontSize: 11,
    color: colors.transparent.white60,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  completenessCard: {
    backgroundColor: colors.transparent.white10,
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  completenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  completenessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  completenessRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  completenessPercent: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  completenessBarBg: {
    height: 8,
    backgroundColor: colors.transparent.white10,
    borderRadius: 4,
    overflow: 'hidden',
  },
  completenessBarFill: {
    height: '100%',
    backgroundColor: colors.primary.gold,
    borderRadius: 4,
  },
  completenessHint: {
    fontSize: 13,
    color: colors.transparent.white50,
    marginTop: spacing[3],
  },
  badgesSection: {
    marginBottom: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  badgesList: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.transparent.white10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.white,
  },
  addBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.transparent.gold50,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photosSection: {
    marginBottom: spacing[4],
  },
  photosList: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  photoThumbnail: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  addPhoto: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.transparent.gold50,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 10,
    color: colors.primary.gold,
    marginTop: spacing[1],
    fontWeight: '600',
  },
  premiumCard: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing[3],
  },
  premiumIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumText: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  premiumSubtitle: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: spacing[0.5],
  },
  actionsSection: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
  },
  actionsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.transparent.white50,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[2],
    gap: spacing[3],
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary.gold,
  },
  actionButtonGold: {
    backgroundColor: colors.transparent.gold10,
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconPrimary: {
    backgroundColor: colors.transparent.white20,
  },
  actionIconGold: {
    backgroundColor: colors.transparent.gold20,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
  },
  actionLabelGold: {
    color: colors.primary.gold,
  },
  logoutContainer: {
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    backgroundColor: colors.transparent.error10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.error20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.semantic.error,
  },
  versionText: {
    fontSize: 12,
    color: colors.transparent.white30,
    textAlign: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
});
