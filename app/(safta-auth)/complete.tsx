/**
 * Safta Complete Screen
 *
 * Success screen after Safta account setup is complete
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function SaftaCompleteScreen() {
  const insets = useSafeAreaInsets();

  // Success animation
  const scale = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    scale.value = withSpring(1, { damping: 12, stiffness: 150 });
    checkmarkScale.value = withDelay(300, withSpring(1, { damping: 10, stiffness: 200 }));
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to Safta tabs
    router.replace('/(safta-tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d52', colors.primary.navy]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        {/* Success Icon */}
        <Animated.View style={[styles.iconContainer, containerStyle]}>
          <View style={styles.iconCircle}>
            <Animated.View style={checkmarkStyle}>
              <Ionicons name="checkmark" size={64} color={colors.primary.white} />
            </Animated.View>
          </View>
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>👵</Text>
            <Text style={styles.emoji}>💛</Text>
            <Text style={styles.emoji}>👴</Text>
          </View>
        </Animated.View>

        {/* Message */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.messageSection}>
          <Text style={styles.title}>You're All Set!</Text>
          <Text style={styles.subtitle}>
            Welcome to Mazal's Safta Mode. You're now connected as a matchmaker.
          </Text>
        </Animated.View>

        {/* What's next */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.nextStepsContainer}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>

          <View style={styles.nextStep}>
            <View style={styles.nextStepIcon}>
              <Ionicons name="search" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.nextStepText}>
              Browse profiles and find potential matches
            </Text>
          </View>

          <View style={styles.nextStep}>
            <View style={styles.nextStepIcon}>
              <Ionicons name="heart" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.nextStepText}>
              Send recommendations to your family member
            </Text>
          </View>

          <View style={styles.nextStep}>
            <View style={styles.nextStepIcon}>
              <Ionicons name="chatbubbles" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.nextStepText}>
              Chat about your recommendations together
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom button */}
      <Animated.View
        entering={FadeInDown.delay(600).springify()}
        style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing[4] }]}
      >
        <Pressable style={styles.startButton} onPress={handleGetStarted}>
          <Text style={styles.startButtonText}>Start Matchmaking</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  emojiContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  emoji: {
    fontSize: 32,
  },
  messageSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: colors.transparent.white70,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing[4],
  },
  nextStepsContainer: {
    width: '100%',
    gap: spacing[4],
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.transparent.white60,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[2],
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  nextStepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepText: {
    flex: 1,
    fontSize: 15,
    color: colors.transparent.white80,
    lineHeight: 21,
  },
  bottomSection: {
    paddingHorizontal: spacing[6],
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  startButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
});
