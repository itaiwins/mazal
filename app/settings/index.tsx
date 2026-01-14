/**
 * Settings Index
 *
 * Main settings screen
 */

import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking, Switch, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useDeactivateAccount } from '@/api/mutations/useProfile';

interface SettingItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

function SettingItem({ icon, label, onPress, rightElement, danger }: SettingItemProps) {
  const theme = useTheme();

  return (
    <Pressable style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingItemLeft}>
        <Ionicons
          name={icon as any}
          size={22}
          color={danger ? colors.semantic.error : theme.colors.icon}
        />
        <Text
          style={[
            styles.settingItemLabel,
            { color: danger ? colors.semantic.error : theme.colors.text },
          ]}
        >
          {label}
        </Text>
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);
  const hasSaftaProfile = useAuthStore((s) => s.hasSaftaProfile);

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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Settings
        </Text>
        <View style={styles.headerRight} />
      </View>

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
              icon="person-outline"
              label="Edit Profile"
              onPress={() => router.push('/profile/edit')}
            />
            <SettingItem
              icon="mail-outline"
              label="Email & Phone"
              onPress={() => router.push('/settings/contact')}
            />
            <SettingItem
              icon="key-outline"
              label="Change Password"
              onPress={() => router.push('/settings/password')}
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
              onPress={() => router.push('/settings/preferences')}
            />
            <SettingItem
              icon="location-outline"
              label="Location"
              onPress={() => router.push('/settings/location')}
            />
            <SettingItem
              icon="eye-off-outline"
              label="Hide Profile"
              rightElement={
                <Switch
                  value={false}
                  onValueChange={() => {}}
                  trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
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
              onPress={() => router.push('/settings/privacy')}
            />
            <SettingItem
              icon="hand-left-outline"
              label="Blocked Users"
              onPress={() => router.push('/settings/blocked')}
            />
            <SettingItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/settings/notifications')}
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
              onPress={() => router.push('/settings/help')}
            />
            <SettingItem
              icon="chatbubble-outline"
              label="Contact Us"
              onPress={() => Linking.openURL('mailto:support@mazal.app')}
            />
            <SettingItem
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => router.push('/legal/terms')}
            />
            <SettingItem
              icon="lock-closed-outline"
              label="Privacy Policy"
              onPress={() => router.push('/legal/privacy')}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <SettingItem
              icon="log-out-outline"
              label="Log Out"
              onPress={handleLogout}
              danger
            />
            <SettingItem
              icon="trash-outline"
              label={deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
              onPress={deleteAccountMutation.isPending ? undefined : handleDeleteAccount}
              danger
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
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    marginLeft: spacing[4],
  },
  sectionCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  settingItemLabel: {
    fontSize: 16,
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
