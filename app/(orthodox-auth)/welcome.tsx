/**
 * Orthodox Welcome Screen
 *
 * A beautiful, modern welcome screen for Orthodox Jewish users
 * Features Hebrew elements, dark elegant theme, and premium feel
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ScrollView } from 'react-native';
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
  withDelay,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const { width } = Dimensions.get('window');

// Animated Star of David
function AnimatedStarOfDavid() {
  const rotation = useSharedValue(0);
  const glow = useSharedValue(0.3);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );

    glow.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    shadowOpacity: glow.value,
  }));

  return (
    <Animated.View style={[styles.starContainer, animatedStyle]}>
      <Text style={styles.starOfDavid}>✡</Text>
    </Animated.View>
  );
}

// Floating Hebrew letter
function FloatingHebrew({ letter, x, delay }: { letter: string; x: number; delay: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.15, { duration: 1000 }));

    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(10, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.floatingHebrew, { left: x }, animatedStyle]}>
      {letter}
    </Animated.Text>
  );
}

// Hebrew letters for background decoration
const hebrewLetters = ['מ', 'ז', 'ל', 'ש', 'י', 'ד', 'ו', 'כ'];

export default function OrthodoxWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hasOrthodoxSubscription = useUIStore((s) => s.hasOrthodoxSubscription);

  // Check if user is already an Orthodox user
  useEffect(() => {
    // Note: is_orthodox_user property added via migration - cast to any for type check
    if (isAuthenticated && (user as any)?.is_orthodox_user && hasOrthodoxSubscription) {
      router.replace('/(orthodox-tabs)');
    }
  }, [isAuthenticated, user, hasOrthodoxSubscription]);

  return (
    <View style={styles.container}>
      {/* Dark gradient background */}
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52', '#0f1d36', '#0a1628']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Floating Hebrew letters in background */}
      {hebrewLetters.map((letter, i) => (
        <FloatingHebrew
          key={letter}
          letter={letter}
          x={(i * (width - 40)) / hebrewLetters.length + 20}
          delay={i * 300}
        />
      ))}

      {/* Back button */}
      <Pressable
        style={[styles.backButton, { top: insets.top + spacing[2] }]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.heroSection}>
          <AnimatedStarOfDavid />

          <Text style={styles.hebrewTitle}>שידוך</Text>
          <Text style={styles.title}>Orthodox Shidduch</Text>
          <Text style={styles.subtitle}>
            A dedicated, premium experience for observant Jewish singles seeking their bashert
          </Text>
        </Animated.View>

        {/* Premium Badge */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.premiumBadgeContainer}>
          <LinearGradient
            colors={[colors.primary.gold, '#e6c358', colors.primary.gold]}
            style={styles.premiumBadge}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          >
            <Ionicons name="diamond" size={16} color={colors.primary.navy} />
            <Text style={styles.premiumBadgeText}>Premium Experience</Text>
          </LinearGradient>
          <Text style={styles.priceText}>$49.99/month</Text>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.featuresContainer}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>✡</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Orthodox-Only Pool</Text>
              <Text style={styles.featureDescription}>
                Match exclusively with other observant singles who share your values
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="people" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Shadchan Connect</Text>
              <Text style={styles.featureDescription}>
                Work with verified matchmakers who understand the Orthodox community
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="moon" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Shabbat Mode</Text>
              <Text style={styles.featureDescription}>
                Automatic profile pausing from Shabbos candle lighting to havdalah
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>No Advertisements</Text>
              <Text style={styles.featureDescription}>
                A clean, distraction-free experience focused on finding your match
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="lock-closed" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Private & Exclusive</Text>
              <Text style={styles.featureDescription}>
                Your profile is only visible to other verified Orthodox members
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Buttons */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.buttonContainer}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(orthodox-auth)/register')}
          >
            <LinearGradient
              colors={[colors.primary.gold, '#e6c358']}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              <Text style={styles.primaryButtonText}>Begin Your Journey</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
            </LinearGradient>
          </Pressable>

          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Already a member? </Text>
            <Pressable onPress={() => router.push('/(orthodox-auth)/login')}>
              <Text style={styles.signInLink}>Sign In</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Bottom note */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.noteContainer}>
          <Text style={styles.hebrewBlessing}>בשעה טובה ומוצלחת</Text>
          <Text style={styles.noteText}>
            May you find your bashert in a good and successful hour
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
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
  floatingHebrew: {
    position: 'absolute',
    top: '30%',
    fontSize: 48,
    color: colors.primary.gold,
    fontWeight: '300',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  starContainer: {
    marginBottom: spacing[4],
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 10,
  },
  starOfDavid: {
    fontSize: 64,
    color: colors.primary.gold,
  },
  hebrewTitle: {
    fontSize: 42,
    fontWeight: '300',
    color: colors.primary.gold,
    marginBottom: spacing[2],
    letterSpacing: 8,
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
    paddingHorizontal: spacing[4],
  },
  premiumBadgeContainer: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  premiumBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary.navy,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  priceText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  featuresContainer: {
    gap: spacing[5],
    marginBottom: spacing[8],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIconText: {
    fontSize: 24,
    color: colors.primary.gold,
  },
  featureText: {
    flex: 1,
    paddingTop: spacing[1],
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[1],
  },
  featureDescription: {
    fontSize: 14,
    color: colors.transparent.white60,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  primaryButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  primaryButtonText: {
    color: colors.primary.navy,
    fontSize: 18,
    fontWeight: '700',
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  noteContainer: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  hebrewBlessing: {
    fontSize: 20,
    color: colors.primary.gold,
    marginBottom: spacing[1],
    letterSpacing: 2,
  },
  noteText: {
    fontSize: 13,
    color: colors.transparent.white50,
    fontStyle: 'italic',
  },
});
