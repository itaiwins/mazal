/**
 * Profile Screen
 *
 * View and edit your profile
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useUserProfile } from '@/api/queries';
import { supabase } from '@/api/supabase/client';
import { StarOfDavid } from '@/components/icons/StarOfDavid';
import { AnimatedHeader } from '@/components/ui/AnimatedHeader';

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
  birthright: { label: 'Birthright', emoji: '✈️' },
  hebrew_speaker: { label: 'Hebrew', emoji: '🗣️' },
  day_school: { label: 'Day School', emoji: '🎓' },
  verified_jewish: { label: 'Verified', emoji: '🔯' },
};

function SettingsItem({
  icon,
  label,
  onPress,
  showArrow = true,
  rightElement,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <Pressable style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemLeft}>
        <Ionicons name={icon as any} size={22} color={theme.colors.icon} />
        <Text style={[styles.settingsItemLabel, { color: theme.colors.text }]}>{label}</Text>
      </View>
      {rightElement || (showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
      ))}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isOrthodoxMode = useUIStore((s) => s.isOrthodoxMode);
  const hasOrthodoxSubscription = useUIStore((s) => s.hasOrthodoxSubscription);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);

  // Fetch complete profile with photos, prompts, and badges
  const { data: userProfile, isLoading: isLoadingProfile } = useUserProfile();

  // Get primary photo from photos array
  const primaryPhoto = userProfile?.photos?.find((p) => p.photo_order === 0)?.photo_url ||
                       userProfile?.photos?.[0]?.photo_url || null;

  // Get badge IDs from user badges
  const userBadgeIds = userProfile?.badges?.map((b) => b.badge_type) || [];

  // Build profile object with fetched data
  const profile = {
    first_name: userProfile?.first_name || user?.first_name || 'User',
    age: userProfile?.age || calculateAge(user?.date_of_birth || null),
    bio: userProfile?.bio || user?.bio || '',
    photos: userProfile?.photos || [],
    jewish_background: userProfile?.jewish_background || user?.jewish_background || '',
    occupation: userProfile?.occupation || user?.occupation || '',
    school: userProfile?.school || user?.school || '',
    prompts: userProfile?.prompts || [],
    badges: userBadgeIds,
    is_verified: userProfile?.is_verified || user?.is_verified || false,
    is_premium: userProfile?.is_premium || user?.is_premium || false,
    primary_photo: primaryPhoto,
    saftas_liked: 0, // Number of Saftas who have liked/recommended this user - will be populated from database
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.replace('/(auth)/welcome');
  };

  // Show loading while fetching profile
  if (isLoadingProfile) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <AnimatedHeader title="Profile" size="medium" />
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.icon} />
        </Pressable>
      </View>

      {/* Profile Preview */}
      <View style={styles.profilePreview}>
        {profile.primary_photo ? (
          <Image
            source={{ uri: profile.primary_photo }}
            style={styles.mainPhoto}
          />
        ) : (
          <View style={[styles.mainPhoto, styles.photoPlaceholder]}>
            <Ionicons name="person" size={48} color={colors.neutral[400]} />
          </View>
        )}
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {profile.first_name}, {profile.age}
            </Text>
            {profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={colors.semantic.info} />
              </View>
            )}
          </View>
          <Text style={[styles.occupation, { color: theme.colors.textSecondary }]}>
            {profile.occupation} at {profile.school}
          </Text>
        </View>

        {/* Edit Profile Button */}
        <Pressable
          style={styles.editButton}
          onPress={() => router.push('/profile/edit')}
        >
          <Ionicons name="pencil" size={18} color={colors.primary.gold} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>

        {/* Preview Button */}
        <Pressable
          style={styles.previewButton}
          onPress={() => router.push('/profile/preview')}
        >
          <Ionicons name="eye-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={[styles.previewButtonText, { color: theme.colors.textSecondary }]}>
            Preview
          </Text>
        </Pressable>

        {/* Saftas Liked Stat */}
        {profile.saftas_liked > 0 && (
          <View style={[styles.saftaLikedBadge, { backgroundColor: colors.transparent.gold20 }]}>
            <Text style={styles.saftaLikedEmoji}>👵</Text>
            <Text style={[styles.saftaLikedText, { color: colors.primary.gold }]}>
              {profile.saftas_liked} Saftas approve of you!
            </Text>
          </View>
        )}
      </View>

      {/* Verification */}
      {!profile.is_verified && (
        <Pressable
          style={[styles.verificationBanner, { backgroundColor: colors.transparent.gold20 }]}
          onPress={() => router.push('/profile/verify')}
        >
          <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary.gold} />
          <View style={styles.verificationContent}>
            <Text style={[styles.verificationTitle, { color: theme.colors.text }]}>
              Verify Your Profile
            </Text>
            <Text style={[styles.verificationSubtitle, { color: theme.colors.textSecondary }]}>
              Get a verified badge and stand out
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
        </Pressable>
      )}

      {/* Badges */}
      <View style={styles.badgesSection}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          Badges
        </Text>
        <View style={styles.badgesList}>
          {profile.badges.map((badgeId) => {
            const badge = BADGES[badgeId as keyof typeof BADGES];
            if (!badge) return null;
            return (
              <View key={badgeId} style={styles.badge}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                <Text style={styles.badgeLabel}>{badge.label}</Text>
              </View>
            );
          })}
          <Pressable
            style={styles.addBadge}
            onPress={() => router.push('/profile/badges')}
          >
            <Ionicons name="add" size={18} color={colors.primary.gold} />
          </Pressable>
        </View>
      </View>

      {/* Premium Banner */}
      {!profile.is_premium && (
        <Pressable
          style={styles.premiumBanner}
          onPress={() => router.push('/premium')}
        >
          <View style={styles.premiumContent}>
            <Ionicons name="star" size={24} color={colors.primary.gold} />
            <View style={styles.premiumText}>
              <Text style={styles.premiumTitle}>Upgrade to Mazal Gold</Text>
              <Text style={styles.premiumSubtitle}>See who likes you, unlimited swipes & more</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
        </Pressable>
      )}

      {/* Orthodox Mode Section */}
      <Pressable
        style={[
          styles.orthodoxBanner,
          hasOrthodoxSubscription && isOrthodoxMode && styles.orthodoxBannerActive,
        ]}
        onPress={() => {
          if (hasOrthodoxSubscription) {
            // Toggle between modes
            setOrthodoxMode(!isOrthodoxMode);
          } else {
            // Show paywall/intro
            router.push('/(orthodox)');
          }
        }}
      >
        <View style={styles.orthodoxContent}>
          <View style={styles.orthodoxIconContainer}>
            <StarOfDavid size={24} color={hasOrthodoxSubscription && isOrthodoxMode ? colors.primary.white : colors.primary.gold} />
          </View>
          <View style={styles.orthodoxText}>
            <Text style={[
              styles.orthodoxTitle,
              hasOrthodoxSubscription && isOrthodoxMode && styles.orthodoxTitleActive
            ]}>
              {hasOrthodoxSubscription
                ? (isOrthodoxMode ? 'Orthodox Mode Active' : 'Switch to Orthodox Mode')
                : 'Orthodox / Hasidic Mode'}
            </Text>
            <Text style={[
              styles.orthodoxSubtitle,
              hasOrthodoxSubscription && isOrthodoxMode && styles.orthodoxSubtitleActive
            ]}>
              {hasOrthodoxSubscription
                ? (isOrthodoxMode ? 'Tap to switch to regular mode' : 'Tap to switch to Orthodox-only pool')
                : 'Dedicated shidduch matching for observant Jews'}
            </Text>
          </View>
        </View>
        {hasOrthodoxSubscription ? (
          <View style={[
            styles.orthodoxToggle,
            isOrthodoxMode && styles.orthodoxToggleActive,
          ]}>
            <View style={[
              styles.orthodoxToggleKnob,
              isOrthodoxMode && styles.orthodoxToggleKnobActive,
            ]} />
          </View>
        ) : (
          <View style={styles.orthodoxBadge}>
            <Text style={styles.orthodoxBadgeText}>Premium</Text>
          </View>
        )}
      </Pressable>

      {/* Settings Sections */}
      <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}>
        <SettingsItem
          icon="heart-outline"
          label="Discovery Preferences"
          onPress={() => router.push('/settings/preferences')}
        />
        <SettingsItem
          icon="shield-outline"
          label="Privacy & Safety"
          onPress={() => router.push('/settings/privacy')}
        />
        <SettingsItem
          icon="notifications-outline"
          label="Notifications"
          onPress={() => router.push('/settings/notifications')}
        />
      </View>

      <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}>
        <SettingsItem
          icon="moon-outline"
          label="Shabbat Mode"
          onPress={() => Alert.alert('Shabbat Mode', 'Pause your profile from Friday sunset to Saturday night. Coming soon!')}
          rightElement={
            <View style={styles.shabbatToggle}>
              <Text style={styles.shabbatStatus}>Off</Text>
            </View>
          }
        />
      </View>

      <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}>
        <SettingsItem
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() => router.push('/settings/help')}
        />
        <SettingsItem
          icon="document-text-outline"
          label="Terms & Privacy"
          onPress={() => router.push('/legal/terms')}
        />
      </View>

      {/* Logout */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <Text style={styles.versionText}>Mazal v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePreview: {
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  mainPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary.gold,
  },
  photoPlaceholder: {
    backgroundColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: spacing[3],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  verifiedBadge: {
    marginLeft: spacing[1],
  },
  occupation: {
    fontSize: 14,
    marginTop: spacing[1],
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginTop: spacing[4],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    backgroundColor: colors.transparent.gold20,
    borderRadius: borderRadius.full,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  previewButtonText: {
    fontSize: 14,
  },
  saftaLikedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
  },
  saftaLikedEmoji: {
    fontSize: 18,
  },
  saftaLikedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[3],
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  verificationSubtitle: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },
  badgesSection: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  badgesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.secondary.cream,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary.navy,
  },
  addBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary.gold,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.primary.navy,
    borderRadius: borderRadius.xl,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  premiumText: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  premiumSubtitle: {
    fontSize: 13,
    color: colors.transparent.white80,
    marginTop: spacing[0.5],
  },
  // Orthodox Mode styles
  orthodoxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.transparent.gold30,
  },
  orthodoxBannerActive: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  orthodoxContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  orthodoxIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orthodoxText: {
    flex: 1,
  },
  orthodoxTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  orthodoxTitleActive: {
    color: colors.primary.navy,
  },
  orthodoxSubtitle: {
    fontSize: 12,
    color: colors.transparent.gold70,
    marginTop: spacing[0.5],
  },
  orthodoxSubtitleActive: {
    color: colors.transparent.navy70,
  },
  orthodoxBadge: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  orthodoxBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.navy,
    textTransform: 'uppercase',
  },
  orthodoxToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[300],
    padding: 2,
    justifyContent: 'center',
  },
  orthodoxToggleActive: {
    backgroundColor: colors.primary.navy,
  },
  orthodoxToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.white,
  },
  orthodoxToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  settingsSection: {
    marginTop: spacing[4],
    marginHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  settingsItemLabel: {
    fontSize: 16,
  },
  shabbatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  shabbatStatus: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  saftaModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.transparent.gold30,
  },
  saftaModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  saftaModeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saftaModeEmoji: {
    fontSize: 20,
  },
  saftaModeText: {
    flex: 1,
  },
  saftaModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  saftaModeSubtitle: {
    fontSize: 12,
    color: colors.transparent.gold70,
    marginTop: spacing[0.5],
  },
  logoutButton: {
    marginTop: spacing[6],
    marginHorizontal: spacing[4],
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.semantic.error,
  },
  versionText: {
    fontSize: 12,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
});
