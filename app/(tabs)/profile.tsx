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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';

// Sample profile data for demo
const SAMPLE_PROFILE = {
  first_name: 'Alex',
  age: 28,
  bio: 'Software engineer by day, amateur chef by night. Looking for someone to share Shabbat dinners and Sunday brunches with.',
  photos: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
  ],
  jewish_background: 'Conservative',
  occupation: 'Software Engineer',
  school: 'NYU',
  prompts: [
    { question: 'My Shabbat looks like...', answer: 'Friends, wine, and homemade challah' },
    { question: 'Best Jewish food take:', answer: 'Katz\'s pastrami is overrated. Fight me.' },
  ],
  badges: ['birthright', 'hebrew_speaker'],
  is_verified: true,
  is_premium: false,
};

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
  const profile = SAMPLE_PROFILE; // In production, use actual user data

  const handleLogout = async () => {
    // Handle logout
    router.replace('/(auth)/welcome');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.icon} />
        </Pressable>
      </View>

      {/* Profile Preview */}
      <View style={styles.profilePreview}>
        <Image
          source={{ uri: profile.photos[0] }}
          style={styles.mainPhoto}
        />
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
          icon="people-outline"
          label="Invite Family (Safta Mode)"
          onPress={() => router.push('/(safta)')}
        />
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
