/**
 * Settings Index
 *
 * Main settings screen
 */

import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

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
  const isDarkMode = useUIStore((s) => s.isDarkMode);
  const setDarkMode = useUIStore((s) => s.setDarkMode);
  const logout = useAuthStore((s) => s.logout);

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
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // In production, call Supabase to delete account
            logout();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  const handleBack = () => {
    router.back();
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

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Appearance
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <SettingItem
              icon="moon-outline"
              label="Dark Mode"
              rightElement={
                <Switch
                  value={isDarkMode}
                  onValueChange={setDarkMode}
                  trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                  thumbColor={colors.primary.white}
                />
              }
            />
          </View>
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
              label="Delete Account"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: theme.colors.textTertiary }]}>
          Mazal v1.0.0 (Build 1)
        </Text>
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
});
