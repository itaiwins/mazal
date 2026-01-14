/**
 * Orthodox Mode Welcome
 *
 * Introduction to Orthodox-specific features
 * Shows paywall for non-subscribers
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useUIStore } from '@/stores/uiStore';
import { StarOfDavid } from '@/components/icons/StarOfDavid';

const FEATURES = [
  {
    icon: 'document-text',
    title: 'Shidduch Profiles',
    description: 'Detailed profiles with hashkafa, yichus, and references',
  },
  {
    icon: 'people',
    title: 'Shadchan Connect',
    description: 'Connect with verified shadchanim for guidance',
  },
  {
    icon: 'shield-checkmark',
    title: 'Tznius Guidelines',
    description: 'Community-appropriate photo standards',
  },
  {
    icon: 'star-of-david',
    title: 'Hashkafa Matching',
    description: 'Match based on religious values and practice',
  },
];

const HASHKAFOS = [
  'Yeshivish',
  'Modern Orthodox Machmir',
  'Modern Orthodox',
  'Chassidish',
  'Sephardic',
  'Litvish',
];

export default function OrthodoxWelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hasOrthodoxSubscription = useUIStore((s) => s.hasOrthodoxSubscription);

  const handleGetStarted = () => {
    if (hasOrthodoxSubscription) {
      router.push('/(orthodox)/shidduch');
    } else {
      router.push('/(orthodox)/paywall');
    }
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
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          entering={FadeInUp.delay(100).springify()}
          style={styles.heroContainer}
        >
          <View style={styles.hero}>
            <StarOfDavid size={48} color={colors.primary.gold} />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInUp.delay(200).springify()}
          style={styles.titleContainer}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Orthodox Mode
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            A dedicated space for shomer shabbos singles with enhanced
            privacy and hashkafa-based matching
          </Text>
        </Animated.View>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={feature.title}
              entering={FadeInDown.delay(300 + index * 100).springify()}
              style={[styles.featureItem, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.featureIcon}>
                <Ionicons
                  name={feature.icon as any}
                  size={22}
                  color={colors.primary.gold}
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                  {feature.title}
                </Text>
                <Text
                  style={[
                    styles.featureDescription,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {feature.description}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Hashkafos */}
        <Animated.View
          entering={FadeInDown.delay(700).springify()}
          style={styles.hashkafaSection}
        >
          <Text style={[styles.hashkafaLabel, { color: theme.colors.textSecondary }]}>
            Available hashkafos:
          </Text>
          <View style={styles.hashkafaList}>
            {HASHKAFOS.map((hashkafa) => (
              <View
                key={hashkafa}
                style={[styles.hashkafaChip, { backgroundColor: colors.secondary.cream }]}
              >
                <Text style={styles.hashkafaText}>{hashkafa}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Info Card */}
        <Animated.View
          entering={FadeInDown.delay(800).springify()}
          style={[styles.infoCard, { backgroundColor: colors.transparent.gold20 }]}
        >
          <Ionicons name="lock-closed" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            Orthodox Mode is only visible to other Orthodox Mode users.
            Your privacy and tznius are our priority.
          </Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(900).springify()}>
          <Pressable style={styles.ctaButton} onPress={handleGetStarted}>
            <Text style={styles.ctaButtonText}>Set Up Shidduch Profile</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
          </Pressable>
        </Animated.View>
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
    paddingHorizontal: spacing[4],
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
  },
  heroContainer: {
    alignItems: 'center',
    marginVertical: spacing[4],
  },
  hero: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 48,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
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
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[0.5],
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  hashkafaSection: {
    marginBottom: spacing[6],
  },
  hashkafaLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  hashkafaList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  hashkafaChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  hashkafaText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary.navy,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
