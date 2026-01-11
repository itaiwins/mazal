/**
 * Welcome Screen
 *
 * The first screen users see - introduces Mazal and prompts sign up/in
 */

import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const { width, height } = Dimensions.get('window');

// Star component for background animation
function Star({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) {
  const opacity = useSharedValue(0.3);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary.gold,
        },
        animatedStyle,
      ]}
    />
  );
}

// Generate random stars
const stars = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height * 0.6,
  size: Math.random() * 4 + 2,
  delay: Math.random() * 2000,
}));

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  // Logo animation
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withDelay(
      300,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.back(1.5)) })
    );
    logoOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 600 })
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d52', colors.primary.navy]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Animated stars */}
      {stars.map((star) => (
        <Star
          key={star.id}
          delay={star.delay}
          x={star.x}
          y={star.y}
          size={star.size}
        />
      ))}

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Text style={styles.logoText}>Mazal</Text>
          <View style={styles.starsContainer}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <View
                key={i}
                style={[
                  styles.logoStar,
                  {
                    left: 20 + i * 15 + (i > 3 ? 5 : 0),
                    top: Math.sin(i * 0.8) * 8 + 10,
                    width: i === 3 ? 8 : 5,
                    height: i === 3 ? 8 : 5,
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, logoAnimatedStyle]}>
          Where Destiny Swipes Right
        </Animated.Text>
      </View>

      {/* Bottom section with buttons */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
        {/* Create Account button */}
        <Link href="/(auth)/register" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </Pressable>
        </Link>

        {/* Sign In button */}
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </Pressable>
        </Link>

        {/* Terms */}
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.navy,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  starsContainer: {
    position: 'absolute',
    top: -25,
    width: 140,
    height: 30,
  },
  logoStar: {
    position: 'absolute',
    backgroundColor: colors.primary.gold,
    borderRadius: 10,
  },
  logoText: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.primary.white,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 18,
    color: colors.transparent.white80,
    letterSpacing: 1,
    marginTop: spacing[4],
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
  termsText: {
    color: colors.transparent.white50,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing[4],
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary.gold,
  },
});
