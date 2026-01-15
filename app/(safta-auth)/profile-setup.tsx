/**
 * Safta Profile Setup Screen
 *
 * Set up matchmaker profile (name, relationship, optional photo)
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const RELATIONSHIPS = [
  { id: 'mother', label: 'Mother', emoji: '👩' },
  { id: 'father', label: 'Father', emoji: '👨' },
  { id: 'grandmother', label: 'Grandmother', emoji: '👵' },
  { id: 'grandfather', label: 'Grandfather', emoji: '👴' },
  { id: 'aunt', label: 'Aunt', emoji: '👩' },
  { id: 'uncle', label: 'Uncle', emoji: '👨' },
  { id: 'other', label: 'Other', emoji: '👤' },
];

// Timeout helper to prevent infinite hanging
const withTimeout = <T,>(
  promise: PromiseLike<T>,
  ms: number,
  errorMsg: string
): Promise<T> => {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    ),
  ]);
};

export default function SaftaProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const setHasSaftaProfile = useAuthStore((s) => s.setHasSaftaProfile);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = name.trim().length >= 2 && relationship;

  const handlePickPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to add a profile picture.');
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (!isValid) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      console.log('[Safta Setup] Saving profile...');

      // Fire the update request - don't wait for Promise to resolve
      // because Supabase auth.updateUser has timing issues where the
      // auth state updates but Promise resolution is delayed
      console.log('[Safta Setup] Initiating updateUser...');

      const updatePromise = supabase.auth.updateUser({
        data: {
          safta_name: name.trim(),
          safta_relationship: relationship,
          safta_photo: photo || null,
          safta_onboarding_complete: true,
        },
      });

      // Race between the Promise resolving and a timeout
      // But even if timeout wins, the update might have succeeded
      let promiseResolved = false;
      let updateError: any = null;

      try {
        const result = await Promise.race([
          updatePromise.then(r => { promiseResolved = true; return r; }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 20000)
          ),
        ]);

        if (result.error) {
          updateError = result.error;
          console.log('[Safta Setup] Update returned error:', result.error.message);
        } else {
          console.log('[Safta Setup] Update Promise resolved successfully');
        }
      } catch (e: any) {
        if (e.message === 'timeout') {
          console.log('[Safta Setup] Promise timed out, checking if update succeeded anyway...');
        } else {
          updateError = e;
          console.log('[Safta Setup] Update exception:', e.message);
        }
      }

      // If Promise timed out, check if the update actually went through
      // by verifying the user metadata
      if (!promiseResolved && !updateError) {
        console.log('[Safta Setup] Verifying update via getUser...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay

        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.user_metadata?.safta_onboarding_complete === true) {
            console.log('[Safta Setup] Verification confirmed - update succeeded!');
            promiseResolved = true; // Treat as success
          } else {
            console.log('[Safta Setup] Verification failed - metadata not set');
            updateError = new Error('Profile update did not complete. Please try again.');
          }
        } catch (verifyErr: any) {
          console.log('[Safta Setup] Verification error:', verifyErr.message);
          updateError = new Error('Could not verify profile update. Please try again.');
        }
      }

      if (updateError) {
        console.error('[Safta Setup] Final error:', updateError.message);
        Alert.alert('Error', updateError.message || 'Failed to save profile. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsLoading(false);
        return;
      }

      // Update local state to reflect Safta profile is complete
      setHasSaftaProfile(true);

      console.log('[Safta Setup] Profile saved, navigating to complete...');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(safta-auth)/complete');
    } catch (err: any) {
      console.error('[Safta Setup] Error saving profile:', err);
      Alert.alert('Error', err?.message || 'Failed to save profile. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d52', colors.primary.navy]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Back button */}
      <Pressable
        style={[styles.backButton, { top: insets.top + spacing[2] }]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 80, paddingBottom: insets.bottom + spacing[4] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.headerSection}>
          <Text style={styles.title}>Tell Us About You</Text>
          <Text style={styles.subtitle}>
            Your family will see your name and relationship when you send recommendations
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.formSection}>
          {/* Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Your Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="What should they call you?"
              placeholderTextColor={colors.transparent.white30}
              autoCapitalize="words"
              maxLength={30}
            />
            <Text style={styles.hint}>This could be "Bubbe Sarah" or just "Mom"</Text>
          </View>

          {/* Relationship */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Your Relationship</Text>
            <View style={styles.relationshipGrid}>
              {RELATIONSHIPS.map((rel) => (
                <Pressable
                  key={rel.id}
                  style={[
                    styles.relationshipOption,
                    relationship === rel.id && styles.relationshipOptionSelected,
                  ]}
                  onPress={() => {
                    setRelationship(rel.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={styles.relationshipEmoji}>{rel.emoji}</Text>
                  <Text
                    style={[
                      styles.relationshipLabel,
                      relationship === rel.id && styles.relationshipLabelSelected,
                    ]}
                  >
                    {rel.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Optional photo section */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.photoSection}>
          <Pressable style={styles.photoButton} onPress={handlePickPhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={32} color={colors.transparent.white40} />
              </View>
            )}
            <View style={styles.photoTextContainer}>
              <Text style={styles.photoTitle}>
                {photo ? 'Change Photo' : 'Add a Photo (Optional)'}
              </Text>
              <Text style={styles.photoSubtitle}>
                Help your family recognize you
              </Text>
            </View>
            {photo && (
              <Pressable
                style={styles.removePhotoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setPhoto(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons name="close-circle" size={24} color={colors.semantic.error} />
              </Pressable>
            )}
          </Pressable>
        </Animated.View>

        {/* Continue button */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.buttonSection}>
          <Pressable
            style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isValid || isLoading}
          >
            <Text style={styles.continueButtonText}>
              {isLoading ? 'Saving...' : 'Continue'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.navy,
  },
  backButton: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[6],
  },
  headerSection: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white70,
    lineHeight: 22,
  },
  formSection: {
    gap: spacing[5],
    marginBottom: spacing[6],
  },
  inputContainer: {
    gap: spacing[2],
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.transparent.white80,
  },
  input: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    fontSize: 16,
    color: colors.primary.white,
  },
  hint: {
    fontSize: 13,
    color: colors.transparent.white50,
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  relationshipOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  relationshipOptionSelected: {
    backgroundColor: colors.transparent.gold20,
    borderColor: colors.primary.gold,
  },
  relationshipEmoji: {
    fontSize: 16,
  },
  relationshipLabel: {
    fontSize: 14,
    color: colors.transparent.white70,
    fontWeight: '500',
  },
  relationshipLabelSelected: {
    color: colors.primary.gold,
  },
  photoSection: {
    marginBottom: spacing[6],
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[4],
    borderWidth: 1,
    borderColor: colors.transparent.white20,
    borderStyle: 'dashed',
  },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  photoTextContainer: {
    flex: 1,
  },
  removePhotoButton: {
    padding: spacing[2],
  },
  photoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.transparent.white70,
    marginBottom: spacing[0.5],
  },
  photoSubtitle: {
    fontSize: 13,
    color: colors.transparent.white50,
  },
  buttonSection: {
    marginTop: 'auto',
  },
  continueButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
});
