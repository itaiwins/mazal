/**
 * Safta Mode Welcome
 *
 * Introduction to grandparent matchmaking feature
 */

import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const FEATURES = [
  {
    icon: 'heart',
    title: 'Browse for them',
    description: 'See potential matches and send your approval',
  },
  {
    icon: 'send',
    title: 'Suggest matches',
    description: "Send profiles you think they'd love",
  },
  {
    icon: 'notifications',
    title: 'Get updates',
    description: 'Know when they match with someone special',
  },
];

export default function SaftaWelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(safta)/setup');
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
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Hero */}
        <Animated.View
          entering={FadeInUp.delay(100).springify()}
          style={styles.heroContainer}
        >
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>👵</Text>
            <Animated.View
              entering={ZoomIn.delay(400).springify()}
              style={styles.heroHeart}
            >
              <Text style={styles.heroHeartEmoji}>💛</Text>
            </Animated.View>
            <Text style={styles.heroEmoji2}>👴</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeInUp.delay(200).springify()}
          style={styles.titleContainer}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Safta Mode
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Let your family help you find love! Invite your grandparents (or
            parents) to browse and suggest matches for you.
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
      </View>

      {/* Footer */}
      <Animated.View
        entering={FadeInDown.delay(600).springify()}
        style={styles.footer}
      >
        <Pressable style={styles.getStartedButton} onPress={handleGetStarted}>
          <Text style={styles.getStartedText}>Invite Family Member</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
        </Pressable>

        <Text style={[styles.privacyNote, { color: theme.colors.textTertiary }]}>
          They can only see profiles you've already passed on.
          {'\n'}Your privacy is always protected.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -spacing[2],
  },
  content: {
    flex: 1,
  },
  heroContainer: {
    alignItems: 'center',
    marginVertical: spacing[6],
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  heroEmoji: {
    fontSize: 64,
  },
  heroEmoji2: {
    fontSize: 64,
  },
  heroHeart: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -16,
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  features: {
    gap: spacing[3],
  },
  featureItem: {
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[0.5],
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    gap: spacing[4],
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  privacyNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
