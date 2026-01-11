/**
 * Lifestyle Screen
 *
 * Height, habits, and lifestyle preferences
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';

const HEIGHTS = Array.from({ length: 25 }, (_, i) => {
  const inches = 54 + i; // 4'6" to 6'6"
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return {
    value: inches,
    label: `${feet}'${remainingInches}"`,
    cm: Math.round(inches * 2.54),
  };
});

const DRINKING_OPTIONS = [
  { id: 'never', label: 'Never', emoji: '🚫' },
  { id: 'rarely', label: 'Rarely', emoji: '🍷' },
  { id: 'socially', label: 'Socially', emoji: '🥂' },
  { id: 'regularly', label: 'Regularly', emoji: '🍺' },
];

const SMOKING_OPTIONS = [
  { id: 'never', label: 'Never', emoji: '🚭' },
  { id: 'sometimes', label: 'Sometimes', emoji: '🚬' },
  { id: 'regularly', label: 'Regularly', emoji: '🚬' },
];

const EXERCISE_OPTIONS = [
  { id: 'never', label: 'Never', emoji: '🛋️' },
  { id: 'sometimes', label: 'Sometimes', emoji: '🚶' },
  { id: 'active', label: 'Active', emoji: '🏃' },
  { id: 'very_active', label: 'Very Active', emoji: '💪' },
];

export default function LifestyleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateLifestyle = useOnboardingStore((s) => s.updateLifestyle);

  // Convert cm to inches for display, default 68 inches (5'8" / 173cm)
  const initialHeight = data?.height_cm ? Math.round(data.height_cm / 2.54) : 68;
  const [height, setHeight] = useState(initialHeight);
  const [drinking, setDrinking] = useState('');
  const [smoking, setSmoking] = useState('');
  const [exercise, setExercise] = useState('');

  const selectedHeight = HEIGHTS.find((h) => h.value === height);

  const handleContinue = () => {
    // Convert inches to cm for storage
    const heightCm = Math.round(height * 2.54);
    updateLifestyle({
      height_cm: heightCm,
    });
    router.push('/(onboarding)/relationship-goals');
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
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Lifestyle
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            A few more details about you
          </Text>
        </View>

        {/* Height */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Height
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.heightScroller}
          >
            {HEIGHTS.map((h) => (
              <Pressable
                key={h.value}
                style={[
                  styles.heightOption,
                  {
                    backgroundColor:
                      height === h.value
                        ? colors.primary.gold
                        : theme.colors.surface,
                  },
                ]}
                onPress={() => setHeight(h.value)}
              >
                <Text
                  style={[
                    styles.heightLabel,
                    {
                      color:
                        height === h.value
                          ? colors.primary.navy
                          : theme.colors.text,
                    },
                  ]}
                >
                  {h.label}
                </Text>
                <Text
                  style={[
                    styles.heightCm,
                    {
                      color:
                        height === h.value
                          ? colors.primary.navy
                          : theme.colors.textSecondary,
                    },
                  ]}
                >
                  {h.cm} cm
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Drinking */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Drinking
          </Text>
          <View style={styles.optionsRow}>
            {DRINKING_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      drinking === option.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      drinking === option.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() => setDrinking(drinking === option.id ? '' : option.id)}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color:
                        drinking === option.id
                          ? colors.primary.navy
                          : theme.colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Smoking */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Smoking
          </Text>
          <View style={styles.optionsRow}>
            {SMOKING_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      smoking === option.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      smoking === option.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() => setSmoking(smoking === option.id ? '' : option.id)}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color:
                        smoking === option.id
                          ? colors.primary.navy
                          : theme.colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Exercise */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Exercise
          </Text>
          <View style={styles.optionsRow}>
            {EXERCISE_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      exercise === option.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      exercise === option.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() => setExercise(exercise === option.id ? '' : option.id)}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color:
                        exercise === option.id
                          ? colors.primary.navy
                          : theme.colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[4],
  },
  header: {
    paddingHorizontal: spacing[6],
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    marginBottom: spacing[6],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[3],
    paddingHorizontal: spacing[6],
  },
  heightScroller: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
  heightOption: {
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    minWidth: 70,
  },
  heightLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  heightCm: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: spacing[2],
  },
  optionEmoji: {
    fontSize: 16,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  continueButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
