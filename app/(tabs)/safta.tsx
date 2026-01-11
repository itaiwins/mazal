/**
 * Safta Mode Tab
 *
 * Main entry point for Safta Mode - for parents/grandparents to help find matches
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function SaftaTabScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleInviteFamily = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(safta)/setup');
  };

  const handleEnterAsFamily = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(safta)/connect');
  };

  const handleLearnMore = () => {
    router.push('/(safta)');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Safta Mode</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Let your family help you find love
        </Text>
      </Animated.View>

      {/* Hero Illustration */}
      <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.heroContainer}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>👵</Text>
          <Animated.View entering={ZoomIn.delay(500).springify()} style={styles.heroHeart}>
            <Text style={styles.heroHeartEmoji}>💛</Text>
          </Animated.View>
          <Text style={styles.heroEmoji}>👴</Text>
        </View>
      </Animated.View>

      {/* Explanation */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.explanationCard}>
        <Text style={[styles.explanationTitle, { color: theme.colors.text }]}>
          What is Safta Mode?
        </Text>
        <Text style={[styles.explanationText, { color: theme.colors.textSecondary }]}>
          Safta Mode lets your parents or grandparents browse profiles and send
          you their recommendations. They can use your preferences or set their own filters.
          It's like having your own personal matchmaker!
        </Text>
      </Animated.View>

      {/* Features */}
      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.featuresContainer}>
        <View style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.featureIcon}>
            <Ionicons name="options" size={24} color={colors.primary.gold} />
          </View>
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Flexible Filters</Text>
            <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
              Use your preferences or let them set their own search criteria
            </Text>
          </View>
        </View>

        <View style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.featureIcon}>
            <Ionicons name="people" size={24} color={colors.primary.gold} />
          </View>
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Browse All Profiles</Text>
            <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
              They can see anyone matching the filters, not just passed profiles
            </Text>
          </View>
        </View>

        <View style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.featureIcon}>
            <Ionicons name="heart" size={24} color={colors.primary.gold} />
          </View>
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Their Wisdom</Text>
            <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
              Get recommendations with heartfelt notes from family
            </Text>
          </View>
        </View>

        <View style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.featureIcon}>
            <Ionicons name="notifications" size={24} color={colors.primary.gold} />
          </View>
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Stay Updated</Text>
            <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
              Get notified when family sends you a recommendation
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.actionsContainer}>
        <Pressable style={styles.primaryButton} onPress={handleInviteFamily}>
          <Ionicons name="person-add" size={20} color={colors.primary.navy} />
          <Text style={styles.primaryButtonText}>Invite Family Member</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.primary.gold }]}
          onPress={handleEnterAsFamily}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary.gold }]}>
            I'm a Parent/Grandparent
          </Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={handleLearnMore}>
          <Text style={[styles.linkButtonText, { color: theme.colors.textSecondary }]}>
            Learn more about Safta Mode
          </Text>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.textSecondary} />
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  heroEmoji: {
    fontSize: 56,
  },
  heroHeart: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroHeartEmoji: {
    fontSize: 18,
  },
  explanationCard: {
    marginBottom: spacing[6],
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  featuresContainer: {
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[4],
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    marginBottom: spacing[1],
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsContainer: {
    gap: spacing[3],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    gap: spacing[1],
  },
  linkButtonText: {
    fontSize: 14,
  },
});
