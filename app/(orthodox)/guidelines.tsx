/**
 * Tznius Guidelines
 *
 * Photo and profile guidelines for Orthodox Mode
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const PHOTO_GUIDELINES = [
  {
    icon: 'checkmark-circle',
    text: 'Modest dress that covers elbows and knees',
    allowed: true,
  },
  {
    icon: 'checkmark-circle',
    text: 'Married women: Tichel, sheitel, or hat',
    allowed: true,
  },
  {
    icon: 'checkmark-circle',
    text: 'Clear face photos (not group photos)',
    allowed: true,
  },
  {
    icon: 'checkmark-circle',
    text: 'Natural, authentic photos',
    allowed: true,
  },
  {
    icon: 'close-circle',
    text: 'Sleeveless or low-cut tops',
    allowed: false,
  },
  {
    icon: 'close-circle',
    text: 'Pants (for women)',
    allowed: false,
  },
  {
    icon: 'close-circle',
    text: 'Swimwear or athletic wear',
    allowed: false,
  },
  {
    icon: 'close-circle',
    text: 'Mixed-gender settings',
    allowed: false,
  },
];

const PROFILE_GUIDELINES = [
  'Be honest about your hashkafa and level of observance',
  'Include relevant yeshiva/seminary information',
  'Provide at least one reference (Rav, Rebbetzin, or family friend)',
  'Keep bio language appropriate and refined',
  'Focus on middos, values, and life goals',
];

export default function GuidelinesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleAccept = () => {
    // Mark guidelines as accepted and navigate
    router.replace('/(tabs)');
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
          Community Guidelines
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
      >
        {/* Intro */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
            To maintain a tznius environment, please follow these guidelines. Profiles
            that don't comply may be removed.
          </Text>
        </Animated.View>

        {/* Photo Guidelines */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Photo Guidelines
          </Text>
          <View style={[styles.guidelinesCard, { backgroundColor: theme.colors.surface }]}>
            {PHOTO_GUIDELINES.map((guideline, index) => (
              <View key={index} style={styles.guidelineItem}>
                <Ionicons
                  name={guideline.icon as any}
                  size={20}
                  color={
                    guideline.allowed
                      ? colors.semantic.success
                      : colors.semantic.error
                  }
                />
                <Text
                  style={[
                    styles.guidelineText,
                    { color: theme.colors.text },
                  ]}
                >
                  {guideline.text}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Profile Guidelines */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Profile Guidelines
          </Text>
          <View style={[styles.guidelinesCard, { backgroundColor: theme.colors.surface }]}>
            {PROFILE_GUIDELINES.map((guideline, index) => (
              <View key={index} style={styles.guidelineItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary.gold}
                />
                <Text
                  style={[
                    styles.guidelineText,
                    { color: theme.colors.text },
                  ]}
                >
                  {guideline}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Privacy Note */}
        <Animated.View
          entering={FadeInDown.delay(400).springify()}
          style={[styles.privacyCard, { backgroundColor: colors.transparent.gold20 }]}
        >
          <Ionicons name="shield-checkmark" size={24} color={colors.primary.gold} />
          <View style={styles.privacyContent}>
            <Text style={[styles.privacyTitle, { color: theme.colors.text }]}>
              Your Privacy Matters
            </Text>
            <Text style={[styles.privacyText, { color: theme.colors.textSecondary }]}>
              Orthodox Mode profiles are only visible to other verified Orthodox Mode
              users. Your profile will not appear in regular search results.
            </Text>
          </View>
        </Animated.View>

        {/* Moderation Note */}
        <Animated.View
          entering={FadeInDown.delay(500).springify()}
          style={[styles.moderationNote, { backgroundColor: theme.colors.surface }]}
        >
          <Ionicons name="eye" size={20} color={theme.colors.icon} />
          <Text style={[styles.moderationText, { color: theme.colors.textSecondary }]}>
            All photos are reviewed by our moderation team to ensure community
            standards are maintained.
          </Text>
        </Animated.View>

        {/* Accept Button */}
        <Animated.View entering={FadeInDown.delay(600).springify()}>
          <Pressable style={styles.acceptButton} onPress={handleAccept}>
            <Text style={styles.acceptButtonText}>I Accept These Guidelines</Text>
          </Pressable>
        </Animated.View>
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
    paddingTop: spacing[4],
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing[3],
  },
  guidelinesCard: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  guidelineText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  privacyCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  privacyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  moderationNote: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  moderationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  acceptButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
