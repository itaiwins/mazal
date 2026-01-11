/**
 * Jewish Identity Screen
 *
 * Select Jewish background and observance level
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
import { JEWISH_BACKGROUNDS, OBSERVANCE_LEVELS } from '@/lib/constants/jewish';

export default function JewishIdentityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateJewishIdentity = useOnboardingStore((s) => s.updateJewishIdentity);

  const [background, setBackground] = useState(data?.jewish_background || '');
  const [observance, setObservance] = useState(data?.observance_level || '');

  const isValid = background && observance;

  const handleContinue = () => {
    updateJewishIdentity({
      jewish_background: background as any,
      observance_level: observance as any,
    });
    router.push('/(onboarding)/location');
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
            Your Jewish journey
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Help us understand your background
          </Text>
        </View>

        {/* Background */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Jewish background
          </Text>
          <View style={styles.optionsGrid}>
            {JEWISH_BACKGROUNDS.map((bg) => (
              <Pressable
                key={bg.id}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      background === bg.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      background === bg.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() => setBackground(bg.id)}
              >
                <Text style={styles.optionEmoji}>{bg.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color:
                        background === bg.id
                          ? colors.primary.navy
                          : theme.colors.text,
                    },
                  ]}
                >
                  {bg.label}
                </Text>
                {background === bg.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.primary.navy}
                    style={styles.checkmark}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Observance Level */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Observance level
          </Text>
          <View style={styles.optionsList}>
            {OBSERVANCE_LEVELS.map((level) => (
              <Pressable
                key={level.id}
                style={[
                  styles.observanceOption,
                  {
                    backgroundColor:
                      observance === level.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      observance === level.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() => setObservance(level.id)}
              >
                <View style={styles.observanceContent}>
                  <Text
                    style={[
                      styles.observanceLabel,
                      {
                        color:
                          observance === level.id
                            ? colors.primary.navy
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {level.label}
                  </Text>
                  <Text
                    style={[
                      styles.observanceDescription,
                      {
                        color:
                          observance === level.id
                            ? colors.primary.navy
                            : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {level.description}
                  </Text>
                </View>
                {observance === level.id && (
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
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: spacing[1.5],
  },
  optionEmoji: {
    fontSize: 16,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkmark: {
    marginLeft: spacing[1],
  },
  optionsList: {
    gap: spacing[3],
  },
  observanceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  observanceContent: {
    flex: 1,
  },
  observanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  observanceDescription: {
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
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
