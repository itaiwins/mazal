/**
 * Orthodox Onboarding - Background Screen
 *
 * Collect Jewish background information
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const COMMUNITIES = [
  { id: 'litvish', label: 'Litvish/Yeshivish', hebrew: 'ליטאי' },
  { id: 'chassidish', label: 'Chassidish', hebrew: 'חסידי' },
  { id: 'modern_orthodox', label: 'Modern Orthodox', hebrew: 'דתי מודרני' },
  { id: 'sephardi', label: 'Sephardi', hebrew: 'ספרדי' },
  { id: 'chabad', label: 'Chabad', hebrew: 'חב״ד' },
  { id: 'other', label: 'Other', hebrew: 'אחר' },
];

const OBSERVANCE_LEVELS = [
  { id: 'very_observant', label: 'Very Observant', description: 'Strict adherence to halacha' },
  { id: 'observant', label: 'Observant', description: 'Keep Shabbat, kashrut, daily davening' },
  { id: 'traditional', label: 'Traditional', description: 'Keep major holidays and traditions' },
];

export default function OrthodoxOnboardingBackground() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [community, setCommunity] = useState<string | null>(null);
  const [observance, setObservance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = community && observance;

  const handleContinue = async () => {
    if (!isValid) {
      setError('Please select your community and observance level');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (user?.id) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            jewish_background: community,
            // observance_level: observance, // If this column exists
          })
          .eq('id', user.id);

        if (updateError) {
          setError('Failed to save. Please try again.');
          return;
        }

        // Skip to complete for now (photos and preferences can be added later)
        router.push('/(orthodox-onboarding)/complete');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52', '#0f1d36', '#0a1628']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: '50%' }]} />
          </View>
        </View>

        {/* Title */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.titleSection}>
          <Text style={styles.stepLabel}>Step 2 of 4</Text>
          <Text style={styles.hebrewTitle}>רקע יהודי</Text>
          <Text style={styles.title}>Jewish Background</Text>
          <Text style={styles.subtitle}>Help us match you with compatible singles</Text>
        </Animated.View>

        {/* Community Selection */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Community</Text>
          <View style={styles.optionsGrid}>
            {COMMUNITIES.map((item) => (
              <Pressable
                key={item.id}
                style={[
                  styles.optionButton,
                  community === item.id && styles.optionButtonSelected,
                ]}
                onPress={() => setCommunity(item.id)}
              >
                <Text style={[
                  styles.optionHebrew,
                  community === item.id && styles.optionHebrewSelected,
                ]}>{item.hebrew}</Text>
                <Text style={[
                  styles.optionLabel,
                  community === item.id && styles.optionLabelSelected,
                ]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Observance Level */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Observance Level</Text>
          <View style={styles.observanceList}>
            {OBSERVANCE_LEVELS.map((item) => (
              <Pressable
                key={item.id}
                style={[
                  styles.observanceButton,
                  observance === item.id && styles.observanceButtonSelected,
                ]}
                onPress={() => setObservance(item.id)}
              >
                <View style={styles.observanceContent}>
                  <Text style={[
                    styles.observanceLabel,
                    observance === item.id && styles.observanceLabelSelected,
                  ]}>{item.label}</Text>
                  <Text style={[
                    styles.observanceDescription,
                    observance === item.id && styles.observanceDescriptionSelected,
                  ]}>{item.description}</Text>
                </View>
                <View style={[
                  styles.radioOuter,
                  observance === item.id && styles.radioOuterSelected,
                ]}>
                  {observance === item.id && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={colors.semantic.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Continue button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.continueButton, (!isValid || isLoading) && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isValid || isLoading}
          >
            <LinearGradient
              colors={isValid ? [colors.primary.gold, '#e6c358'] : ['#555', '#444']}
              style={styles.continueButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              <Text style={[
                styles.continueButtonText,
                !isValid && styles.continueButtonTextDisabled,
              ]}>Continue</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={isValid ? colors.primary.navy : colors.neutral[400]}
              />
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: -spacing[2],
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary.gold,
    borderRadius: 2,
  },
  titleSection: {
    marginBottom: spacing[6],
  },
  stepLabel: {
    fontSize: 13,
    color: colors.primary.gold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[2],
  },
  hebrewTitle: {
    fontSize: 24,
    color: colors.primary.gold,
    marginBottom: spacing[1],
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white60,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[3],
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    minWidth: '30%',
  },
  optionButtonSelected: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  optionHebrew: {
    fontSize: 18,
    color: colors.primary.gold,
    marginBottom: 2,
  },
  optionHebrewSelected: {
    color: colors.primary.navy,
  },
  optionLabel: {
    fontSize: 12,
    color: colors.transparent.white60,
  },
  optionLabelSelected: {
    color: colors.primary.navy,
  },
  observanceList: {
    gap: spacing[3],
  },
  observanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    gap: spacing[3],
  },
  observanceButtonSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.primary.gold,
  },
  observanceContent: {
    flex: 1,
  },
  observanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: 2,
  },
  observanceLabelSelected: {
    color: colors.primary.gold,
  },
  observanceDescription: {
    fontSize: 13,
    color: colors.transparent.white50,
  },
  observanceDescriptionSelected: {
    color: colors.transparent.white70,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.transparent.white40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary.gold,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.gold,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    padding: spacing[3],
    borderRadius: borderRadius.md,
    gap: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    marginBottom: spacing[4],
  },
  errorText: {
    flex: 1,
    color: colors.semantic.error,
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingTop: spacing[4],
  },
  continueButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    shadowOpacity: 0,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  continueButtonTextDisabled: {
    color: colors.neutral[400],
  },
});
