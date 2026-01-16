/**
 * MatchCelebration2 Component
 *
 * Complete redesign of match celebration - "Destiny Revealed"
 * Orchestrated animation sequence with particle effects,
 * haptic feedback, and premium visual experience.
 *
 * Animation Sequence (2.5 seconds):
 * 1. (0-300ms) Background blur + dim
 * 2. (300-600ms) Golden particles burst from center
 * 3. (600-1000ms) Star of David rotates in with scale
 * 4. (1000-1500ms) "Mazal Tov!" reveals letter by letter
 * 5. (1500-1800ms) Photos slide in, overlap in center
 * 6. (1800-2500ms) CTA buttons fade up with spring
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Extrapolation,
  FadeIn,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { SPRING_CONFIGS } from '@/constants/animations';
import { HapticPatterns } from '@/utils/haptics';
import { StarOfDavid } from '@/components/icons/StarOfDavid';
import { GoldenParticles } from './GoldenParticles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MatchData {
  id: string;
  otherUser: {
    id: string;
    firstName: string;
    photoUrl: string;
  };
  yourPhotoUrl?: string;
}

interface MatchCelebration2Props {
  match: MatchData;
  visible: boolean;
  onClose: () => void;
  onSendMessage: () => void;
}

export function MatchCelebration2({
  match,
  visible,
  onClose,
  onSendMessage,
}: MatchCelebration2Props) {
  const [showParticles, setShowParticles] = useState(false);

  // Animation values
  const backgroundOpacity = useSharedValue(0);
  const starScale = useSharedValue(0);
  const starRotation = useSharedValue(-180);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const photoScale = useSharedValue(0);
  const photo1TranslateX = useSharedValue(-100);
  const photo2TranslateX = useSharedValue(100);
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(50);

  // Orchestrated animation sequence
  useEffect(() => {
    if (visible) {
      // Reset all values
      backgroundOpacity.value = 0;
      starScale.value = 0;
      starRotation.value = -180;
      titleOpacity.value = 0;
      titleTranslateY.value = 30;
      photoScale.value = 0;
      photo1TranslateX.value = -100;
      photo2TranslateX.value = 100;
      buttonsOpacity.value = 0;
      buttonsTranslateY.value = 50;

      // Phase 1: Background blur (0-300ms)
      backgroundOpacity.value = withTiming(1, { duration: 300 });

      // Phase 2: Particles burst (300ms)
      setTimeout(() => {
        setShowParticles(true);
        HapticPatterns.celebration();
      }, 300);

      // Phase 3: Star of David rotates in (600-1000ms)
      starScale.value = withDelay(600, withSpring(1, {
        ...SPRING_CONFIGS.BOUNCY,
        damping: 10,
      }));
      starRotation.value = withDelay(600, withSpring(0, {
        damping: 15,
        stiffness: 100,
      }));

      // Phase 4: "Mazal Tov!" reveals (1000-1500ms)
      titleOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
      titleTranslateY.value = withDelay(1000, withSpring(0, SPRING_CONFIGS.GENTLE));

      // Phase 5: Photos slide in (1500-1800ms)
      photoScale.value = withDelay(1500, withSpring(1, SPRING_CONFIGS.BOUNCY));
      photo1TranslateX.value = withDelay(1500, withSpring(-30, SPRING_CONFIGS.GENTLE));
      photo2TranslateX.value = withDelay(1500, withSpring(30, SPRING_CONFIGS.GENTLE));

      // Phase 6: Buttons fade up (1800-2500ms)
      buttonsOpacity.value = withDelay(1800, withTiming(1, { duration: 300 }));
      buttonsTranslateY.value = withDelay(1800, withSpring(0, SPRING_CONFIGS.GENTLE));
    } else {
      setShowParticles(false);
    }
  }, [visible]);

  // Animated styles
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: starScale.value },
      { rotate: `${starRotation.value}deg` },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const photoContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: photoScale.value }],
  }));

  const photo1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: photo1TranslateX.value }],
  }));

  const photo2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: photo2TranslateX.value }],
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSendMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSendMessage();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.container}>
        {/* Animated background */}
        <Animated.View style={[styles.backdrop, backgroundStyle]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(13, 27, 62, 0.95)', 'rgba(10, 20, 45, 0.98)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Golden particles */}
        <GoldenParticles
          active={showParticles}
          centerX={SCREEN_WIDTH / 2}
          centerY={SCREEN_HEIGHT * 0.35}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Star of David */}
          <Animated.View style={[styles.starContainer, starStyle]}>
            <View style={styles.starGlow} />
            <StarOfDavid size={100} color={colors.primary.gold} />
          </Animated.View>

          {/* Title */}
          <Animated.View style={[styles.titleContainer, titleStyle]}>
            <Text style={styles.mazalText}>Mazal Tov!</Text>
            <Text style={styles.subtitleText}>It's a Match</Text>
          </Animated.View>

          {/* Photos */}
          <Animated.View style={[styles.photosContainer, photoContainerStyle]}>
            {/* Your photo */}
            <Animated.View style={[styles.photoWrapper, photo1Style]}>
              <View style={styles.photoGlow} />
              <Image
                source={{ uri: match.yourPhotoUrl || 'https://via.placeholder.com/120' }}
                style={styles.photo}
                contentFit="cover"
              />
            </Animated.View>

            {/* Heart connector */}
            <View style={styles.heartConnector}>
              <Ionicons name="heart" size={28} color={colors.primary.gold} />
            </View>

            {/* Match photo */}
            <Animated.View style={[styles.photoWrapper, photo2Style]}>
              <View style={styles.photoGlow} />
              <Image
                source={{ uri: match.otherUser.photoUrl }}
                style={styles.photo}
                contentFit="cover"
              />
            </Animated.View>
          </Animated.View>

          {/* Match name */}
          <Animated.Text style={[styles.matchName, titleStyle]}>
            You and {match.otherUser.firstName}
          </Animated.Text>

          {/* Hint text */}
          <Animated.Text style={[styles.hintText, titleStyle]}>
            The stars have aligned for you both
          </Animated.Text>

          {/* Action buttons */}
          <Animated.View style={[styles.buttonsContainer, buttonsStyle]}>
            <Pressable style={styles.messageButton} onPress={handleSendMessage}>
              <LinearGradient
                colors={[colors.primary.gold, '#DAA520']}
                style={styles.messageButtonGradient}
              >
                <Ionicons name="chatbubble" size={22} color={colors.primary.navy} />
                <Text style={styles.messageButtonText}>Send a Message</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.keepBrowsingButton} onPress={handleClose}>
              <Text style={styles.keepBrowsingText}>Keep Browsing</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  starContainer: {
    position: 'relative',
    marginBottom: spacing[6],
  },
  starGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 100,
    backgroundColor: colors.primary.gold,
    opacity: 0.15,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  mazalText: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary.gold,
    textShadowColor: 'rgba(201, 162, 39, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  subtitleText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primary.white,
    marginTop: spacing[2],
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  photoWrapper: {
    position: 'relative',
  },
  photoGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 100,
    backgroundColor: colors.primary.gold,
    opacity: 0.3,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.primary.gold,
  },
  heartConnector: {
    marginHorizontal: spacing[3],
    backgroundColor: colors.transparent.gold20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary.white,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  hintText: {
    fontSize: 15,
    color: colors.transparent.white60,
    textAlign: 'center',
    marginBottom: spacing[10],
  },
  buttonsContainer: {
    width: '100%',
    gap: spacing[4],
  },
  messageButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  messageButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  messageButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  keepBrowsingButton: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  keepBrowsingText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.transparent.white70,
  },
});

export default MatchCelebration2;
