/**
 * Shidduch Onboarding - Hashkafa
 *
 * Collect religious outlook and observance level
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useShidduchOnboardingStore } from '@/stores/shidduchOnboardingStore';

const COMMUNITIES = [
  { id: 'modern_orthodox', label: 'Modern Orthodox', hebrew: 'דתי לאומי' },
  { id: 'yeshivish', label: 'Yeshivish', hebrew: 'ישיבתי' },
  { id: 'chassidish', label: 'Chassidish', hebrew: 'חסידי' },
  { id: 'litvish', label: 'Litvish', hebrew: 'ליטאי' },
  { id: 'sephardic', label: 'Sephardic', hebrew: 'ספרדי' },
  { id: 'chabad', label: 'Chabad', hebrew: 'חב״ד' },
  { id: 'other', label: 'Other', hebrew: 'אחר' },
];

const MINYAN_OPTIONS = [
  { id: 'always', label: 'Always (3x daily)' },
  { id: 'morning_evening', label: 'Morning & Evening' },
  { id: 'shabbos_yomtov', label: 'Shabbos & Yom Tov' },
  { id: 'occasionally', label: 'Occasionally' },
];

const LEARNING_SCHEDULES = [
  { id: 'full_time', label: 'Full-time Kollel' },
  { id: 'night_seder', label: 'Night Seder' },
  { id: 'daf_yomi', label: 'Daf Yomi' },
  { id: 'chavrusas', label: 'Regular Chavrusas' },
  { id: 'shiurim', label: 'Weekly Shiurim' },
  { id: 'self_study', label: 'Self-Study' },
];

const KOLLEL_INTEREST = [
  { id: 'full_time', label: 'Full-time learning' },
  { id: 'few_years', label: 'A few years' },
  { id: 'part_time', label: 'Part-time learning' },
  { id: 'working', label: 'Working with set learning times' },
];

export default function ShidduchHashkafaScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useShidduchOnboardingStore();

  const [community, setCommunity] = useState(data.community || '');
  const [chassidus, setChassidus] = useState(data.chassidus || '');
  const [hashkafaDetails, setHashkafaDetails] = useState(data.hashkafaDetails || '');
  const [minyanFrequency, setMinyanFrequency] = useState(data.minyanFrequency || '');
  const [learningSchedule, setLearningSchedule] = useState(data.learningSchedule || '');
  const [kollelInterest, setKollelInterest] = useState(data.kollelInterest || '');

  const isMale = data.gender === 'male';
  const isChassidish = community === 'chassidish';
  const isValid = community.length > 0;

  const handleContinue = () => {
    updateData({
      community,
      chassidus: chassidus.trim(),
      hashkafaDetails: hashkafaDetails.trim(),
      minyanFrequency: isMale ? minyanFrequency : undefined,
      learningSchedule: isMale ? learningSchedule : undefined,
      kollelInterest: isMale ? kollelInterest : undefined,
    });
    router.push('/(shidduch-onboarding)/looking-for');
  };

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
          <View style={[styles.progressBar, { width: '50%' }]} />
        </View>
        <Text style={styles.stepText}>4 of 8</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>השקפה</Text>
          <Text style={styles.title}>Religious Outlook</Text>
          <Text style={styles.subtitle}>Your hashkafa and community</Text>
        </Animated.View>

        {/* Community */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.field}>
          <Text style={styles.label}>Community *</Text>
          <Text style={styles.labelHint}>Which community best describes you?</Text>
          <View style={styles.communityGrid}>
            {COMMUNITIES.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.communityOption,
                  community === c.id && styles.communityOptionSelected,
                ]}
                onPress={() => setCommunity(c.id)}
              >
                <Text style={styles.communityHebrew}>{c.hebrew}</Text>
                <Text style={[
                  styles.communityLabel,
                  community === c.id && styles.communityLabelSelected,
                ]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Chassidus Type (conditional) */}
        {isChassidish && (
          <Animated.View entering={FadeInDown.delay(350)} style={styles.field}>
            <Text style={styles.label}>Chassidus</Text>
            <TextInput
              style={styles.input}
              placeholder="Which chassidus? (e.g., Satmar, Belz, Ger)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={chassidus}
              onChangeText={setChassidus}
            />
          </Animated.View>
        )}

        {/* Hashkafa Details */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.field}>
          <Text style={styles.label}>Describe Your Hashkafa</Text>
          <Text style={styles.labelHint}>Any additional details about your religious outlook</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="E.g., machmir on kashrus, open-minded on certain issues..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={hashkafaDetails}
            onChangeText={setHashkafaDetails}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Animated.View>

        {/* Minyan Frequency (for men) */}
        {isMale && (
          <Animated.View entering={FadeInDown.delay(450)} style={styles.field}>
            <Text style={styles.label}>Minyan Attendance</Text>
            <View style={styles.optionsList}>
              {MINYAN_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.optionItem,
                    minyanFrequency === option.id && styles.optionItemSelected,
                  ]}
                  onPress={() => setMinyanFrequency(option.id)}
                >
                  <View style={[
                    styles.radioOuter,
                    minyanFrequency === option.id && styles.radioOuterSelected,
                  ]}>
                    {minyanFrequency === option.id && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionLabel,
                    minyanFrequency === option.id && styles.optionLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Learning Schedule (for men) */}
        {isMale && (
          <Animated.View entering={FadeInDown.delay(500)} style={styles.field}>
            <Text style={styles.label}>Current Learning</Text>
            <View style={styles.chipGrid}>
              {LEARNING_SCHEDULES.map((schedule) => (
                <Pressable
                  key={schedule.id}
                  style={[
                    styles.chip,
                    learningSchedule === schedule.id && styles.chipSelected,
                  ]}
                  onPress={() => setLearningSchedule(schedule.id)}
                >
                  <Text style={[
                    styles.chipLabel,
                    learningSchedule === schedule.id && styles.chipLabelSelected,
                  ]}>
                    {schedule.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Kollel Interest (for men) */}
        {isMale && (
          <Animated.View entering={FadeInDown.delay(550)} style={styles.field}>
            <Text style={styles.label}>Future Learning Plans</Text>
            <Text style={styles.labelHint}>After marriage, you envision:</Text>
            <View style={styles.optionsList}>
              {KOLLEL_INTEREST.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.optionItem,
                    kollelInterest === option.id && styles.optionItemSelected,
                  ]}
                  onPress={() => setKollelInterest(option.id)}
                >
                  <View style={[
                    styles.radioOuter,
                    kollelInterest === option.id && styles.radioOuterSelected,
                  ]}>
                    {kollelInterest === option.id && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionLabel,
                    kollelInterest === option.id && styles.optionLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInDown.delay(600)}
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable
          style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <LinearGradient
            colors={isValid ? ['#d4af37', '#f4d47c', '#d4af37'] : ['#333', '#444', '#333']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
              Continue
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={isValid ? '#0a1628' : '#666'}
            />
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
    marginBottom: 32,
  },
  field: {
    marginBottom: 28,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
    marginTop: -4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  communityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  communityOption: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  communityOptionSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  communityHebrew: {
    fontSize: 18,
    color: '#d4af37',
    marginBottom: 4,
  },
  communityLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  communityLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  optionsList: {
    gap: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  optionItemSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  optionLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  optionLabelSelected: {
    color: '#FFFFFF',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  chipLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  chipLabelSelected: {
    color: '#d4af37',
    fontWeight: '600',
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
  continueButtonDisabled: {
    shadowOpacity: 0,
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
  buttonTextDisabled: {
    color: '#666',
  },
});
