/**
 * Welcome Screen
 *
 * Onboarding intro with value proposition
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const FEATURES = [
  { icon: 'heart', label: 'Find your bashert', delay: 200 },
  { icon: 'shield-checkmark', label: 'Jewish-verified community', delay: 400 },
  { icon: 'star', label: 'Unique matching algorithm', delay: 600 },
];

export default function OnboardingWelcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    router.push('/(onboarding)/basics');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[8],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Animated.Text
          entering={FadeInUp.delay(100).springify()}
          style={[styles.title, { color: theme.colors.text }]}
        >
          Let's create{'\n'}your profile
        </Animated.Text>
        <Animated.Text
          entering={FadeInUp.delay(200).springify()}
          style={[styles.subtitle, { color: theme.colors.textSecondary }]}
        >
          It only takes a few minutes to set up your profile and start meeting
          amazing Jewish singles
        </Animated.Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {FEATURES.map((feature, index) => (
          <Animated.View
            key={feature.label}
            entering={FadeInDown.delay(feature.delay).springify()}
            style={styles.featureItem}
          >
            <View style={styles.featureIcon}>
              <Ionicons
                name={feature.icon as any}
                size={24}
                color={colors.primary.gold}
              />
            </View>
            <Text style={[styles.featureLabel, { color: theme.colors.text }]}>
              {feature.label}
            </Text>
          </Animated.View>
        ))}
      </View>

      {/* Illustration placeholder */}
      <Animated.View
        entering={FadeInUp.delay(400).springify()}
        style={styles.illustrationContainer}
      >
        <View style={styles.illustration}>
          <Text style={styles.illustrationEmoji}>✡️</Text>
          <View style={styles.hearts}>
            <Text style={styles.heartEmoji}>💛</Text>
            <Text style={[styles.heartEmoji, styles.heartOffset]}>💛</Text>
          </View>
        </View>
      </Animated.View>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInDown.delay(600).springify()}
        style={styles.footer}
      >
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Let's Go</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
        </Pressable>

        <Text style={[styles.privacyNote, { color: theme.colors.textTertiary }]}>
          Your information is private and secure
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
    marginBottom: spacing[8],
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    marginBottom: spacing[3],
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  features: {
    gap: spacing[4],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  featureLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    alignItems: 'center',
  },
  illustrationEmoji: {
    fontSize: 80,
  },
  hearts: {
    flexDirection: 'row',
    marginTop: -spacing[4],
  },
  heartEmoji: {
    fontSize: 32,
  },
  heartOffset: {
    marginLeft: -spacing[2],
    marginTop: spacing[2],
  },
  footer: {
    gap: spacing[4],
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  privacyNote: {
    fontSize: 13,
    textAlign: 'center',
  },
});
