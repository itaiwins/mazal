/**
 * Shidduch Onboarding - Looking For
 *
 * Collect preferences for what they're seeking in a spouse
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
  { id: 'modern_orthodox', label: 'Modern Orthodox' },
  { id: 'yeshivish', label: 'Yeshivish' },
  { id: 'chassidish', label: 'Chassidish' },
  { id: 'litvish', label: 'Litvish' },
  { id: 'sephardic', label: 'Sephardic' },
  { id: 'chabad', label: 'Chabad' },
];

const TIMELINE_OPTIONS = [
  { id: 'ready_now', label: 'Ready Now' },
  { id: '6_months', label: 'Within 6 Months' },
  { id: '1_year', label: 'Within a Year' },
  { id: 'not_rushed', label: 'Not Rushed' },
];

const WORKING_OPTIONS = [
  { id: 'yes', label: 'Yes, supporting is important' },
  { id: 'prefer', label: 'Prefer, but not required' },
  { id: 'flexible', label: 'Flexible - either way' },
  { id: 'no_preference', label: 'No preference' },
];

const LEARNING_OPTIONS = [
  { id: 'full_time', label: 'Full-time learning' },
  { id: 'few_years', label: 'Learning for a few years' },
  { id: 'working_learning', label: 'Working with set learning' },
  { id: 'flexible', label: 'Flexible' },
];

export default function ShidduchLookingForScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useShidduchOnboardingStore();

  const [description, setDescription] = useState(data.lookingForDescription || '');
  const [ageMin, setAgeMin] = useState(data.ageRangeMin?.toString() || '');
  const [ageMax, setAgeMax] = useState(data.ageRangeMax?.toString() || '');
  const [preferredCommunities, setPreferredCommunities] = useState<string[]>(
    data.preferredCommunities || []
  );
  const [timeline, setTimeline] = useState(data.marriageTimeline || '');
  const [wifeWorking, setWifeWorking] = useState(data.wifeWorking || '');
  const [husbandLearning, setHusbandLearning] = useState(data.husbandLearning || '');

  const isMale = data.gender === 'male';
  const isValid = description.trim().length >= 20 || timeline.length > 0;

  const toggleCommunity = (id: string) => {
    setPreferredCommunities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    updateData({
      lookingForDescription: description.trim(),
      ageRangeMin: ageMin ? parseInt(ageMin) : undefined,
      ageRangeMax: ageMax ? parseInt(ageMax) : undefined,
      preferredCommunities,
      marriageTimeline: timeline,
      wifeWorking: isMale ? wifeWorking : undefined,
      husbandLearning: !isMale ? husbandLearning : undefined,
    });
    router.push('/(shidduch-onboarding)/references');
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
          <View style={[styles.progressBar, { width: '67%' }]} />
        </View>
        <Text style={styles.stepText}>6 of 9</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>מה אתה/את מחפש/ת</Text>
          <Text style={styles.title}>What You're Looking For</Text>
          <Text style={styles.subtitle}>Describe your ideal match</Text>
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.field}>
          <Text style={styles.label}>Describe Your Ideal Match</Text>
          <Text style={styles.labelHint}>
            What qualities, values, and characteristics are most important to you?
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What are you looking for in a spouse? (personality, values, goals...)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </Animated.View>

        {/* Age Range */}
        <Animated.View entering={FadeInDown.delay(350)} style={styles.field}>
          <Text style={styles.label}>Age Range</Text>
          <View style={styles.ageRow}>
            <View style={styles.ageField}>
              <Text style={styles.ageLabel}>From</Text>
              <TextInput
                style={styles.ageInput}
                placeholder="18"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={ageMin}
                onChangeText={setAgeMin}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <Text style={styles.ageDash}>—</Text>
            <View style={styles.ageField}>
              <Text style={styles.ageLabel}>To</Text>
              <TextInput
                style={styles.ageInput}
                placeholder="30"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={ageMax}
                onChangeText={setAgeMax}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
        </Animated.View>

        {/* Preferred Communities */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.field}>
          <Text style={styles.label}>Open to Communities</Text>
          <Text style={styles.labelHint}>Select all that apply</Text>
          <View style={styles.chipGrid}>
            {COMMUNITIES.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.chip,
                  preferredCommunities.includes(c.id) && styles.chipSelected,
                ]}
                onPress={() => toggleCommunity(c.id)}
              >
                {preferredCommunities.includes(c.id) && (
                  <Ionicons name="checkmark" size={14} color="#d4af37" style={styles.chipIcon} />
                )}
                <Text style={[
                  styles.chipLabel,
                  preferredCommunities.includes(c.id) && styles.chipLabelSelected,
                ]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Marriage Timeline */}
        <Animated.View entering={FadeInDown.delay(450)} style={styles.field}>
          <Text style={styles.label}>Marriage Timeline</Text>
          <View style={styles.optionsList}>
            {TIMELINE_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.optionItem,
                  timeline === option.id && styles.optionItemSelected,
                ]}
                onPress={() => setTimeline(option.id)}
              >
                <View style={[
                  styles.radioOuter,
                  timeline === option.id && styles.radioOuterSelected,
                ]}>
                  {timeline === option.id && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.optionLabel,
                  timeline === option.id && styles.optionLabelSelected,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Wife Working (for men) */}
        {isMale && (
          <Animated.View entering={FadeInDown.delay(500)} style={styles.field}>
            <Text style={styles.label}>Wife Working?</Text>
            <Text style={styles.labelHint}>What are your expectations?</Text>
            <View style={styles.optionsList}>
              {WORKING_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.optionItem,
                    wifeWorking === option.id && styles.optionItemSelected,
                  ]}
                  onPress={() => setWifeWorking(option.id)}
                >
                  <View style={[
                    styles.radioOuter,
                    wifeWorking === option.id && styles.radioOuterSelected,
                  ]}>
                    {wifeWorking === option.id && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionLabel,
                    wifeWorking === option.id && styles.optionLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Husband Learning (for women) */}
        {!isMale && (
          <Animated.View entering={FadeInDown.delay(500)} style={styles.field}>
            <Text style={styles.label}>Husband's Learning</Text>
            <Text style={styles.labelHint}>What type of learner are you looking for?</Text>
            <View style={styles.optionsList}>
              {LEARNING_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.optionItem,
                    husbandLearning === option.id && styles.optionItemSelected,
                  ]}
                  onPress={() => setHusbandLearning(option.id)}
                >
                  <View style={[
                    styles.radioOuter,
                    husbandLearning === option.id && styles.radioOuterSelected,
                  ]}>
                    {husbandLearning === option.id && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionLabel,
                    husbandLearning === option.id && styles.optionLabelSelected,
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
    fontSize: 26,
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
    minHeight: 100,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
    marginTop: 4,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ageField: {
    flex: 1,
  },
  ageLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  ageInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ageDash: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
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
  chipIcon: {
    marginRight: 4,
  },
  chipLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  chipLabelSelected: {
    color: '#d4af37',
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
