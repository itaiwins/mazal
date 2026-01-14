/**
 * Action Footer Component
 *
 * Sticky footer with Pass, Bashert (super like), and Like buttons that appears on scroll
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
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
  profileName: string;
  hasLikedSomething: boolean;
}

export function ActionFooter({
  scrollY,
  onPass,
  onLike,
  onSuperLike,
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

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        { paddingBottom: insets.bottom + spacing[4] },
      ]}
    >
      <LinearGradient
        colors={['transparent', 'rgba(10, 14, 26, 0.95)', 'rgba(10, 14, 26, 1)']}
        style={styles.gradient}
      />

      <View style={styles.content}>
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
    gap: spacing[8],
    paddingHorizontal: spacing[6],
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
