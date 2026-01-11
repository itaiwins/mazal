/**
 * Photos Screen
 *
 * Upload up to 6 profile photos
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';

const PHOTO_SLOTS = 6;
const MIN_PHOTOS = 2;

export default function PhotosScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updatePhotos = useOnboardingStore((s) => s.updatePhotos);

  const [photos, setPhotos] = useState<string[]>(
    data?.photos?.map((p) => p.uri || p.uploadedUrl || '').filter(Boolean) || []
  );

  // Only count non-empty photos
  const validPhotos = photos.filter(p => p && p.length > 0);
  const isValid = validPhotos.length >= MIN_PHOTOS;

  const handleAddPhoto = async (index: number) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission needed',
        'Please allow access to your photos to continue'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhotos = [...photos];
      if (index < photos.length) {
        newPhotos[index] = result.assets[0].uri;
      } else {
        newPhotos.push(result.assets[0].uri);
      }
      setPhotos(newPhotos);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  const handleContinue = () => {
    // Convert string URIs to PhotoUpload format (only valid photos)
    const photoUploads = validPhotos.map((uri, index) => ({
      id: `photo-${index}`,
      uri,
      order: index,
      isPrimary: index === 0,
      uploadProgress: 100,
    }));
    updatePhotos(photoUploads);
    router.push('/(onboarding)/jewish-identity');
  };

  const renderPhotoSlot = (index: number) => {
    const photo = photos[index];
    const isMain = index === 0;

    return (
      <View
        key={index}
        style={[
          styles.photoSlot,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        {photo ? (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.photoContainer}
          >
            <Image source={{ uri: photo }} style={styles.photo} />
            <Pressable
              style={styles.removeButton}
              onPress={() => handleRemovePhoto(index)}
            >
              <Ionicons name="close" size={16} color={colors.primary.white} />
            </Pressable>
            {isMain && (
              <View style={styles.mainBadge}>
                <Text style={styles.mainBadgeText}>Main</Text>
              </View>
            )}
          </Animated.View>
        ) : (
          <Pressable
            style={styles.addButton}
            onPress={() => handleAddPhoto(index)}
          >
            <Ionicons
              name="add-circle"
              size={32}
              color={colors.primary.gold}
            />
            {isMain && (
              <Text style={[styles.addLabel, { color: theme.colors.textTertiary }]}>
                Main photo
              </Text>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[16],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Add your photos
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Add at least {MIN_PHOTOS} photos to continue
          </Text>
        </View>

        {/* Photo Grid */}
        <View style={styles.photoGrid}>
          {[0, 1, 2, 3, 4, 5].map((index) => renderPhotoSlot(index))}
        </View>

        {/* Tips */}
        <View style={styles.tips}>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
            <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
              Clear face photos work best
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
            <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
              Show your personality and interests
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="close-circle" size={20} color={colors.semantic.error} />
            <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
              No group photos as your main
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer - Fixed at bottom */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.continueButton,
            !isValid && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <Text style={styles.continueText}>
            Continue ({validPhotos.length}/{MIN_PHOTOS} minimum)
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Calculate photo slot width based on screen
const PHOTO_GAP = spacing[3];
const HORIZONTAL_PADDING = spacing[6];
const PHOTO_SLOT_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - PHOTO_GAP) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  header: {
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
  },
  photoSlot: {
    width: PHOTO_SLOT_WIDTH,
    height: PHOTO_SLOT_WIDTH * (4 / 3),
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  photoContainer: {
    flex: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.transparent.black60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBadge: {
    position: 'absolute',
    bottom: spacing[2],
    left: spacing[2],
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  mainBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  addButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    gap: spacing[1],
  },
  addLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  tips: {
    marginTop: spacing[6],
    gap: spacing[2],
    paddingBottom: spacing[2],
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  tipText: {
    fontSize: 14,
  },
  footer: {
    paddingTop: spacing[4],
    paddingHorizontal: spacing[6],
  },
  continueButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
