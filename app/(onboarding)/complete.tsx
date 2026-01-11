/**
 * Complete Screen
 *
 * Celebration screen after completing onboarding
 * Saves all onboarding data to Supabase before navigating to main app
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/api/supabase/client';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// FileSystem encoding type
const Base64Encoding = 'base64' as const;

const CELEBRATION_EMOJIS = ['✨', '🎉', '💫', '⭐', '💛'];

function FloatingEmoji({ emoji, delay, x }: { emoji: string; delay: number; x: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(-100, { damping: 8 }),
          withSpring(0, { damping: 8 })
        ),
        -1,
        true
      )
    );
    opacity.value = withDelay(delay, withSpring(1));
    scale.value = withDelay(delay, withSpring(1));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.floatingEmoji, { left: x }, animatedStyle]}>
      {emoji}
    </Animated.Text>
  );
}

export default function CompleteScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const reset = useOnboardingStore((s) => s.reset);
  const setUser = useAuthStore((s) => s.setUser);
  const [isSaving, setIsSaving] = useState(false);

  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 100 });
    rotation.value = withSequence(
      withSpring(10, { damping: 8 }),
      withSpring(-10, { damping: 8 }),
      withSpring(0, { damping: 8 })
    );
  }, []);

  const starStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const handleStart = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Get the authenticated user
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        console.error('Error getting auth user:', authError);
        Alert.alert('Error', 'Could not verify your account. Please try again.');
        setIsSaving(false);
        return;
      }

      const authId = authData.user.id;

      // Calculate age from date of birth
      const calculateAge = (dob: Date | null): number | null => {
        if (!dob) return null;
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      };

      // Prepare required fields with fallbacks for NOT NULL constraints
      const firstName = data?.first_name || 'User';
      const dateOfBirth = data?.date_of_birth
        ? new Date(data.date_of_birth).toISOString().split('T')[0]
        : new Date(Date.now() - 25 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default to 25 years ago
      const gender = data?.gender || 'other';
      const jewishBackground = data?.jewish_background || 'just_jewish';
      const lookingFor = data?.looking_for || 'open';

      // Create or update user profile in Supabase
      const profileData = {
        auth_id: authId,
        email: authData.user.email || `${authId}@mazal.app`,
        first_name: firstName,
        display_name: firstName, // Required NOT NULL field
        date_of_birth: dateOfBirth,
        gender: gender,
        gender_preference: data?.gender_preference || [],
        jewish_background: jewishBackground,
        observance_level: data?.observance_level,
        keeps_shabbat: data?.keeps_shabbat,
        keeps_kosher: data?.keeps_kosher,
        synagogue_attendance: data?.synagogue_attendance,
        jewish_education: data?.jewish_education,
        current_latitude: data?.current_latitude,
        current_longitude: data?.current_longitude,
        current_city: data?.current_city,
        current_state: data?.current_state,
        current_country: data?.current_country,
        education: data?.education,
        school: data?.school,
        occupation: data?.occupation,
        company: data?.company,
        height_cm: data?.height_cm,
        looking_for: lookingFor,
        wants_children: data?.wants_children,
        partner_must_be_jewish: data?.partner_must_be_jewish ?? true,
        raise_children_jewish: data?.raise_children_jewish ?? true,
        willing_to_relocate: data?.willing_to_relocate ?? false,
        bio: data?.bio || '',
        onboarding_complete: true,
        is_active: true,
      };

      // Upsert user profile (insert or update if exists)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert(profileData, { onConflict: 'auth_id' })
        .select()
        .single();

      if (userError) {
        console.error('Error saving profile:', userError);
        Alert.alert('Error', 'Could not save your profile. Please try again.');
        setIsSaving(false);
        return;
      }

      const userId = userData.id;

      // Upload and save photos if any
      if (data?.photos && data.photos.length > 0) {
        // Delete existing photos first
        await supabase.from('user_photos').delete().eq('user_id', userId);

        // Upload photos to Supabase storage and collect URLs
        const uploadedPhotos: Array<{ url: string; order: number }> = [];

        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];
          const photoUri = photo.uri || photo.uploadedUrl;

          if (!photoUri) continue;

          try {
            // If already a remote URL (starts with http), use as is
            if (photoUri.startsWith('http')) {
              uploadedPhotos.push({ url: photoUri, order: i });
              continue;
            }

            // Read the local file as base64
            const base64 = await FileSystem.readAsStringAsync(photoUri, {
              encoding: Base64Encoding,
            });

            // Generate unique filename
            const fileExt = photoUri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${userId}/${Date.now()}_${i}.${fileExt}`;

            // Upload to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('photos')
              .upload(fileName, decode(base64), {
                contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                upsert: true,
              });

            if (uploadError) {
              console.error('Error uploading photo:', uploadError);
              continue;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from('photos')
              .getPublicUrl(fileName);

            if (urlData?.publicUrl) {
              uploadedPhotos.push({ url: urlData.publicUrl, order: i });
            }
          } catch (err) {
            console.error('Error processing photo:', err);
            // Continue with other photos
          }
        }

        // Insert photo records
        if (uploadedPhotos.length > 0) {
          const photosToInsert = uploadedPhotos.map((photo, index) => ({
            user_id: userId,
            photo_url: photo.url,
            photo_order: photo.order,
            is_primary: index === 0,
          }));

          const { error: photosError } = await supabase
            .from('user_photos')
            .insert(photosToInsert);

          if (photosError) {
            console.error('Error saving photo records:', photosError);
            // Continue anyway - photos are not critical for the profile
          }
        }
      }

      // Save prompts if any
      if (data?.prompts && data.prompts.length > 0) {
        // Delete existing prompts first
        await supabase.from('user_prompts').delete().eq('user_id', userId);

        // Insert new prompts
        const promptsToInsert = data.prompts.map((prompt, index) => ({
          user_id: userId,
          prompt_id: prompt.prompt_id,
          answer: prompt.answer,
          display_order: index,
        }));

        const { error: promptsError } = await supabase
          .from('user_prompts')
          .insert(promptsToInsert);

        if (promptsError) {
          console.error('Error saving prompts:', promptsError);
          // Continue anyway - prompts are not critical
        }
      }

      // Update the auth store with the saved user
      setUser(userData);

      // Reset onboarding store
      reset();

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[8],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Floating emojis */}
      {CELEBRATION_EMOJIS.map((emoji, index) => (
        <FloatingEmoji
          key={index}
          emoji={emoji}
          delay={index * 200}
          x={40 + index * 70}
        />
      ))}

      {/* Main Content */}
      <View style={styles.content}>
        {/* Star Icon */}
        <Animated.View style={[styles.starContainer, starStyle]}>
          <View style={styles.starInner}>
            <Text style={styles.starEmoji}>✡️</Text>
          </View>
          <View style={styles.heartRing}>
            <Text style={styles.heartEmoji}>💛</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.Text
          entering={FadeInUp.delay(300).springify()}
          style={[styles.title, { color: theme.colors.text }]}
        >
          Mazal Tov!
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          entering={FadeInUp.delay(400).springify()}
          style={[styles.subtitle, { color: theme.colors.textSecondary }]}
        >
          Your profile is ready. Time to find your bashert!
        </Animated.Text>

        {/* Profile Summary */}
        <Animated.View
          entering={FadeIn.delay(500)}
          style={[styles.summary, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.summaryRow}>
            <Ionicons name="person" size={18} color={colors.primary.gold} />
            <Text style={[styles.summaryText, { color: theme.colors.text }]}>
              {data?.first_name || 'Your'} profile is complete
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="images" size={18} color={colors.primary.gold} />
            <Text style={[styles.summaryText, { color: theme.colors.text }]}>
              {data?.photos?.length || 0} photos uploaded
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="chatbubbles" size={18} color={colors.primary.gold} />
            <Text style={[styles.summaryText, { color: theme.colors.text }]}>
              {data?.prompts?.length || 0} prompts answered
            </Text>
          </View>
        </Animated.View>

        {/* Tips */}
        <Animated.View
          entering={FadeInDown.delay(600).springify()}
          style={styles.tips}
        >
          <Text style={[styles.tipsTitle, { color: theme.colors.text }]}>
            Quick tips:
          </Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipEmoji}>👆</Text>
            <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
              Swipe right to like, left to pass
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipEmoji}>⭐</Text>
            <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
              Super Like to stand out
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipEmoji}>💬</Text>
            <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
              Match & message to connect
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View
        entering={FadeInDown.delay(700).springify()}
        style={styles.footer}
      >
        <Pressable
          style={[styles.startButton, isSaving && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <ActivityIndicator color={colors.primary.navy} size="small" />
              <Text style={styles.startButtonText}>Saving...</Text>
            </>
          ) : (
            <>
              <Text style={styles.startButtonText}>Start Swiping</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  floatingEmoji: {
    position: 'absolute',
    fontSize: 24,
    top: 100,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starContainer: {
    width: 120,
    height: 120,
    marginBottom: spacing[6],
  },
  starInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starEmoji: {
    fontSize: 56,
  },
  heartRing: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  heartEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  summary: {
    width: '100%',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  summaryText: {
    fontSize: 15,
  },
  tips: {
    width: '100%',
    gap: spacing[2],
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  tipEmoji: {
    fontSize: 18,
  },
  tipText: {
    fontSize: 14,
  },
  footer: {
    paddingTop: spacing[4],
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
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
