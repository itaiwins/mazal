/**
 * Welcome Screen
 *
 * The first screen users see - introduces Mazal with animated gold stars
 */

import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const { width, height } = Dimensions.get('window');

// Floating star that drifts around the screen
function FloatingStar({
  initialX,
  initialY,
  size,
  delay,
  duration,
}: {
  initialX: number;
  initialY: number;
  size: number;
  delay: number;
  duration: number;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Fade in
    opacity.value = withDelay(
      delay,
      withTiming(0.8, { duration: 1000 })
    );

    // Scale up
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 10, stiffness: 80 })
    );

    // Floating X movement - gentle drift
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(30 + Math.random() * 20, {
            duration: duration,
            easing: Easing.inOut(Easing.sin)
          }),
          withTiming(-30 - Math.random() * 20, {
            duration: duration,
            easing: Easing.inOut(Easing.sin)
          })
        ),
        -1,
        true
      )
    );

    // Floating Y movement - gentle drift
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-25 - Math.random() * 15, {
            duration: duration * 0.8,
            easing: Easing.inOut(Easing.sin)
          }),
          withTiming(25 + Math.random() * 15, {
            duration: duration * 0.8,
            easing: Easing.inOut(Easing.sin)
          })
        ),
        -1,
        true
      )
    );

    // Twinkle effect
    opacity.value = withDelay(
      delay + 1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Gentle rotation
    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: duration * 2, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: initialX,
          top: initialY,
        },
        animatedStyle,
      ]}
    >
      <View style={[styles.starShape, { width: size, height: size }]}>
        <View style={[styles.starPoint, styles.starPointTop, { borderBottomColor: colors.primary.gold }]} />
        <View style={[styles.starPoint, styles.starPointBottom, { borderTopColor: colors.primary.gold }]} />
      </View>
    </Animated.View>
  );
}

// Simple glowing dot star
function GlowingStar({
  x,
  y,
  size,
  delay
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  const opacity = useSharedValue(0.2);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 + Math.random() * 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1200 + Math.random() * 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) })
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
          shadowColor: colors.primary.gold,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: size,
        },
        animatedStyle,
      ]}
    />
  );
}

// Shooting star that flies across the screen
function ShootingStar({ delay, startY }: { delay: number; startY: number }) {
  const translateX = useSharedValue(-50);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const animate = () => {
      translateX.value = -50;
      translateY.value = 0;
      opacity.value = 0;

      // Fade in quickly
      opacity.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 200 }),
          withDelay(600, withTiming(0, { duration: 300 }))
        )
      );

      // Shoot across
      translateX.value = withDelay(
        delay,
        withTiming(width + 100, { duration: 1100, easing: Easing.out(Easing.quad) })
      );

      // Slight downward arc
      translateY.value = withDelay(
        delay,
        withTiming(80, { duration: 1100, easing: Easing.in(Easing.quad) })
      );
    };

    animate();
    const interval = setInterval(animate, 8000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: '25deg' },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: startY,
          width: 60,
          height: 2,
          borderRadius: 1,
        },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={['transparent', colors.primary.gold, colors.primary.white]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1, borderRadius: 1 }}
      />
    </Animated.View>
  );
}

