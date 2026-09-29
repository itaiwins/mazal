/**
 * ActionButtons Component
 *
 * Floating glass-morphism action buttons for Rewind/Pass/Like/Super Like.
 * Part of the "Constellation Dating" redesign.
 */

import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useDotNavigatorInset } from '@/components/navigation/DotNavigator';
import { colors } from '@/theme/colors';
import { borderRadius, spacing } from '@/theme/spacing';
import { SPRING_CONFIGS } from '@/constants/animations';
import { HapticPatterns } from '@/utils/haptics';
import { StarOfDavid } from '@/components/icons/StarOfDavid';

interface ActionButtonsProps {
  onPass: () => void;
  onLike: () => void;
  onSuperLike: () => void;
  /**
   * Rewind the last swipe (MEXA-372). Leave it out and no Rewind button is rendered,
   * which is how this bar behaved before - the caller decides whether the screen has
   * anything to rewind.
   */
  onRewind?: () => void;
  /**
   * Free tier. The button is still shown, because that is what the paywall's `rewind`
   * prompt needs a trigger for, but it wears a lock so nobody reads it as broken.
   */
  rewindLocked?: boolean;
  /** A rewind is in flight: spinner instead of the icon. */
  rewindBusy?: boolean;
  disabled?: boolean;
  hasLikedSomething?: boolean;
  superLikesRemaining?: number;
  swipesRemaining?: number | null;
  isUnlimited?: boolean;
}

