/**
 * Photo Gallery Component
 *
 * Horizontal scrolling gallery of additional photos with like functionality
 */

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { LikeAnimation } from './LikeAnimation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_PHOTO_WIDTH = SCREEN_WIDTH * 0.7;
const GALLERY_PHOTO_HEIGHT = GALLERY_PHOTO_WIDTH * 1.2;

interface Photo {
  id?: string;
  photo_url: string;
  photo_order?: number;
}

interface PhotoGalleryProps {
  photos: Photo[];
  onLikePhoto: (photoIndex: number) => void;
}

export function PhotoGallery({ photos, onLikePhoto }: PhotoGalleryProps) {
  const [likedPhotos, setLikedPhotos] = useState<Set<number>>(new Set());
  const [showLikeAnimation, setShowLikeAnimation] = useState<number | null>(null);

  const handleLikePhoto = useCallback((index: number) => {
    if (likedPhotos.has(index)) return; // Already liked

    setLikedPhotos((prev) => new Set(prev).add(index));
    setShowLikeAnimation(index);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLikePhoto(index);
  }, [likedPhotos, onLikePhoto]);

  // Skip first photo (shown in hero)
  const galleryPhotos = photos.slice(1);

  if (galleryPhotos.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn.delay(200)} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Photos</Text>
        <Text style={styles.count}>{galleryPhotos.length + 1} photos</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={GALLERY_PHOTO_WIDTH + spacing[3]}
      >
        {galleryPhotos.map((photo, index) => {
          const actualIndex = index + 1; // Offset because we skip first photo
          const isLiked = likedPhotos.has(actualIndex);

          return (
            <View key={photo.id || index} style={styles.photoCard}>
              <Image
                source={{ uri: photo.photo_url }}
                style={styles.photo}
                resizeMode="cover"
              />

              {/* Like overlay */}
              {showLikeAnimation === actualIndex && (
                <View style={styles.likeOverlay}>
                  <LikeAnimation
                    visible={true}
                    onComplete={() => setShowLikeAnimation(null)}
                    size={70}
                  />
                </View>
              )}

              {/* Like button */}
              <Pressable
                style={[styles.likeButton, isLiked && styles.likeButtonActive]}
                onPress={() => handleLikePhoto(actualIndex)}
              >
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isLiked ? colors.primary.gold : colors.primary.white}
                />
              </Pressable>

              {/* Liked indicator */}
              {isLiked && (
                <View style={styles.likedIndicator}>
                  <Text style={styles.likedText}>Liked</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[6],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.white,
  },
  count: {
    fontSize: 14,
    color: colors.transparent.white60,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  photoCard: {
    width: GALLERY_PHOTO_WIDTH,
    height: GALLERY_PHOTO_HEIGHT,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  likeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    position: 'absolute',
    bottom: spacing[3],
    right: spacing[3],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.black40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.transparent.white20,
  },
  likeButtonActive: {
    backgroundColor: colors.transparent.gold30,
    borderColor: colors.primary.gold,
  },
  likedIndicator: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  likedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
