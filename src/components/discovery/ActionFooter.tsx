/**
 * Action Footer Component
 *
 * Sticky footer with Rewind, Pass, Bashert (super like), and Like buttons that appears
 * on scroll
 */

import { ActivityIndicator, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  SharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { StarOfDavid } from '@/components/icons/StarOfDavid';

interface ActionFooterProps {
  scrollY: SharedValue<number>;
  onPass: () => void;
  onLike: () => void;
  onSuperLike: () => void;
  /**
   * Rewind the last swipe (MEXA-372). Optional: without it this footer renders the three
   * buttons it always had. Story mode is reachable from the discovery header's view
   * toggle, so leaving Rewind out of here would have hidden a paid feature in one of the
   * two modes - the same bug in miniature.
   */
  onRewind?: () => void;
  /** Free tier: the button is shown with a lock and opens the paywall. */
  rewindLocked?: boolean;
  /** A rewind is in flight. */
  rewindBusy?: boolean;
  /**
   * Room to leave under the row. Omit it and the footer pads by the safe-area inset alone,
   * which is what it always did and what the full-profile modal wants.
   *
   * Story mode has to pass `useDotNavigatorInset()`: this footer is
   * `position: 'absolute', bottom: 0` and so is the DotNavigator, which draws on top of it.
   * Measured in the walkthrough render on MEXA-372 - `document.elementFromPoint()` at the
   * centre of the "Rewind" label returned the navigator, not the button, so the tap did
   * nothing at all. Pass, Bashert and Like were already under it the same way; this is
   * MEXA-338 finding 9, which was fixed in `ActionButtons` and missed here.
   */
  bottomInset?: number;
  profileName: string;
  hasLikedSomething: boolean;
}

export function ActionFooter({
  scrollY,
  onPass,
  onLike,
  onSuperLike,
  onRewind,
  rewindLocked = false,
  rewindBusy = false,
  bottomInset,
  profileName,
  hasLikedSomething,
}: ActionFooterProps) {
  const insets = useSafeAreaInsets();

  // Fade in as user scrolls past the hero
  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [200, 400], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [200, 400], [20, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const handlePass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPass();
  };

  const handleLike = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLike();
  };

  const handleSuperLike = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSuperLike();
  };

  const handleRewind = () => {
    if (rewindBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRewind?.();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        { paddingBottom: (bottomInset ?? insets.bottom) + spacing[4] },
      ]}
    >
      <LinearGradient
        colors={['transparent', 'rgba(10, 14, 26, 0.95)', 'rgba(10, 14, 26, 1)']}
        style={styles.gradient}
      />

      <View style={styles.content}>
        {/* Rewind Button - the affordance behind the paid "Rewind last swipe" (MEXA-372) */}
        {onRewind && (
          <Pressable
            style={styles.rewindButton}
            onPress={handleRewind}
            disabled={rewindBusy}
            accessibilityRole="button"
            accessibilityLabel={rewindLocked ? 'Rewind, Mazal Gold feature' : 'Rewind'}
            accessibilityState={{ disabled: rewindBusy, busy: rewindBusy }}
          >
            <View
              style={[
                styles.rewindButtonInner,
                rewindLocked && styles.rewindButtonInnerLocked,
              ]}
            >
              {rewindBusy ? (
                <ActivityIndicator size="small" color={colors.primary.gold} />
              ) : (
                <Ionicons
                  name="arrow-undo"
                  size={22}
                  color={rewindLocked ? colors.neutral[400] : colors.primary.gold}
                />
              )}
            </View>
            {rewindLocked && !rewindBusy && (
              <View style={styles.rewindLockBadge}>
                <Ionicons name="lock-closed" size={10} color={colors.primary.navy} />
              </View>
            )}
            <Text style={styles.rewindText}>Rewind</Text>
          </Pressable>
        )}

        {/* Pass Button */}
        <Pressable style={styles.passButton} onPress={handlePass}>
          <View style={styles.passButtonInner}>
            <Ionicons name="close" size={28} color={colors.neutral[400]} />
          </View>
          <Text style={styles.passText}>Pass</Text>
        </Pressable>

        {/* Bashert (Super Like) Button - Center, Elevated */}
        <Pressable style={styles.bashertButton} onPress={handleSuperLike}>
          <LinearGradient
            colors={['#4A90D9', '#2E5F99', '#1E3A5F']}
            style={styles.bashertGradient}
          >
            <StarOfDavid size={40} color={colors.primary.white} />
          </LinearGradient>
          <Text style={styles.bashertText}>Bashert</Text>
        </Pressable>

        {/* Like Button */}
        <Pressable style={styles.likeButton} onPress={handleLike}>
          <LinearGradient
            colors={[colors.primary.gold, '#B8860B']}
            style={styles.likeButtonGradient}
          >
            <Ionicons name="heart" size={28} color={colors.primary.navy} />
          </LinearGradient>
          <Text style={styles.likeText}>
            {hasLikedSomething ? 'Connect' : 'Like'}
          </Text>
        </Pressable>
      </View>

      {/* Hint text */}
      <Text style={styles.hintText}>
        {hasLikedSomething
          ? `Send your likes to ${profileName}`
          : `Bashert = They're "the one"`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: spacing[10],
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // Tightened from gap spacing[8] / padding spacing[6] because Rewind made this a
    // four-button row (MEXA-372). At the old values the row measured 376pt against 375pt
    // of width on the narrowest device this build targets, i.e. it overflowed. The columns
    // are 52/64/80/72 (Rewind's is set by its label, not its 48pt circle), so 16pt gaps
    // and 16pt side padding come to 348pt and leave 27pt of slack.
    gap: spacing[4],
    paddingHorizontal: spacing[4],
  },
  rewindButton: {
    alignItems: 'center',
    gap: spacing[2],
  },
  rewindButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold10,
    borderWidth: 2,
    borderColor: colors.transparent.gold50,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  rewindButtonInnerLocked: {
    backgroundColor: colors.transparent.white10,
    borderColor: colors.neutral[700],
  },
  rewindLockBadge: {
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
  rewindText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.transparent.gold70,
  },
  passButton: {
    alignItems: 'center',
    gap: spacing[2],
  },
  passButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.transparent.white10,
    borderWidth: 2,
    borderColor: colors.neutral[700],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  passText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  likeButton: {
    alignItems: 'center',
    gap: spacing[2],
  },
  likeButtonGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  likeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  bashertButton: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: -20, // Elevated above others
  },
  bashertGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(74, 144, 217, 0.5)',
    ...shadows.lg,
  },
  bashertText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A90D9',
  },
  hintText: {
    fontSize: 12,
    color: colors.transparent.white50,
    textAlign: 'center',
    marginTop: spacing[3],
    paddingHorizontal: spacing[6],
  },
});
