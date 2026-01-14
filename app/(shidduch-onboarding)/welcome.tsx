/**
 * Shidduch Onboarding Welcome
 *
 * An elegant introduction to the shidduch resume process
 */

import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Floating Hebrew letters
const HEBREW_LETTERS = ['מ', 'ז', 'ל', '✡', 'ש', 'ד', 'כ', 'ן'];

function FloatingLetter({ letter, delay, x, y }: { letter: string; delay: number; x: number; y: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

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

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.floatingLetter, { left: x, top: y }, style]}>
      {letter}
    </Animated.Text>
  );
}

export default function ShidduchWelcomeScreen() {
  const insets = useSafeAreaInsets();

  const starScale = useSharedValue(0.8);
  const starRotation = useSharedValue(0);

  useEffect(() => {
    starScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    starRotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1
    );
  }, []);

  const starStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: starScale.value },
      { rotate: `${starRotation.value}deg` },
    ],
  }));

  const handleContinue = () => {
    router.push('/(shidduch-onboarding)/creator-type');
  };

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0a1628']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Floating Hebrew letters background */}
      {HEBREW_LETTERS.map((letter, i) => (
        <FloatingLetter
          key={i}
          letter={letter}
          delay={i * 200}
          x={30 + (i % 4) * (width - 100) / 3}
          y={100 + Math.floor(i / 4) * 200}
        />
      ))}

      {/* Star of David */}
      <Animated.View style={[styles.starContainer, starStyle]}>
        <Text style={styles.starText}>✡</Text>
      </Animated.View>

      {/* Main content */}
      <View style={styles.content}>
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.hebrewTitle}>
          שידוך
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(400).springify()} style={styles.title}>
          Build Your Shidduch Resume
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(500).springify()} style={styles.subtitle}>
          A comprehensive profile that represents who you truly are,
          crafted with the care and respect the shidduch process deserves.
        </Animated.Text>

        {/* What we'll collect */}
        <Animated.View entering={FadeIn.delay(700)} style={styles.stepsContainer}>
          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Ionicons name="person-outline" size={20} color="#d4af37" />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Your Story</Text>
              <Text style={styles.stepDesc}>Background, education & hashkafa</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Ionicons name="people-outline" size={20} color="#d4af37" />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Family Background</Text>
              <Text style={styles.stepDesc}>Parents, siblings & yichus</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Ionicons name="heart-outline" size={20} color="#d4af37" />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>What You're Seeking</Text>
              <Text style={styles.stepDesc}>Your vision for your bashert</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Ionicons name="call-outline" size={20} color="#d4af37" />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>References</Text>
              <Text style={styles.stepDesc}>People who know you best</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Bottom section */}
      <Animated.View entering={FadeInUp.delay(900).springify()} style={styles.bottomSection}>
        <Text style={styles.privacyNote}>
          Your information is kept private and only shared with verified shadchanim
          and potential matches you approve.
        </Text>

        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <LinearGradient
            colors={['#d4af37', '#f4d47c', '#d4af37']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Begin</Text>
            <Ionicons name="arrow-forward" size={20} color="#0a1628" />
          </LinearGradient>
        </Pressable>

        <Text style={styles.timeEstimate}>Takes about 10 minutes</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingLetter: {
    position: 'absolute',
    fontSize: 48,
    color: '#d4af37',
    fontWeight: '300',
  },
  starContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starText: {
    fontSize: 60,
    color: '#d4af37',
    textShadowColor: '#d4af37',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    marginTop: 40,
  },
  hebrewTitle: {
    fontSize: 42,
    fontWeight: '300',
    color: '#d4af37',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  stepsContainer: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  privacyNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
  },
  timeEstimate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 12,
  },
});
