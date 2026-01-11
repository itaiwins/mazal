/**
 * Notifications Screen
 *
 * Enable push notifications
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { registerForPushNotifications, savePushToken } from '@/lib/notifications';
import { useAuthStore } from '@/stores/authStore';

const NOTIFICATION_BENEFITS = [
  {
    icon: 'heart',
    title: 'New matches',
    description: "Know instantly when someone likes you back",
  },
  {
    icon: 'chatbubbles',
    title: 'Messages',
    description: "Never miss a message from your matches",
  },
  {
    icon: 'star',
    title: 'Super Likes',
    description: "Get notified when someone super likes you",
  },
  {
    icon: 'flame',
    title: 'Daily picks',
    description: "We'll send you curated matches daily",
  },
];

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isRequesting, setIsRequesting] = useState(false);
  const user = useAuthStore((s) => s.user);

  const requestNotifications = async () => {
    setIsRequesting(true);
    try {
      // Register for push notifications
      const token = await registerForPushNotifications();

      if (token && user?.id) {
        // Save token to Supabase
        await savePushToken(user.id, token);
        console.log('Push token saved:', token);
      }

      // Continue regardless of permission status
      router.push('/(onboarding)/complete');
    } catch (error) {
      console.error('Error requesting notifications:', error);
      router.push('/(onboarding)/complete');
    } finally {
      setIsRequesting(false);
    }
  };

  const skipNotifications = () => {
    router.push('/(onboarding)/complete');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[16],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Animated.View
          entering={FadeInUp.delay(100).springify()}
          style={styles.iconContainer}
        >
          <Ionicons name="notifications" size={48} color={colors.primary.gold} />
        </Animated.View>
        <Animated.Text
          entering={FadeInUp.delay(200).springify()}
          style={[styles.title, { color: theme.colors.text }]}
        >
          Never miss a match
        </Animated.Text>
        <Animated.Text
          entering={FadeInUp.delay(300).springify()}
          style={[styles.subtitle, { color: theme.colors.textSecondary }]}
        >
          Enable notifications to know when something exciting happens
        </Animated.Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefits}>
        {NOTIFICATION_BENEFITS.map((benefit, index) => (
          <Animated.View
            key={benefit.title}
            entering={FadeInUp.delay(400 + index * 100).springify()}
            style={[styles.benefitItem, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.benefitIcon}>
              <Ionicons
                name={benefit.icon as any}
                size={22}
                color={colors.primary.gold}
              />
            </View>
            <View style={styles.benefitContent}>
              <Text style={[styles.benefitTitle, { color: theme.colors.text }]}>
                {benefit.title}
              </Text>
              <Text
                style={[styles.benefitDescription, { color: theme.colors.textSecondary }]}
              >
                {benefit.description}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.enableButton, isRequesting && styles.enableButtonDisabled]}
          onPress={requestNotifications}
          disabled={isRequesting}
        >
          <Ionicons name="notifications" size={20} color={colors.primary.navy} />
          <Text style={styles.enableButtonText}>
            {isRequesting ? 'Setting up...' : 'Enable Notifications'}
          </Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={skipNotifications}>
          <Text style={[styles.skipButtonText, { color: theme.colors.textSecondary }]}>
            Maybe later
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  benefits: {
    flex: 1,
    gap: spacing[3],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[0.5],
  },
  benefitDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    gap: spacing[3],
    paddingTop: spacing[4],
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  enableButtonDisabled: {
    opacity: 0.7,
  },
  enableButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
