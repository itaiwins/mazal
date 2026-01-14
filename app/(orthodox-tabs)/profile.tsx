/**
 * Orthodox Profile Screen
 *
 * View and manage your Orthodox profile
 * Includes Shabbat mode toggle
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

function SettingsItem({
  icon,
  label,
  onPress,
  rightElement,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}) {
  return (
    <Pressable style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIconContainer}>
          <Ionicons name={icon as any} size={20} color={colors.primary.gold} />
        </View>
        <Text style={styles.settingsItemLabel}>{label}</Text>
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={20} color={colors.transparent.white40} />}
    </Pressable>
  );
}

export default function OrthodoxProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);
  const setOrthodoxSubscription = useUIStore((s) => s.setOrthodoxSubscription);

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shabbatModeEnabled, setShabbatModeEnabled] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        // Note: shabbat_mode_enabled column added via migration
        const { data, error } = await (supabase as any)
          .from('users')
          .select(`
            *,
            photos:user_photos(photo_url, photo_order)
          `)
          .eq('id', user.id)
          .single();

        if (error) throw error;

        const primaryPhoto = data?.photos?.find((p: any) => p.photo_order === 0) ||
                            data?.photos?.[0];

        setProfile({
          ...data,
          photo_url: primaryPhoto?.photo_url || null,
          age: data?.date_of_birth
            ? new Date().getFullYear() - new Date(data.date_of_birth).getFullYear()
            : 0,
        });
        setShabbatModeEnabled(data?.shabbat_mode_enabled || false);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  const handleShabbatModeToggle = async (value: boolean) => {
    setShabbatModeEnabled(value);

    if (user?.id) {
      // Note: shabbat_mode_enabled column added via migration
      await (supabase as any)
        .from('users')
        .update({ shabbat_mode_enabled: value })
        .eq('id', user.id);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            logout();
            setOrthodoxMode(false);
            setOrthodoxSubscription(false);
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LinearGradient
          colors={['#0a1628', '#0f1d36', '#1a2d52']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing[2], paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.starOfDavid}>✡</Text>
          <View>
            <Text style={styles.hebrewTitle}>פרופיל</Text>
            <Text style={styles.title}>Your Profile</Text>
          </View>
        </View>

        {/* Profile Card */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.profilePhotoPlaceholder}>
                <Ionicons name="person" size={40} color={colors.neutral[400]} />
              </View>
            )}

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {profile?.first_name}, {profile?.age}
              </Text>
              {profile?.jewish_background && (
                <View style={styles.backgroundBadge}>
                  <Text style={styles.backgroundBadgeText}>
                    {profile.jewish_background.replace(/_/g, ' ')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Pressable
            style={styles.editButton}
            onPress={() => router.push('/profile/edit')}
          >
            <Ionicons name="pencil" size={16} color={colors.primary.gold} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
        </Animated.View>

        {/* Shabbat Mode */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.shabbatCard}>
          <View style={styles.shabbatHeader}>
            <View style={styles.shabbatIcon}>
              <Ionicons name="moon" size={24} color={colors.primary.gold} />
            </View>
            <View style={styles.shabbatInfo}>
              <Text style={styles.shabbatTitle}>Shabbat Mode</Text>
              <Text style={styles.shabbatDescription}>
                Automatically pause your profile from Shabbos candle lighting until havdalah
              </Text>
            </View>
          </View>
          <Switch
            value={shabbatModeEnabled}
            onValueChange={handleShabbatModeToggle}
            trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: colors.primary.gold }}
            thumbColor={colors.primary.white}
          />
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.settingsSection}>
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
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.settingsSection}>
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
        </Animated.View>

        {/* Subscription Info */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <Ionicons name="diamond" size={20} color={colors.primary.gold} />
            <Text style={styles.subscriptionTitle}>Premium Membership</Text>
          </View>
          <Text style={styles.subscriptionStatus}>Active</Text>
        </Animated.View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.semantic.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.versionText}>Orthodox Shidduch v1.0.0</Text>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  starOfDavid: {
    fontSize: 40,
    color: colors.primary.gold,
  },
  hebrewTitle: {
    fontSize: 20,
    color: colors.primary.gold,
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: spacing[4],
    gap: spacing[4],
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.primary.gold,
  },
  profilePhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  backgroundBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  backgroundBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary.gold,
    textTransform: 'capitalize',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  shabbatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: spacing[4],
  },
  shabbatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    flex: 1,
    marginRight: spacing[3],
  },
  shabbatIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shabbatInfo: {
    flex: 1,
  },
  shabbatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: 4,
  },
  shabbatDescription: {
    fontSize: 12,
    color: colors.transparent.white60,
    lineHeight: 16,
  },
  settingsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  settingsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsItemLabel: {
    fontSize: 15,
    color: colors.primary.white,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.primary.gold,
    marginBottom: spacing[6],
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  subscriptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  subscriptionStatus: {
    fontSize: 14,
    color: colors.semantic.success,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  logoutText: {
    fontSize: 16,
    color: colors.semantic.error,
    fontWeight: '500',
  },
  versionText: {
    fontSize: 12,
    color: colors.transparent.white40,
    textAlign: 'center',
    marginTop: spacing[2],
  },
});