export function ActionButtons({
  onPass,
  onLike,
  onSuperLike,
  onRewind,
  rewindLocked = false,
  rewindBusy = false,
  disabled = false,
  hasLikedSomething = false,
  superLikesRemaining,
  swipesRemaining,
  isUnlimited = false,
}: ActionButtonsProps) {
  // This bar is `position: 'absolute', bottom: 0`, and so is the DotNavigator, so padding
  // by `insets.bottom` alone put Pass/Like/Super Like directly underneath the dots
  // (MEXA-338, finding 9 - MEXA-328 pack screen 24).
  const dotNavigatorInset = useDotNavigatorInset();

  // Breath animation for the like button
  const breathScale = useSharedValue(1);

  useEffect(() => {
    // Subtle breathing animation
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [breathScale]);

  const likeBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  return (
    <View style={[styles.container, { paddingBottom: dotNavigatorInset + spacing[3] }]}>
      {/* Glass Background */}
      <BlurView intensity={20} tint="dark" style={styles.blurBackground} />
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.85)', 'rgba(10, 14, 26, 0.98)']}
        style={styles.gradientOverlay}
      />

      {/* Swipes Remaining Counter */}
      {!isUnlimited && swipesRemaining !== null && swipesRemaining !== undefined && (
        <View style={styles.swipesCounter}>
          <Text style={styles.swipesText}>
            {swipesRemaining} swipes left today
          </Text>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.buttonsRow}>
        {/* Rewind Button - the affordance behind the paid "Rewind last swipe" (MEXA-372) */}
        {onRewind && (
          <ActionButton
            type="rewind"
            onPress={onRewind}
            disabled={disabled}
            locked={rewindLocked}
            busy={rewindBusy}
          />
        )}

        {/* Pass Button */}
        <ActionButton
          type="pass"
          onPress={onPass}
          disabled={disabled}
        />

        {/* Super Like (Bashert) Button */}
        <ActionButton
          type="superLike"
          onPress={onSuperLike}
          disabled={disabled}
          remaining={superLikesRemaining}
        />

        {/* Like Button */}
        <Animated.View style={likeBreathStyle}>
          <ActionButton
            type="like"
            onPress={onLike}
            disabled={disabled}
            hasLikedSomething={hasLikedSomething}
          />
        </Animated.View>
      </View>

      {/* Hint Text */}
      <Text style={styles.hintText}>
        {hasLikedSomething
          ? 'Tap the heart to send your likes'
          : 'Swipe right to like, left to pass'}
      </Text>
    </View>
  );
}

// Individual Action Button Component
interface ActionButtonProps {
  type: 'pass' | 'like' | 'superLike' | 'rewind';
  onPress: () => void;
  disabled?: boolean;
  hasLikedSomething?: boolean;
  remaining?: number;
  /** Rewind only: the feature is sold but this user has not bought it. */
  locked?: boolean;
  /** Rewind only: the request is in flight. */
  busy?: boolean;
}

function ActionButton({
  type,
  onPress,
  disabled = false,
  hasLikedSomething = false,
  remaining,
  locked = false,
  busy = false,
}: ActionButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, SPRING_CONFIGS.QUICK);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIGS.QUICK);
  };

  const handlePress = () => {
    if (disabled) return;

    // Trigger appropriate haptic
    switch (type) {
      case 'pass':
        HapticPatterns.pass();
        break;
      case 'like':
        HapticPatterns.like();
        break;
      case 'superLike':
        HapticPatterns.superLike();
        break;
      case 'rewind':
        HapticPatterns.undo();
        break;
    }

    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  const buttonConfig = {
    pass: {
      size: 56,
      icon: 'close',
      iconSize: 28,
      iconColor: colors.transparent.white80,
      style: styles.passButton,
    },
    like: {
      size: 64,
      icon: 'heart',
      iconSize: 32,
      iconColor: colors.primary.navy,
      style: hasLikedSomething ? styles.likeButtonActive : styles.likeButton,
    },
    superLike: {
      size: 72,
      icon: null, // Uses StarOfDavid
      iconSize: 32,
      iconColor: '#4A90D9',
      style: styles.superLikeButton,
    },
    rewind: {
      size: 48,
      // `arrow-undo` rather than the paywall card's `refresh`: this sits next to Pass and
      // Like, where a circular arrow reads as "reload the deck".
      icon: 'arrow-undo',
      iconSize: 22,
      iconColor: locked ? colors.transparent.white40 : colors.primary.gold,
      style: locked ? styles.rewindButtonLocked : styles.rewindButton,
    },
  };

  const config = buttonConfig[type];

  const label =
    type === 'pass' ? 'Pass'
    : type === 'superLike' ? 'Bashert'
    : type === 'rewind' ? 'Rewind'
    : 'Like';

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        type === 'rewind' && locked ? 'Rewind, Mazal Gold feature' : label
      }
      accessibilityState={{ disabled, busy }}
    >
      <Animated.View
        style={[
          styles.button,
          { width: config.size, height: config.size, borderRadius: config.size / 2 },
          config.style,
          animatedStyle,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary.gold} />
        ) : type === 'superLike' ? (
          <View style={styles.superLikeContent}>
            <LinearGradient
              colors={['#4A90D9', '#2E5F99', '#1E3A5F']}
              style={StyleSheet.absoluteFill}
            />
            <StarOfDavid size={config.iconSize} color={colors.primary.white} />
            {remaining !== undefined && (
              <View style={styles.remainingBadge}>
                <Text style={styles.remainingText}>{remaining}</Text>
              </View>
            )}
          </View>
        ) : type === 'like' ? (
          <LinearGradient
            colors={hasLikedSomething
              ? [colors.primary.gold, '#DAA520']
              : [colors.primary.gold, '#B8860B']
            }
            style={[StyleSheet.absoluteFill, { borderRadius: config.size / 2 }]}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={config.icon as any} size={config.iconSize} color={config.iconColor} />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.iconContainer}>
            <Ionicons name={config.icon as any} size={config.iconSize} color={config.iconColor} />
          </View>
        )}
      </Animated.View>

      {/* Lock badge - outside the button, which clips (`overflow: 'hidden'`) */}
      {type === 'rewind' && locked && !busy && (
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={10} color={colors.primary.navy} />
        </View>
      )}

      {/* Label. Read off `label` rather than re-deriving it: the old inline ternary had no
          `rewind` arm, so a fourth type would have silently been labelled "Like". */}
      <Text style={[
        styles.buttonLabel,
        type === 'superLike' && styles.superLikeLabel,
        type === 'like' && styles.likeLabel,
        type === 'rewind' && styles.rewindLabel,
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: spacing[4],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  swipesCounter: {
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  swipesText: {
    fontSize: 12,
    color: colors.transparent.white50,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    // spacing[5] rather than spacing[6] since Rewind made this a four-button row
    // (MEXA-372). At 24pt the row measured 344pt against 375pt of usable width on the
    // narrowest device this build targets, which leaves nothing for a label grown by
    // Dynamic Type - and these labels have no `numberOfLines`, so they widen the columns
    // (the same class of problem as MEXA-388). 20pt gives it 31pt of slack.
    gap: spacing[5],
    paddingHorizontal: spacing[4],
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  passButton: {
    backgroundColor: colors.transparent.white10,
    borderWidth: 2,
    borderColor: colors.neutral[700],
  },
  rewindButton: {
    backgroundColor: colors.transparent.gold10,
    borderWidth: 2,
    borderColor: colors.transparent.gold50,
  },
  rewindButtonLocked: {
    backgroundColor: colors.transparent.white10,
    borderWidth: 2,
    borderColor: colors.neutral[700],
  },
  lockBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    // Gold gradient applied via LinearGradient
  },
  likeButtonActive: {
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  superLikeButton: {
    marginBottom: spacing[3], // Elevated
    borderWidth: 3,
    borderColor: 'rgba(74, 144, 217, 0.5)',
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  superLikeContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 36,
    overflow: 'hidden',
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remainingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary.white,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A90D9',
  },
  buttonLabel: {
    textAlign: 'center',
    marginTop: spacing[2],
    fontSize: 12,
    fontWeight: '600',
    color: colors.transparent.white60,
  },
  superLikeLabel: {
    color: '#4A90D9',
    marginTop: spacing[1],
  },
  likeLabel: {
    color: colors.primary.gold,
  },
  rewindLabel: {
    color: colors.transparent.gold70,
  },
  hintText: {
    textAlign: 'center',
    marginTop: spacing[4],
    fontSize: 13,
    color: colors.transparent.white40,
  },
});

export default ActionButtons;
