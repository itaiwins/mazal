/**
 * Animated Header Component
 *
 * A stylized header with the Mem logo and gold accents
 */

import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
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
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface AnimatedHeaderProps {
  title: string;
  showLogo?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function AnimatedHeader({ title, showLogo = true, size = 'medium' }: AnimatedHeaderProps) {
  const shimmerPosition = useSharedValue(-1);
  const logoGlow = useSharedValue(0.3);
  const logoFloat = useSharedValue(0);

  useEffect(() => {
    // Shimmer effect on text
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Logo glow pulse
    logoGlow.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Subtle float
    logoFloat.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(-2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(2, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoFloat.value }],
    shadowOpacity: logoGlow.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerPosition.value * 100 }],
  }));

  const sizes = {
    small: { logo: 24, text: 22, gap: spacing[1.5] },
    medium: { logo: 28, text: 28, gap: spacing[2] },
    large: { logo: 34, text: 34, gap: spacing[2.5] },
  };

  const currentSize = sizes[size];

  return (
    <View style={styles.container}>
      {showLogo && (
        <Animated.View style={[styles.logoContainer, logoStyle, {
          width: currentSize.logo,
          height: currentSize.logo,
          shadowRadius: currentSize.logo / 2,
        }]}>
          <Image
            source={require('../../../assets/logo-mem.png')}
            style={[styles.logo, { width: currentSize.logo, height: currentSize.logo }]}
            contentFit="contain"
          />
        </Animated.View>
      )}
      <View style={[styles.textContainer, { marginLeft: showLogo ? currentSize.gap : 0 }]}>
        <Text style={[styles.title, { fontSize: currentSize.text }]}>{title}</Text>
        {/* Gold underline accent */}
        <View style={styles.underlineContainer}>
          <LinearGradient
            colors={['transparent', colors.primary.gold, colors.primary.gold, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.underline}
          />
          {/* Animated shimmer overlay */}
          <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.shimmer}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 5,
  },
  logo: {
    borderRadius: 4,
  },
  textContainer: {
    position: 'relative',
  },
  title: {
    fontWeight: '700',
    color: colors.primary.white,
    letterSpacing: 0.5,
  },
  underlineContainer: {
    position: 'relative',
    height: 3,
    marginTop: 2,
    overflow: 'hidden',
    borderRadius: 1.5,
  },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
  },
  shimmer: {
    flex: 1,
  },
});

export default AnimatedHeader;
