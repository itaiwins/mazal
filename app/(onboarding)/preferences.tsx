/**
 * Preferences Screen
 *
 * Set partner preferences (age, distance, etc.)
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

const AGE_MIN = 18;
const AGE_MAX = 65;
const DISTANCE_OPTIONS = [5, 10, 25, 50, 100, 500];

export default function PreferencesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);

  const [ageRange, setAgeRange] = useState<[number, number]>([22, 35]);
  const [distance, setDistance] = useState(25);
  const [showGlobal, setShowGlobal] = useState(false);

  const handleContinue = () => {
    // Preferences are stored separately (not in onboarding data)
    // For now, just navigate to the next screen
    router.push('/(onboarding)/notifications');
  };

  const adjustAge = (index: 0 | 1, delta: number) => {
    const newRange = [...ageRange] as [number, number];
    newRange[index] = Math.max(
      AGE_MIN,
      Math.min(AGE_MAX, newRange[index] + delta)
    );
    // Ensure min <= max
    if (index === 0 && newRange[0] > newRange[1]) {
      newRange[1] = newRange[0];
    }
    if (index === 1 && newRange[1] < newRange[0]) {
      newRange[0] = newRange[1];
    }
    setAgeRange(newRange);
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
            Match preferences
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Who would you like to meet?
          </Text>
        </View>

        {/* Age Range */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Age range
          </Text>
          <Text style={[styles.valueLabel, { color: colors.primary.gold }]}>
            {ageRange[0]} - {ageRange[1]} years
          </Text>
          <View style={styles.ageControls}>
            {/* Min Age */}
            <View style={styles.ageControl}>
              <Text style={[styles.ageLabel, { color: theme.colors.textSecondary }]}>
                Minimum
              </Text>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface }]}
                  onPress={() => adjustAge(0, -1)}
                >
                  <Ionicons name="remove" size={20} color={theme.colors.icon} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                  {ageRange[0]}
                </Text>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface }]}
                  onPress={() => adjustAge(0, 1)}
                >
                  <Ionicons name="add" size={20} color={theme.colors.icon} />
                </Pressable>
              </View>
            </View>

            {/* Max Age */}
            <View style={styles.ageControl}>
              <Text style={[styles.ageLabel, { color: theme.colors.textSecondary }]}>
                Maximum
              </Text>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface }]}
                  onPress={() => adjustAge(1, -1)}
                >
                  <Ionicons name="remove" size={20} color={theme.colors.icon} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                  {ageRange[1]}
                </Text>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface }]}
                  onPress={() => adjustAge(1, 1)}
                >
                  <Ionicons name="add" size={20} color={theme.colors.icon} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Maximum distance
          </Text>
          <Text style={[styles.valueLabel, { color: colors.primary.gold }]}>
            {distance >= 500 ? 'Anywhere' : `${distance} miles`}
          </Text>
          <View style={styles.distanceOptions}>
            {DISTANCE_OPTIONS.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.distanceOption,
                  {
                    backgroundColor:
                      distance === d ? colors.primary.gold : theme.colors.surface,
                    borderColor:
                      distance === d ? colors.primary.gold : colors.neutral[200],
                  },
                ]}
                onPress={() => setDistance(d)}
              >
                <Text
                  style={[
                    styles.distanceLabel,
                    {
                      color: distance === d ? colors.primary.navy : theme.colors.text,
                    },
                  ]}
                >
                  {d >= 500 ? 'Any' : `${d} mi`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Global Discovery */}
        <View style={styles.section}>
          <Pressable
            style={[
              styles.globalOption,
              { backgroundColor: theme.colors.surface },
            ]}
            onPress={() => setShowGlobal(!showGlobal)}
          >
            <View style={styles.globalContent}>
              <View style={styles.globalIcon}>
                <Ionicons name="globe" size={24} color={colors.primary.gold} />
              </View>
              <View style={styles.globalText}>
                <Text style={[styles.globalLabel, { color: theme.colors.text }]}>
                  Global Discovery
                </Text>
                <Text
                  style={[styles.globalDescription, { color: theme.colors.textSecondary }]}
                >
                  See and be seen by people worldwide
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                showGlobal && styles.checkboxChecked,
              ]}
            >
              {showGlobal && (
                <Ionicons name="checkmark" size={16} color={colors.primary.navy} />
              )}
            </View>
          </Pressable>
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.transparent.gold20 }]}>
          <Ionicons name="bulb" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            You can always change these preferences later in your settings. We'll use
            these to show you the most relevant matches.
          </Text>
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
    marginBottom: spacing[1],
  },
  valueLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing[3],
  },
  ageControls: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  ageControl: {
    flex: 1,
  },
  ageLabel: {
    fontSize: 13,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 24,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  distanceOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  distanceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  globalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },
  globalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing[3],
  },
  globalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  globalText: {
    flex: 1,
  },
  globalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[0.5],
  },
  globalDescription: {
    fontSize: 13,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
