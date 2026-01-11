/**
 * Profile Verification Screen
 *
 * Verify your Jewish identity to get a verified badge
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const VERIFICATION_OPTIONS = [
  {
    id: 'photo',
    icon: 'camera',
    title: 'Photo Verification',
    description: 'Take a selfie to verify you match your photos',
    time: '~1 minute',
  },
  {
    id: 'synagogue',
    icon: 'business',
    title: 'Synagogue Membership',
    description: 'Connect with your synagogue to verify membership',
    time: '~2 days',
  },
  {
    id: 'document',
    icon: 'document-text',
    title: 'Document Upload',
    description: 'Upload a document showing your Jewish affiliation',
    time: '~1-3 days',
  },
];

export default function VerifyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleSelectOption = (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOption(optionId);
  };

  const handleContinue = () => {
    if (!selectedOption) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // In production, this would start the verification flow
    Alert.alert(
      'Verification Started',
      'We\'ll notify you once your verification is complete. This usually takes 1-3 business days.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Get Verified
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={48} color={colors.primary.gold} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
            Verify Your Profile
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
            A verified badge shows others you're authentic and helps build trust in our community.
          </Text>
        </Animated.View>

        {/* Benefits */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={[styles.benefitsCard, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.benefitsTitle, { color: theme.colors.text }]}>
            Benefits of Verification
          </Text>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
            <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
              Get a blue verified badge on your profile
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
            <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
              Appear higher in search results
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
            <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
              Build trust with potential matches
            </Text>
          </View>
        </Animated.View>

        {/* Verification Options */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.optionsSection}>
          <Text style={[styles.optionsTitle, { color: theme.colors.text }]}>
            Choose a Verification Method
          </Text>
          {VERIFICATION_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={[
                styles.optionCard,
                { backgroundColor: theme.colors.surface },
                selectedOption === option.id && styles.optionCardSelected,
              ]}
              onPress={() => handleSelectOption(option.id)}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={selectedOption === option.id ? colors.primary.gold : theme.colors.icon}
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  {option.title}
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                  {option.description}
                </Text>
                <Text style={[styles.optionTime, { color: theme.colors.textTertiary }]}>
                  {option.time}
                </Text>
              </View>
              <View
                style={[
                  styles.optionRadio,
                  selectedOption === option.id && styles.optionRadioSelected,
                ]}
              >
                {selectedOption === option.id && (
                  <Ionicons name="checkmark" size={16} color={colors.primary.white} />
                )}
              </View>
            </Pressable>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.continueButton,
            !selectedOption && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedOption}
        >
          <Text style={styles.continueButtonText}>Start Verification</Text>
        </Pressable>
      </View>
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
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsCard: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[6],
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
  },
  optionsSection: {
    marginBottom: spacing[4],
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.primary.gold,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing[1],
  },
  optionTime: {
    fontSize: 12,
  },
  optionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
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
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