// Orbiting star around the logo
function OrbitingStar({
  index,
  totalStars,
  orbitRadius,
  size,
  speed,
}: {
  index: number;
  totalStars: number;
  orbitRadius: number;
  size: number;
  speed: number;
}) {
  const rotation = useSharedValue(index * (360 / totalStars));
  const opacity = useSharedValue(0);
  const starScale = useSharedValue(0);

  useEffect(() => {
    // Staggered fade in
    opacity.value = withDelay(
      index * 100 + 500,
      withTiming(1, { duration: 800 })
    );

    starScale.value = withDelay(
      index * 100 + 500,
      withSpring(1, { damping: 8, stiffness: 100 })
    );

    // Continuous orbit
    rotation.value = withDelay(
      index * 100,
      withRepeat(
        withTiming(rotation.value + 360, {
          duration: speed,
          easing: Easing.linear
        }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const angle = (rotation.value * Math.PI) / 180;
    const x = Math.cos(angle) * orbitRadius;
    const y = Math.sin(angle) * orbitRadius * 0.3; // Elliptical orbit

    return {
      opacity: opacity.value,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: starScale.value * (0.8 + Math.sin(angle) * 0.2) }, // Size varies with position
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary.gold,
          shadowColor: colors.primary.gold,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
        },
        animatedStyle,
      ]}
    />
  );
}

// Sparkle burst effect
function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      scale.value = 0;
      opacity.value = 0;
      rotation.value = 0;

      scale.value = withDelay(
        delay,
        withSequence(
          withSpring(1.2, { damping: 8, stiffness: 150 }),
          withTiming(0, { duration: 400 })
        )
      );

      opacity.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 150 }),
          withDelay(300, withTiming(0, { duration: 300 }))
        )
      );

      rotation.value = withDelay(
        delay,
        withTiming(90, { duration: 800, easing: Easing.out(Easing.ease) })
      );
    };

    animate();
    const interval = setInterval(animate, 5000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - 10,
          top: y - 10,
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      <View style={styles.sparkleH} />
      <View style={styles.sparkleV} />
    </Animated.View>
  );
}

// Generate random floating stars
const floatingStars = Array.from({ length: 12 }, (_, i) => ({
  id: `float-${i}`,
  x: Math.random() * (width - 40) + 20,
  y: Math.random() * (height * 0.5) + 50,
  size: Math.random() * 12 + 8,
  delay: Math.random() * 2000,
  duration: 4000 + Math.random() * 3000,
}));

// Generate glowing background stars
const glowingStars = Array.from({ length: 25 }, (_, i) => ({
  id: `glow-${i}`,
  x: Math.random() * width,
  y: Math.random() * (height * 0.65),
  size: Math.random() * 4 + 2,
  delay: Math.random() * 3000,
}));

