/**
 * Shidduch Onboarding - Creator Type
 *
 * Asks who is creating this profile (self, parent, grandparent, uncle, shadchan)
 * This determines the context for the rest of the onboarding flow
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useShidduchOnboardingStore, type CreatorType } from '@/stores/shidduchOnboardingStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface CreatorOption {
  id: CreatorType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

const CREATOR_OPTIONS: CreatorOption[] = [
  {
    id: 'parent',
    icon: 'people',
    title: 'Parent',
    subtitle: 'Creating a profile for my child',
  },
  {
    id: 'grandparent',
    icon: 'heart',
    title: 'Grandparent',
    subtitle: 'Creating a profile for my grandchild',
  },
  {
    id: 'uncle',
    icon: 'person-add',
    title: 'Uncle / Aunt',
    subtitle: 'Creating a profile for my niece or nephew',
  },
  {
    id: 'shadchan',
    icon: 'briefcase',
    title: 'Shadchan',
    subtitle: 'Creating a profile for a client',
  },
  {
    id: 'self',
    icon: 'person',
    title: 'Myself',
    subtitle: 'Creating my own profile',
  },
];

export default function CreatorTypeScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData, setStep } = useShidduchOnboardingStore();
  const [selected, setSelected] = useState<CreatorType | undefined>(data.creatorType);

  const handleSelect = (type: CreatorType) => {
    setSelected(type);
  };

  const handleContinue = () => {
    if (selected) {
      updateData({ creatorType: selected });
      setStep(2);
      router.push('/(shidduch-onboarding)/basics');
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0a1628']}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '11%' }]} />
          </View>
          <Text style={styles.progressText}>Step 1 of 9</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.titleSection}>
          <Text style={styles.hebrewTitle}>מי יוצר את הפרופיל?</Text>
          <Text style={styles.title}>Who is creating this profile?</Text>
          <Text style={styles.subtitle}>
            Select your relationship to the single person whose profile you're creating
          </Text>
        </Animated.View>

        {/* Creator Options */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.optionsContainer}>
          {CREATOR_OPTIONS.map((option, index) => (
            <Pressable
              key={option.id}
              style={[
                styles.optionCard,
                selected === option.id && styles.optionCardSelected,
              ]}
              onPress={() => handleSelect(option.id)}
            >
              <View
                style={[
                  styles.optionIcon,
                  selected === option.id && styles.optionIconSelected,
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={selected === option.id ? colors.primary.navy : colors.primary.gold}
                />
              </View>
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionTitle,
                    selected === option.id && styles.optionTitleSelected,
                  ]}
                >
                  {option.title}
                </Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              {selected === option.id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
              )}
            </Pressable>
          ))}
        </Animated.View>

        {/* Info Note */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={20} color={colors.transparent.gold70} />
          <Text style={styles.infoNoteText}>
            You can create and manage multiple profiles from your account.
            Each profile will be tracked to show who created it.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Bottom Button */}
      <Animated.View
        entering={FadeInUp.delay(300).springify()}
        style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing[4] }]}
      >
        <Pressable
          style={[styles.continueButton, !selected && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <LinearGradient
            colors={
              selected
                ? [colors.primary.gold, '#f4d47c', colors.primary.gold]
                : ['#666666', '#555555', '#666666']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={[styles.buttonText, !selected && styles.buttonTextDisabled]}>
              Continue
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={selected ? colors.primary.navy : '#999999'}
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
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 2,
    marginBottom: spacing[1],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.gold,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: colors.transparent.white50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  hebrewTitle: {
    fontSize: 24,
    color: colors.primary.gold,
    marginBottom: spacing[2],
    letterSpacing: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary.white,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 15,
    color: colors.transparent.white60,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing[4],
  },
  optionsContainer: {
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    gap: spacing[4],
  },
  optionCardSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.primary.gold,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconSelected: {
    backgroundColor: colors.primary.gold,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[0.5],
  },
  optionTitleSelected: {
    color: colors.primary.gold,
  },
  optionSubtitle: {
    fontSize: 13,
    color: colors.transparent.white50,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    color: colors.transparent.gold70,
    lineHeight: 18,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    backgroundColor: 'rgba(10, 22, 40, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.1)',
  },
  continueButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
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
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  buttonTextDisabled: {
    color: '#999999',
  },
});
