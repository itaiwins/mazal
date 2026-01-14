/**
 * Safta Welcome Screen
 *
 * Welcome screen for parents/grandparents who want to help find matches
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';

const { width } = Dimensions.get('window');

export default function SaftaWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSaftaProfile = useAuthStore((s) => s.hasSaftaProfile);

  // If user is already authenticated, skip to profile setup
  useEffect(() => {
    if (isAuthenticated && !hasSaftaProfile) {
      console.log('[Safta Welcome] User already authenticated, going to profile setup');
      router.replace('/(safta-auth)/profile-setup');
    } else if (isAuthenticated && hasSaftaProfile) {
      console.log('[Safta Welcome] User already has Safta profile, going to tabs');
      router.replace('/(safta-tabs)');
    }
  }, [isAuthenticated, hasSaftaProfile]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d52', colors.primary.navy]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Back button */}
      <Pressable
        style={[styles.backButton, { top: insets.top + spacing[2] }]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
      </Pressable>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.heroSection}>
          <Text style={styles.heroEmoji}>👵💛👴</Text>
          <Text style={styles.title}>Safta Mode</Text>
          <Text style={styles.subtitle}>
            Help your child or grandchild find their bashert
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.featuresContainer}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="search" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Browse Profiles</Text>
              <Text style={styles.featureDescription}>
                View potential matches for your family member
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="heart" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Send Recommendations</Text>
              <Text style={styles.featureDescription}>
                Share profiles you think would be a good match
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="chatbubbles" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Stay Connected</Text>
              <Text style={styles.featureDescription}>
                Message your family about potential matches
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Bottom buttons */}
      <Animated.View
        entering={FadeInDown.delay(300).springify()}
        style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing[4] }]}
      >
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(safta-auth)/signup')}
        >
          <Text style={styles.primaryButtonText}>Create Free Account</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(safta-auth)/enter-code')}
        >
          <Text style={styles.secondaryButtonText}>I Have an Invite Link</Text>
        </Pressable>

        <Text style={styles.noteText}>
          After signing up, your family member can share a link with you to connect their profile
        </Text>

        {/* Sign in link */}
        <View style={styles.signInRow}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <Pressable onPress={() => router.push('/(safta-auth)/login')}>
            <Text style={styles.signInLink}>Sign In</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.navy,
  },
  backButton: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 17,
    color: colors.transparent.white70,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    gap: spacing[4],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    paddingTop: spacing[1],
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[1],
  },
  featureDescription: {
    fontSize: 14,
    color: colors.transparent.white60,
    lineHeight: 20,
  },
  bottomSection: {
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  primaryButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary.white,
  },
  secondaryButtonText: {
    color: colors.primary.white,
    fontSize: 17,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 13,
    color: colors.transparent.white50,
    textAlign: 'center',
    marginTop: spacing[2],
    lineHeight: 18,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[4],
  },
  signInText: {
    color: colors.transparent.white60,
    fontSize: 15,
  },
  signInLink: {
    color: colors.primary.gold,
    fontSize: 15,
    fontWeight: '600',
  },
});
