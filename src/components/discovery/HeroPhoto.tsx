/**
 * Hero Photo Component
 *
 * Full-screen primary photo with parallax effect and overlay info
 */

import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Share } from 'react-native';
import Animated, {
  useAnimatedStyle,
  SharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { LikeAnimation } from './LikeAnimation';
import { jewishBackgroundLabel } from '@/lib/constants/jewish';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.75;

interface HeroPhotoProps {
  photoUrl: string | null;
  name: string;
  age: number;
  location: string;
  distance?: number;
  jewishBackground?: string;
  isVerified?: boolean;
  scrollY: SharedValue<number>;
  onLikePhoto: () => void;
  onDoubleTap: () => void;
  profileId?: string;
}

export function HeroPhoto({
  photoUrl,
  name,
  age,
  location,
  distance,
  jewishBackground,
  isVerified,
  scrollY,
  onLikePhoto,
  onDoubleTap,
  profileId,
}: HeroPhotoProps) {
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  // Share profile externally
  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out ${name}'s profile on Mazal - the Jewish dating app! Download the app to see more: https://mazal.app/profile/${profileId || 'unknown'}`,
        title: `Meet ${name} on Mazal`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [name, profileId]);

  // Parallax effect - photo moves slower than scroll
  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, HERO_HEIGHT * 0.3], Extrapolation.CLAMP) },
    ],
  }));

  // Fade out overlay as user scrolls
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 200], [1, 0], Extrapolation.CLAMP),
  }));

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap detected
      setShowLikeAnimation(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDoubleTap();
    }
    setLastTap(now);
  }, [lastTap, onDoubleTap]);

  const handleLikeButton = useCallback(() => {
    setShowLikeAnimation(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLikePhoto();
  }, [onLikePhoto]);

  return (
    <Pressable onPress={handleTap} style={styles.container}>
      {/* Photo with parallax */}
      <Animated.View style={[styles.photoContainer, photoStyle]}>
        {photoUrl ? (
          <Animated.Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.photo, styles.placeholderPhoto]}>
            <Ionicons name="person" size={80} color={colors.neutral[400]} />
          </View>
        )}
      </Animated.View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.4, 0.75, 1]}
        style={styles.gradient}
      />

      {/* Share button */}
      <Pressable style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-outline" size={22} color={colors.primary.white} />
      </Pressable>

      {/* Like animation overlay */}
      {showLikeAnimation && (
        <View style={styles.likeAnimationContainer}>
          <LikeAnimation
            visible={showLikeAnimation}
            onComplete={() => setShowLikeAnimation(false)}
            size={100}
          />
        </View>
      )}

      {/* Info overlay */}
      <Animated.View style={[styles.infoOverlay, overlayStyle]}>
        {/* Name and age */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.age}>, {age}</Text>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={22} color={colors.semantic.info} />
            </View>
          )}
        </View>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={colors.transparent.white80} />
          <Text style={styles.locationText}>
            {location}{distance ? ` \u2022 ${distance} mi` : ''}
          </Text>
        </View>

        {/* Badges */}
        <View style={styles.badges}>
          {jewishBackground && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{jewishBackgroundLabel(jewishBackground)}</Text>
            </View>
          )}
        </View>

        {/* Like photo hint */}
        <View style={styles.likeHint}>
          <Pressable style={styles.likePhotoButton} onPress={handleLikeButton}>
            <Ionicons name="heart-outline" size={20} color={colors.primary.white} />
            <Text style={styles.likePhotoText}>Like Photo</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Double tap hint */}
      <View style={styles.doubleTapHint}>
        <Text style={styles.doubleTapText}>Double-tap to like</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HERO_HEIGHT,
    width: '100%',
    overflow: 'hidden',
  },
  photoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 1.3, // Extra height for parallax
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholderPhoto: {
    backgroundColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.6,
  },
  likeAnimationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[5],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  name: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.primary.white,
  },
  age: {
    fontSize: 28,
    fontWeight: '400',
    color: colors.primary.white,
  },
  verifiedBadge: {
    marginLeft: spacing[2],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
    gap: spacing[1],
  },
  locationText: {
    fontSize: 15,
    color: colors.transparent.white80,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  badge: {
    backgroundColor: colors.transparent.white20,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.white,
  },
  likeHint: {
    marginTop: spacing[4],
  },
  likePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.transparent.white10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.transparent.white30,
  },
  likePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.white,
  },
  doubleTapHint: {
    position: 'absolute',
    top: spacing[16],
    alignSelf: 'center',
    backgroundColor: colors.transparent.black40,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  doubleTapText: {
    fontSize: 12,
    color: colors.transparent.white70,
  },
  shareButton: {
    position: 'absolute',
    top: spacing[16],
    right: spacing[4],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.black40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export { HERO_HEIGHT };
