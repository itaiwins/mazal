/**
 * Orthodox Onboarding Welcome Screen
 *
 * Welcome new Orthodox users to the onboarding process
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function OrthodoxOnboardingWelcome() {
  const insets = useSafeAreaInsets();
  const starGlow = useSharedValue(0.5);

  useEffect(() => {
    starGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const starStyle = useAnimatedStyle(() => ({
    shadowOpacity: starGlow.value,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52', '#0f1d36', '#0a1628']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Hero */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.heroSection}>
          <Animated.View style={[styles.starContainer, starStyle]}>
            <Text style={styles.starOfDavid}>✡</Text>
          </Animated.View>

          <Text style={styles.hebrewGreeting}>מזל טוב!</Text>
          <Text style={styles.title}>Welcome to{'\n'}Orthodox Shidduch</Text>
          <Text style={styles.subtitle}>
            Let's set up your profile to help you find your bashert
          </Text>
        </Animated.View>

        {/* Steps Preview */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Basic Information</Text>
              <Text style={styles.stepDescription}>Name, age, and location</Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Jewish Background</Text>
              <Text style={styles.stepDescription}>Community, observance level</Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Photos</Text>
              <Text style={styles.stepDescription}>Add photos to your profile</Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Preferences</Text>
              <Text style={styles.stepDescription}>What you're looking for</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Section */}
      <Animated.View
        entering={FadeInDown.delay(300).springify()}
        style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing[4] }]}
      >
        <Pressable
          style={styles.continueButton}
          onPress={() => router.push('/(orthodox-onboarding)/basics')}
        >
          <LinearGradient
            colors={[colors.primary.gold, '#e6c358']}
            style={styles.continueButtonGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          >
            <Text style={styles.continueButtonText}>Begin Setup</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
          </LinearGradient>
        </Pressable>

        <Text style={styles.noteText}>This takes about 5 minutes</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  starContainer: {
    marginBottom: spacing[4],
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 10,
  },
  starOfDavid: {
    fontSize: 56,
    color: colors.primary.gold,
  },
  hebrewGreeting: {
    fontSize: 32,
    color: colors.primary.gold,
    marginBottom: spacing[2],
    letterSpacing: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    textAlign: 'center',
    marginBottom: spacing[3],
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white70,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepsContainer: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderWidth: 1,
    borderColor: colors.primary.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 13,
    color: colors.transparent.white50,
  },
  stepLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    marginLeft: 17,
    marginVertical: spacing[2],
  },
  bottomSection: {
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  continueButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  noteText: {
    fontSize: 14,
    color: colors.transparent.white50,
    textAlign: 'center',
  },
});
