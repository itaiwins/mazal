/**
 * Shidduch Profile Setup
 *
 * Extended profile for Orthodox matching
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const HASHKAFOS = [
  { id: 'yeshivish', label: 'Yeshivish' },
  { id: 'modern_orthodox_machmir', label: 'Modern Orthodox Machmir' },
  { id: 'modern_orthodox', label: 'Modern Orthodox' },
  { id: 'chassidish', label: 'Chassidish' },
  { id: 'sephardic', label: 'Sephardic' },
  { id: 'litvish', label: 'Litvish' },
];

const LEARNING_SCHEDULE = [
  { id: 'full_time', label: 'Full-time learning' },
  { id: 'morning_seder', label: 'Morning seder' },
  { id: 'evening_seder', label: 'Evening seder' },
  { id: 'daf_yomi', label: 'Daf Yomi' },
  { id: 'weekly', label: 'Weekly shiur' },
  { id: 'casual', label: 'Casual learning' },
];

const TZNIUS_LEVEL = [
  { id: 'strict', label: 'Strict tznius' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'flexible', label: 'Flexible' },
];

export default function ShidduchProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [hashkafa, setHashkafa] = useState('');
  const [yeshiva, setYeshiva] = useState('');
  const [seminary, setSeminary] = useState('');
  const [learningSchedule, setLearningSchedule] = useState('');
  const [tzniusLevel, setTzniusLevel] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [referencePhone, setReferencePhone] = useState('');

  const isValid = hashkafa && (yeshiva || seminary);

  const handleSave = () => {
    // In production, save to Supabase
    console.log('Saving shidduch profile...');
    router.push('/(orthodox)/guidelines');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Shidduch Profile
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro */}
        <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
          This information helps shadchanim and potential matches understand your
          background and hashkafa.
        </Text>

        {/* Hashkafa */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Hashkafa *
          </Text>
          <View style={styles.optionsWrap}>
            {HASHKAFOS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      hashkafa === option.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      hashkafa === option.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() => setHashkafa(option.id)}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color:
                        hashkafa === option.id
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

        {/* Yeshiva/Seminary */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Yeshiva / Beis Medrash
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholder="e.g., Mir, BMG, YU"
            placeholderTextColor={theme.colors.textTertiary}
            value={yeshiva}
            onChangeText={setYeshiva}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Seminary (women)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholder="e.g., BJJ, Michlalah, Stern"
            placeholderTextColor={theme.colors.textTertiary}
            value={seminary}
            onChangeText={setSeminary}
            autoCapitalize="words"
          />
        </View>

        {/* Learning Schedule */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Learning Schedule
          </Text>
          <View style={styles.optionsWrap}>
            {LEARNING_SCHEDULE.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      learningSchedule === option.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      learningSchedule === option.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() =>
                  setLearningSchedule(
                    learningSchedule === option.id ? '' : option.id
                  )
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color:
                        learningSchedule === option.id
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

        {/* Tznius Level (for women) */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Tznius Level
          </Text>
          <View style={styles.optionsRow}>
            {TZNIUS_LEVEL.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor:
                      tzniusLevel === option.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      tzniusLevel === option.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() =>
                  setTzniusLevel(tzniusLevel === option.id ? '' : option.id)
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color:
                        tzniusLevel === option.id
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

        {/* Reference */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Reference (Rav/Rebbetzin)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholder="Reference name"
            placeholderTextColor={theme.colors.textTertiary}
            value={referenceName}
            onChangeText={setReferenceName}
            autoCapitalize="words"
          />
          <TextInput
            style={[
              styles.input,
              styles.inputMargin,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholder="Reference phone number"
            placeholderTextColor={theme.colors.textTertiary}
            value={referencePhone}
            onChangeText={setReferencePhone}
            keyboardType="phone-pad"
          />
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            References are only shared with serious inquiries
          </Text>
        </View>

        {/* Save Button */}
        <Pressable
          style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isValid}
        >
          <Text style={styles.saveButtonText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[6],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  input: {
    fontSize: 16,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
  },
  inputMargin: {
    marginTop: spacing[2],
  },
  hint: {
    fontSize: 12,
    marginTop: spacing[2],
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  option: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  optionPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing[4],
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
