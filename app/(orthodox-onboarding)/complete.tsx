/**
 * Orthodox Onboarding - Complete Screen
 *
 * Congratulations screen after completing onboarding
 */

import { useEffect } from 'react';
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
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function OrthodoxOnboardingComplete() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const starScale = useSharedValue(0);
  const starRotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Star entrance animation
    starScale.value = withSpring(1, { damping: 10, stiffness: 100 });

    // Continuous rotation
    starRotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );

    // Glow pulse
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Mark onboarding complete in database
    const markComplete = async () => {
      if (user?.id) {
        await supabase
          .from('users')
          .update({
            onboarding_complete: true,
            is_active: true,
          })
          .eq('id', user.id);
      }
    };

    markComplete();
  }, []);

  const starStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: starScale.value },
      { rotate: `${starRotation.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const handleContinue = () => {
    router.replace('/(orthodox-tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52', '#0f1d36', '#0a1628']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Animated Star */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.starSection}>
          <Animated.View style={[styles.starContainer, starStyle, glowStyle]}>
            <Text style={styles.starOfDavid}>✡</Text>
          </Animated.View>
        </Animated.View>

        {/* Congratulations Text */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.textSection}>
          <Text style={styles.hebrewBlessing}>מזל טוב!</Text>
          <Text style={styles.title}>You're All Set!</Text>
          <Text style={styles.subtitle}>
            Your Orthodox Shidduch profile is ready.{'\n'}
            May you find your bashert b'sha'ah tovah.
          </Text>
        </Animated.View>

        {/* Features Summary */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.featuresSection}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>✡</Text>
            </View>
            <Text style={styles.featureText}>Browse Orthodox-only profiles</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="people" size={18} color={colors.primary.gold} />
            </View>
            <Text style={styles.featureText}>Connect with shadchanim</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="moon" size={18} color={colors.primary.gold} />
            </View>
            <Text style={styles.featureText}>Automatic Shabbat mode enabled</Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Section */}
      <Animated.View
        entering={FadeInDown.delay(400).springify()}
        style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing[4] }]}
      >
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <LinearGradient
            colors={[colors.primary.gold, '#e6c358']}
            style={styles.continueButtonGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          >
            <Text style={styles.continueButtonText}>Start Finding Your Match</Text>
            <Ionicons name="heart" size={20} color={colors.primary.navy} />
          </LinearGradient>
        </Pressable>

        <Text style={styles.hebrewWish}>בהצלחה רבה</Text>
        <Text style={styles.englishWish}>Wishing you great success</Text>
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
    alignItems: 'center',
  },
  starSection: {
    marginBottom: spacing[8],
  },
  starContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 30,
    elevation: 15,
  },
  starOfDavid: {
    fontSize: 80,
    color: colors.primary.gold,
  },
  textSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  hebrewBlessing: {
    fontSize: 40,
    color: colors.primary.gold,
    marginBottom: spacing[2],
    letterSpacing: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[3],
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white70,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    width: '100%',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    gap: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconText: {
    fontSize: 18,
    color: colors.primary.gold,
  },
  featureText: {
    fontSize: 15,
    color: colors.primary.white,
    flex: 1,
  },
  bottomSection: {
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  continueButton: {
    width: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: spacing[4],
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
  hebrewWish: {
    fontSize: 20,
    color: colors.primary.gold,
    letterSpacing: 2,
  },
  englishWish: {
    fontSize: 13,
    color: colors.transparent.white50,
    fontStyle: 'italic',
  },
});
