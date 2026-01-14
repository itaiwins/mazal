/**
 * Relationship Goals Screen
 *
 * What are you looking for?
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

const RELATIONSHIP_GOALS = [
  {
    id: 'marriage',
    label: 'Marriage',
    emoji: '💍',
    description: 'Looking for my bashert',
  },
  {
    id: 'long_term',
    label: 'Long-term relationship',
    emoji: '💕',
    description: 'Something serious',
  },
  {
    id: 'dating',
    label: 'Dating',
    emoji: '🌹',
    description: 'Open to seeing where things go',
  },
  {
    id: 'not_sure',
    label: 'Not sure yet',
    emoji: '🤔',
    description: "I'll know it when I find it",
  },
];

const LOOKING_FOR = [
  { id: 'male', label: 'Men', icon: 'male' },
  { id: 'female', label: 'Women', icon: 'female' },
  { id: 'everyone', label: 'Everyone', icon: 'people' },
];

const WANTS_KIDS = [
  { id: 'yes', label: 'Want kids', emoji: '👶' },
  { id: 'have_want_more', label: 'Have kids, want more', emoji: '👨‍👧' },
  { id: 'have_done', label: "Have kids, don't want more", emoji: '👨‍👧‍👦' },
  { id: 'no', label: "Don't want kids", emoji: '🚫' },
  { id: 'not_sure', label: 'Not sure', emoji: '🤷' },
];

export default function RelationshipGoalsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateRelationshipGoals = useOnboardingStore((s) => s.updateRelationshipGoals);

  const [goal, setGoal] = useState(data?.looking_for || '');
  const [genderPreference, setGenderPreference] = useState<string[]>(data?.gender_preference || []);
  const [wantsKids, setWantsKids] = useState(data?.wants_children || '');

  // Map UI goal values to database values
  const goalToDbValue = (uiGoal: string): string => {
    const mapping: Record<string, string> = {
      'marriage': 'marriage_minded',
      'long_term': 'serious',
      'dating': 'casual',
      'not_sure': 'open',
    };
    return mapping[uiGoal] || 'open';
  };

  // Only require goal for now
  const isValid = goal;

  const handleContinue = () => {
    updateRelationshipGoals({
      looking_for: goalToDbValue(goal) as any,
      gender_preference: genderPreference as ('male' | 'female')[],
      wants_children: wantsKids as any || null,
    });
    router.push('/(onboarding)/dealbreakers');
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
            What are you looking for?
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Be honest - it helps find better matches
          </Text>
        </View>

        {/* Relationship Goal */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Relationship goal *
          </Text>
          <View style={styles.goalOptions}>
            {RELATIONSHIP_GOALS.map((g) => (
              <Pressable
                key={g.id}
                style={[
                  styles.goalOption,
                  {
                    backgroundColor:
                      goal === g.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      goal === g.id ? colors.primary.gold : colors.neutral[200],
                  },
                ]}
                onPress={() => setGoal(g.id)}
              >
                <Text style={styles.goalEmoji}>{g.emoji}</Text>
                <View style={styles.goalContent}>
                  <Text
                    style={[
                      styles.goalLabel,
                      {
                        color:
                          goal === g.id
                            ? colors.primary.navy
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {g.label}
                  </Text>
                  <Text
                    style={[
                      styles.goalDescription,
                      {
                        color:
                          goal === g.id
                            ? colors.primary.navy
                            : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {g.description}
                  </Text>
                </View>
                {goal === g.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary.navy}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Looking For */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Show me *
          </Text>
          <View style={styles.lookingForOptions}>
            {LOOKING_FOR.map((l) => {
              const isSelected = l.id === 'everyone'
                ? genderPreference.includes('male') && genderPreference.includes('female')
                : genderPreference.includes(l.id);
              return (
                <Pressable
                  key={l.id}
                  style={[
                    styles.lookingForOption,
                    {
                      backgroundColor: isSelected
                        ? colors.primary.gold
                        : theme.colors.surface,
                      borderColor: isSelected
                        ? colors.primary.gold
                        : colors.neutral[200],
                    },
                  ]}
                  onPress={() => {
                    if (l.id === 'everyone') {
                      setGenderPreference(['male', 'female']);
                    } else {
                      setGenderPreference([l.id]);
                    }
                  }}
                >
                  <Ionicons
                    name={l.icon as any}
                    size={24}
                    color={isSelected ? colors.primary.navy : theme.colors.icon}
                  />
                  <Text
                    style={[
                      styles.lookingForLabel,
                      {
                        color: isSelected
                          ? colors.primary.navy
                          : theme.colors.text,
                      },
                    ]}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Kids */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Family plans (optional)
          </Text>
          <View style={styles.kidsOptions}>
            {WANTS_KIDS.map((k) => (
              <Pressable
                key={k.id}
                style={[
                  styles.kidOption,
                  {
                    backgroundColor:
                      wantsKids === k.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      wantsKids === k.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() => setWantsKids(wantsKids === k.id ? '' : k.id)}
              >
                <Text style={styles.kidEmoji}>{k.emoji}</Text>
                <Text
                  style={[
                    styles.kidLabel,
                    {
                      color:
                        wantsKids === k.id
                          ? colors.primary.navy
                          : theme.colors.text,
                    },
                  ]}
                >
                  {k.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.continueButton,
            !isValid && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid}
        >
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
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  header: {
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
  },
  goalOptions: {
    gap: spacing[3],
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    gap: spacing[3],
  },
  goalEmoji: {
    fontSize: 28,
  },
  goalContent: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  goalDescription: {
    fontSize: 13,
  },
  lookingForOptions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  lookingForOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    gap: spacing[2],
  },
  lookingForLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  kidsOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  kidOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: spacing[2],
  },
  kidEmoji: {
    fontSize: 16,
  },
  kidLabel: {
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
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
