/**
 * Shidduch Onboarding - Photos
 *
 * Collect profile photos with privacy controls
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useShidduchOnboardingStore } from '@/stores/shidduchOnboardingStore';

interface PhotoSlot {
  uri: string;
  order: number;
}

const VISIBILITY_OPTIONS = [
  {
    id: 'approved_only',
    label: 'Only After Approval',
    description: 'Photos shared only after you approve a match',
    icon: 'lock-closed-outline',
  },
  {
    id: 'shadchanim',
    label: 'Verified Shadchanim',
    description: 'Visible to verified matchmakers',
    icon: 'people-outline',
  },
  {
    id: 'matches',
    label: 'Potential Matches',
    description: 'Visible to people suggested to you',
    icon: 'eye-outline',
  },
];

export default function ShidduchPhotosScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useShidduchOnboardingStore();

  const [photos, setPhotos] = useState<PhotoSlot[]>(data.photos || []);
  const [visibility, setVisibility] = useState(data.photosVisibleTo || 'approved_only');
  const [uploading, setUploading] = useState(false);

  const pickImage = async (order: number) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to add photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        // Simulate upload delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        const newPhoto: PhotoSlot = {
          uri: result.assets[0].uri,
          order,
        };

        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.order !== order);
          return [...filtered, newPhoto].sort((a, b) => a.order - b.order);
        });
        setUploading(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
      setUploading(false);
    }
  };

  const removePhoto = (order: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPhotos((prev) => prev.filter((p) => p.order !== order));
          },
        },
      ]
    );
  };

  const handleContinue = () => {
    updateData({
      photos: photos.length > 0 ? photos : undefined,
      photosVisibleTo: visibility,
    });
    router.push('/(shidduch-onboarding)/complete');
  };

  const getPhotoForSlot = (order: number) => photos.find((p) => p.order === order);

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0a1628']}
      style={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#d4af37" />
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: '89%' }]} />
        </View>
        <Text style={styles.stepText}>8 of 9</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>תמונות</Text>
          <Text style={styles.title}>Photos</Text>
          <Text style={styles.subtitle}>
            Add photos to your profile (optional but recommended)
          </Text>
        </Animated.View>

        {/* Privacy Note */}
        <Animated.View entering={FadeInDown.delay(250)} style={styles.privacyNote}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#d4af37" />
          <View style={styles.privacyTextContainer}>
            <Text style={styles.privacyTitle}>Your Privacy Matters</Text>
            <Text style={styles.privacyText}>
              You control who sees your photos. They are never displayed publicly.
            </Text>
          </View>
        </Animated.View>

        {/* Photo Grid */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.photoSection}>
          <Text style={styles.sectionLabel}>Your Photos</Text>
          <View style={styles.photoGrid}>
            {[1, 2, 3, 4].map((order) => {
              const photo = getPhotoForSlot(order);
              const isPrimary = order === 1;

              return (
                <Pressable
                  key={order}
                  style={[
                    styles.photoSlot,
                    isPrimary && styles.primaryPhotoSlot,
                  ]}
                  onPress={() => photo ? removePhoto(order) : pickImage(order)}
                >
                  {photo ? (
                    <View style={styles.photoContainer}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      <Pressable
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(order)}
                      >
                        <Ionicons name="close" size={16} color="#FFFFFF" />
                      </Pressable>
                      {isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Main</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptySlot}>
                      {uploading ? (
                        <ActivityIndicator color="#d4af37" />
                      ) : (
                        <>
                          <Ionicons
                            name={isPrimary ? 'person-circle-outline' : 'add'}
                            size={isPrimary ? 40 : 32}
                            color={isPrimary ? '#d4af37' : 'rgba(212, 175, 55, 0.5)'}
                          />
                          <Text style={[
                            styles.slotLabel,
                            isPrimary && styles.primarySlotLabel,
                          ]}>
                            {isPrimary ? 'Main Photo' : 'Add Photo'}
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Photo Guidelines */}
        <Animated.View entering={FadeInDown.delay(350)} style={styles.guidelines}>
          <Text style={styles.guidelinesTitle}>Photo Guidelines</Text>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
            <Text style={styles.guidelineText}>Clear, recent photos of yourself</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
            <Text style={styles.guidelineText}>Modest, appropriate attire</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
            <Text style={styles.guidelineText}>Face clearly visible (no sunglasses)</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="close-circle" size={18} color="#ff6b6b" />
            <Text style={styles.guidelineText}>No group photos or photos with others</Text>
          </View>
        </Animated.View>

        {/* Visibility Settings */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.visibilitySection}>
          <Text style={styles.sectionLabel}>Photo Visibility</Text>
          <Text style={styles.sectionHint}>Who can see your photos?</Text>
          <View style={styles.visibilityOptions}>
            {VISIBILITY_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.visibilityOption,
                  visibility === option.id && styles.visibilityOptionSelected,
                ]}
                onPress={() => setVisibility(option.id)}
              >
                <View style={styles.visibilityLeft}>
                  <View style={[
                    styles.visibilityIcon,
                    visibility === option.id && styles.visibilityIconSelected,
                  ]}>
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={visibility === option.id ? '#d4af37' : 'rgba(255,255,255,0.5)'}
                    />
                  </View>
                  <View style={styles.visibilityText}>
                    <Text style={[
                      styles.visibilityLabel,
                      visibility === option.id && styles.visibilityLabelSelected,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.visibilityDesc}>{option.description}</Text>
                  </View>
                </View>
                <View style={[
                  styles.radioOuter,
                  visibility === option.id && styles.radioOuterSelected,
                ]}>
                  {visibility === option.id && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInDown.delay(500)}
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <LinearGradient
            colors={['#d4af37', '#f4d47c', '#d4af37']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {photos.length > 0 ? 'Continue' : 'Skip for Now'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#0a1628" />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginHorizontal: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#d4af37',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    width: 50,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  hebrewTitle: {
    fontSize: 28,
    color: '#d4af37',
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  privacyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  photoSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
    marginTop: -8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoSlot: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderStyle: 'dashed',
  },
  primaryPhotoSlot: {
    borderColor: '#d4af37',
    borderStyle: 'solid',
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#d4af37',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0a1628',
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  slotLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 6,
  },
  primarySlotLabel: {
    color: '#d4af37',
    fontWeight: '600',
  },
  guidelines: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  guidelineText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  visibilitySection: {
    marginBottom: 24,
  },
  visibilityOptions: {
    gap: 10,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  visibilityOptionSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  visibilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  visibilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visibilityIconSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  visibilityText: {
    flex: 1,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  visibilityLabelSelected: {
    color: '#FFFFFF',
  },
  visibilityDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#d4af37',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d4af37',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(10, 22, 40, 0.95)',
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
});
