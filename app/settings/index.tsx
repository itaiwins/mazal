/**
 * Settings Index
 *
 * Premium settings screen with enhanced design
 */

import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking, Switch, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useDeactivateAccount } from '@/api/mutations/useProfile';
import { useUserProfile } from '@/api/queries';

interface SettingItemProps {
  icon: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
  index?: number;
}

function SettingItem({ icon, label, subtitle, onPress, rightElement, danger, index = 0 }: SettingItemProps) {
  const theme = useTheme();

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.settingItem,
          pressed && styles.settingItemPressed,
        ]}
        onPress={() => {
          if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }
        }}
      >
        <View style={styles.settingItemLeft}>
          <View style={[
            styles.settingIconContainer,
            { backgroundColor: danger ? colors.transparent.error10 : colors.transparent.gold10 }
          ]}>
            <Ionicons
              name={icon as any}
              size={20}
              color={danger ? colors.semantic.error : colors.primary.gold}
            />
          </View>
          <View>
            <Text
              style={[
                styles.settingItemLabel,
                { color: danger ? colors.semantic.error : theme.colors.text },
              ]}
            >
              {label}
            </Text>
            {subtitle && (
              <Text style={[styles.settingItemSubtitle, { color: theme.colors.textSecondary }]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {rightElement || (
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[400]} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);
  const hasSaftaProfile = useAuthStore((s) => s.hasSaftaProfile);

  // Fetch user profile for avatar
  const { data: userProfile } = useUserProfile();
  const primaryPhoto = userProfile?.photos?.find((p) => p.photo_order === 0)?.photo_url ||
                       userProfile?.photos?.[0]?.photo_url || null;

  // Shabbat mode
  const isShabbatModeEnabled = useUIStore((s) => s.isShabbatModeEnabled);
  const setShabbatModeEnabled = useUIStore((s) => s.setShabbatModeEnabled);

  // Demo mode (for screenshots)
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const setDemoMode = useUIStore((s) => s.setDemoMode);
  const [showDeveloperOptions, setShowDeveloperOptions] = useState(false);
  const versionTapCount = useRef(0);
  const lastTapTime = useRef(0);

  // Account deletion mutation
  const deleteAccountMutation = useDeactivateAccount();

  const handleSwitchToSafta = () => {
    if (hasSaftaProfile) {
      // Already has Safta profile, switch directly
      setCurrentMode('safta');
      router.replace('/(safta-tabs)');
    } else {
      // Needs to complete Safta onboarding
      setCurrentMode('safta');
      router.replace('/(safta-auth)/welcome');
    }
  };

  const handleShabbatModeToggle = (enabled: boolean) => {
    setShabbatModeEnabled(enabled);
    if (enabled) {
      Alert.alert(
        'Shabbat Mode Enabled',
        'The app will automatically pause notifications and activity from Friday sunset to Saturday nightfall based on your location.\n\nShabbat Shalom!',
        [{ text: 'OK' }]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    const hasMultipleAccounts = hasSaftaProfile;
    const message = hasMultipleAccounts
      ? 'This will permanently delete BOTH your dating profile AND your Safta account. All your data, matches, messages, and photos will be removed. This action cannot be undone.'
      : 'This action cannot be undone. All your data, matches, messages, and photos will be permanently deleted.';

    Alert.alert('Delete Account', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Everything',
        style: 'destructive',
        onPress: () => {
          deleteAccountMutation.mutate(true, {
            onSuccess: () => {
              router.replace('/(auth)/welcome');
            },
            onError: (error) => {
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again or contact support.',
                [{ text: 'OK' }]
              );
              console.error('Delete account error:', error);
            },
          });
        },
      },
    ]);
  };

  const handleBack = () => {
    router.back();
  };

  const handleVersionTap = () => {
    const now = Date.now();
    // Reset counter if more than 2 seconds since last tap
    if (now - lastTapTime.current > 2000) {
      versionTapCount.current = 0;
    }
    lastTapTime.current = now;
    versionTapCount.current += 1;

    if (versionTapCount.current === 5) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeveloperOptions(true);
      Alert.alert(
        'Developer Options Enabled',
        'You can now access demo mode for screenshots.',
        [{ text: 'OK' }]
      );
    } else if (versionTapCount.current >= 3 && versionTapCount.current < 5) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleDemoModeToggle = (enabled: boolean) => {
    setDemoMode(enabled);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      enabled ? 'Demo Mode Enabled' : 'Demo Mode Disabled',
      enabled
        ? 'The app will now show fake profiles for screenshots. Swipe actions won\'t affect real data.'
        : 'Returning to normal mode with real profiles.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[colors.primary.navy, colors.dark.background]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Profile Card */}
        <Animated.View entering={FadeInDown.springify()} style={styles.profileCard}>
          <Pressable
            style={styles.profileCardContent}
            onPress={() => router.push('/profile/edit')}
          >
            {primaryPhoto ? (
              <Image source={{ uri: primaryPhoto }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
                <Ionicons name="person" size={28} color={colors.neutral[400]} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {userProfile?.first_name || user?.first_name || 'User'}
              </Text>
              <Text style={styles.profileSubtitle}>View and edit profile</Text>
            </View>
            <View style={styles.profileArrow}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
            </View>
          </Pressable>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Account
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <SettingItem
              icon="mail-outline"
              label="Email & Phone"
              subtitle="Manage your contact info"
              onPress={() => router.push('/settings/contact')}
              index={0}
            />
            <SettingItem
              icon="key-outline"
              label="Change Password"
              subtitle="Update your password"
              onPress={() => router.push('/settings/password')}
              index={1}
            />
          </View>
        </View>

        {/* Discovery */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Discovery
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <SettingItem
              icon="heart-outline"
              label="Discovery Preferences"
              subtitle="Age, distance, and more"
              onPress={() => router.push('/settings/preferences')}
              index={2}
            />
            <SettingItem
              icon="location-outline"
              label="Location"
              subtitle="Update your location"
              onPress={() => router.push('/settings/location')}
              index={3}
            />
            <SettingItem
              icon="eye-off-outline"
              label="Hide Profile"
              subtitle="Pause your visibility"
              index={4}
              rightElement={
                <Switch
                  value={false}
                  onValueChange={() => {}}
                  trackColor={{ false: colors.neutral[300], true: colors.primary.gold }}
                  thumbColor={colors.primary.white}
                />
              }
            />
          </View>
        </View>

        {/* Shabbat Mode */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Jewish Life
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.shabbatModeItem}>
              <View style={styles.shabbatModeInfo}>
                <View style={styles.shabbatModeHeader}>
                  <Text style={styles.shabbatEmoji}>🕯️</Text>
                  <Text style={[styles.shabbatModeLabel, { color: theme.colors.text }]}>
                    Shabbat Mode
                  </Text>
                </View>
                <Text style={[styles.shabbatModeDesc, { color: theme.colors.textSecondary }]}>
                  Automatically pause the app from Friday sunset to Saturday nightfall
                </Text>
              </View>
              <Switch
                value={isShabbatModeEnabled}
                onValueChange={handleShabbatModeToggle}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </View>

        {/* Safta Mode */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Safta Mode
          </Text>
          <Pressable
            style={[styles.saftaModeCard, { backgroundColor: colors.transparent.gold10 }]}
            onPress={handleSwitchToSafta}
          >
            <View style={styles.saftaModeContent}>
              <View style={[styles.saftaModeIcon, { backgroundColor: colors.transparent.gold20 }]}>
                <Text style={styles.saftaModeEmoji}>👵</Text>
              </View>
              <View style={styles.saftaModeText}>
                <Text style={[styles.saftaModeTitle, { color: colors.primary.gold }]}>
                  Switch to Safta Mode
                </Text>
                <Text style={[styles.saftaModeDesc, { color: theme.colors.textSecondary }]}>
                  Help your loved ones find their match
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
          </Pressable>
        </View>

        {/* Privacy & Safety */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Privacy & Safety
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <SettingItem
              icon="shield-outline"
              label="Privacy Settings"
              subtitle="Control who sees your info"
              onPress={() => router.push('/settings/privacy')}
              index={5}
            />
            <SettingItem
              icon="hand-left-outline"
              label="Blocked Users"
              subtitle="Manage blocked profiles"
              onPress={() => router.push('/settings/blocked')}
              index={6}
            />
            <SettingItem
              icon="notifications-outline"
              label="Notifications"
              subtitle="Push and email alerts"
              onPress={() => router.push('/settings/notifications')}
              index={7}
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Support
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <SettingItem
              icon="help-circle-outline"
              label="Help & FAQ"
              subtitle="Common questions"
              onPress={() => router.push('/settings/help')}
              index={8}
            />
            <SettingItem
              icon="chatbubble-outline"
              label="Contact Us"
              subtitle="Get in touch"
              onPress={() => Linking.openURL('mailto:support@mazaldating.com')}
              index={9}
            />
            <SettingItem
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => router.push('/legal/terms')}
              index={10}
            />
            <SettingItem
              icon="lock-closed-outline"
              label="Privacy Policy"
              onPress={() => router.push('/legal/privacy')}
              index={11}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.semantic.error }]}>
            Danger Zone
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <SettingItem
              icon="log-out-outline"
              label="Log Out"
              onPress={handleLogout}
              danger
              index={12}
            />
            <SettingItem
              icon="trash-outline"
              label={deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
              subtitle="Permanently remove your account"
              onPress={deleteAccountMutation.isPending ? undefined : handleDeleteAccount}
              danger
              index={13}
              rightElement={deleteAccountMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.semantic.error} />
              ) : undefined}
            />
          </View>
        </View>

        {/* Developer Options (hidden until version tapped 5 times) */}
        {showDeveloperOptions && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.semantic.warning }]}>
              Developer Options
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.shabbatModeItem}>
                <View style={styles.shabbatModeInfo}>
                  <View style={styles.shabbatModeHeader}>
                    <Ionicons name="camera-outline" size={18} color={colors.semantic.warning} />
                    <Text style={[styles.shabbatModeLabel, { color: theme.colors.text }]}>
                      Demo Mode
                    </Text>
                  </View>
                  <Text style={[styles.shabbatModeDesc, { color: theme.colors.textSecondary }]}>
                    Show fake profiles for App Store screenshots
                  </Text>
                </View>
                <Switch
                  value={isDemoMode}
                  onValueChange={handleDemoModeToggle}
                  trackColor={{ false: colors.neutral[200], true: colors.semantic.warning }}
                  thumbColor={colors.primary.white}
                />
              </View>
            </View>
          </View>
        )}

        {/* Version */}
        <Pressable onPress={handleVersionTap}>
          <Text style={[styles.version, { color: theme.colors.textTertiary }]}>
            Mazal v1.0.0 (Build 1)
            {isDemoMode && ' [DEMO MODE]'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  headerRight: {
    width: 44,
  },
  // Profile card styles
  profileCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white20,
    overflow: 'hidden',
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  profileAvatarPlaceholder: {
    backgroundColor: colors.neutral[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
  },
  profileSubtitle: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: spacing[0.5],
  },
  profileArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[2],
    marginLeft: spacing[2],
  },
  sectionCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  settingItemPressed: {
    backgroundColor: colors.transparent.white05,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingItemLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingItemSubtitle: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing[6],
    marginBottom: spacing[4],
  },
  // Shabbat Mode styles
  shabbatModeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  shabbatModeInfo: {
    flex: 1,
    marginRight: spacing[4],
  },
  shabbatModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  shabbatEmoji: {
    fontSize: 18,
  },
  shabbatModeLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  shabbatModeDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: spacing[6],
  },
  // Safta Mode styles
  saftaModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
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
  saftaModeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saftaModeEmoji: {
    fontSize: 22,
  },
  saftaModeText: {
    flex: 1,
  },
  saftaModeTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  saftaModeDesc: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },
});