// Generate sparkle positions
const sparkles = Array.from({ length: 8 }, (_, i) => ({
  id: `sparkle-${i}`,
  x: Math.random() * (width - 40) + 20,
  y: Math.random() * (height * 0.5) + 80,
  delay: Math.random() * 4000,
}));

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  // Logo animation
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoGlow = useSharedValue(0);
  const logoFloat = useSharedValue(0);
  const logoRotate = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withDelay(
      300,
      withSpring(1, { damping: 12, stiffness: 100 })
    );
    logoOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 600 })
    );

    // Pulsing glow effect
    logoGlow.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Floating animation for the Mem logo
    logoFloat.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(8, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Subtle rotation
    logoRotate.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(3, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const logoGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: logoGlow.value,
  }));

  const memLogoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: logoFloat.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d52', '#0f1d36', colors.primary.navy]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Background glowing stars */}
      {glowingStars.map((star) => (
        <GlowingStar
          key={star.id}
          x={star.x}
          y={star.y}
          size={star.size}
          delay={star.delay}
        />
      ))}

      {/* Floating animated stars */}
      {floatingStars.map((star) => (
        <FloatingStar
          key={star.id}
          initialX={star.x}
          initialY={star.y}
          size={star.size}
          delay={star.delay}
          duration={star.duration}
        />
      ))}

      {/* Shooting stars */}
      <ShootingStar delay={2000} startY={height * 0.15} />
      <ShootingStar delay={6000} startY={height * 0.25} />
      <ShootingStar delay={10000} startY={height * 0.1} />

      {/* Sparkle effects */}
      {sparkles.map((sparkle) => (
        <Sparkle
          key={sparkle.id}
          x={sparkle.x}
          y={sparkle.y}
          delay={sparkle.delay}
        />
      ))}

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Mem Logo Icon */}
        <Animated.View style={[styles.memLogoContainer, logoAnimatedStyle, memLogoStyle]}>
          {/* Orbiting stars around the Mem */}
          <View style={styles.memOrbitContainer}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <OrbitingStar
                key={i}
                index={i}
                totalStars={8}
                orbitRadius={70}
                size={i % 2 === 0 ? 6 : 4}
                speed={10000}
              />
            ))}
          </View>
          <View style={styles.memLogoGlow}>
            <Image
              source={require('../../assets/logo-mem.png')}
              style={styles.memLogoImage}
              contentFit="contain"
            />
          </View>
        </Animated.View>

        {/* Logo text with orbiting stars */}
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          {/* Orbiting stars around the text */}
          <View style={styles.orbitContainer}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <OrbitingStar
                key={i}
                index={i}
                totalStars={6}
                orbitRadius={90}
                size={i % 2 === 0 ? 8 : 6}
                speed={12000}
              />
            ))}
          </View>

          <Animated.Text style={[styles.logoText, logoGlowStyle]}>
            Mazal
          </Animated.Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, logoAnimatedStyle]}>
          L'chaim to love
        </Animated.Text>
      </View>

      {/* Bottom section with buttons */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
        {/* Create Account button (Dating) */}
        <Link href="/(auth)/register" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Find My Match</Text>
          </Pressable>
        </Link>

        {/* Sign In button */}
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </Pressable>
        </Link>

        {/* Safta Mode Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Safta Mode Button */}
        <Link href="/(safta-auth)/welcome" asChild>
          <Pressable style={styles.saftaButton}>
            <Text style={styles.saftaButtonEmoji}>👵👴</Text>
            <View style={styles.saftaButtonContent}>
              <Text style={styles.saftaButtonTitle}>I'm a Parent or Grandparent</Text>
              <Text style={styles.saftaButtonSubtitle}>Help your family find love</Text>
            </View>
          </Pressable>
        </Link>

        {/* Orthodox Mode Entry */}
        <Link href="/(orthodox-auth)/welcome" asChild>
          <Pressable style={styles.orthodoxButton}>
            <View style={styles.orthodoxIconContainer}>
              <Text style={styles.orthodoxIcon}>✡</Text>
            </View>
            <View style={styles.orthodoxButtonContent}>
              <Text style={styles.orthodoxButtonTitle}>Orthodox Shidduch</Text>
              <Text style={styles.orthodoxButtonSubtitle}>Dedicated matching for observant Jews</Text>
            </View>
            <View style={styles.orthodoxPremiumBadge}>
              <Text style={styles.orthodoxPremiumText}>Premium</Text>
            </View>
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
  memLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  memOrbitContainer: {
    position: 'absolute',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memLogoGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'transparent',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memLogoImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  orbitContainer: {
    position: 'absolute',
    width: 180,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    top: -10,
  },
  logoText: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.primary.white,
    letterSpacing: 2,
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[2],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.transparent.white20,
  },
  dividerText: {
    color: colors.transparent.white50,
    fontSize: 14,
    paddingHorizontal: spacing[4],
  },
  saftaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white20,
    gap: spacing[3],
  },
  saftaButtonEmoji: {
    fontSize: 28,
  },
  saftaButtonContent: {
    flex: 1,
  },
  saftaButtonTitle: {
    color: colors.primary.white,
    fontSize: 15,
    fontWeight: '600',
  },
  saftaButtonSubtitle: {
    color: colors.transparent.white60,
    fontSize: 13,
    marginTop: 2,
  },
  orthodoxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary.gold,
    gap: spacing[3],
  },
  orthodoxIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  orthodoxIcon: {
    fontSize: 22,
    color: colors.primary.navy,
  },
  orthodoxButtonContent: {
    flex: 1,
  },
  orthodoxButtonTitle: {
    color: colors.primary.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  orthodoxButtonSubtitle: {
    color: colors.transparent.gold70,
    fontSize: 13,
    marginTop: 2,
  },
  orthodoxPremiumBadge: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  orthodoxPremiumText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  // Star shape styles
  starShape: {
    position: 'relative',
  },
  starPoint: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  starPointTop: {
    top: 0,
    borderBottomWidth: 10,
  },
  starPointBottom: {
    bottom: 0,
    borderTopWidth: 10,
  },
  // Sparkle styles
  sparkleH: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: colors.primary.gold,
    borderRadius: 1,
  },
  sparkleV: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: colors.primary.gold,
    borderRadius: 1,
  },
});
