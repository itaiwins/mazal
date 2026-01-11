/**
 * Dealbreakers Screen
 *
 * Set must-haves and dealbreakers
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { JEWISH_BACKGROUNDS } from '@/lib/constants/jewish';

interface Dealbreaker {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const DEALBREAKERS: Dealbreaker[] = [
  {
    id: 'jewish_only',
    label: 'Jewish only',
    description: 'Only show me Jewish matches',
    icon: 'star',
  },
  {
    id: 'kosher',
    label: 'Keeps kosher',
    description: 'My match must keep kosher',
    icon: 'restaurant',
  },
  {
    id: 'shabbat',
    label: 'Observes Shabbat',
    description: 'My match must observe Shabbat',
    icon: 'flame',
  },
  {
    id: 'no_smoking',
    label: 'Non-smoker',
    description: 'My match must not smoke',
    icon: 'ban',
  },
  {
    id: 'wants_kids',
    label: 'Wants children',
    description: 'My match must want children',
    icon: 'people',
  },
  {
    id: 'college_educated',
    label: 'College educated',
    description: 'My match must have a degree',
    icon: 'school',
  },
];

export default function DealbreakersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateRelationshipGoals = useOnboardingStore((s) => s.updateRelationshipGoals);

  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [acceptedBackgrounds, setAcceptedBackgrounds] = useState<string[]>(
    JEWISH_BACKGROUNDS.map((b) => b.id)
  );

  const toggleDealbreaker = (id: string) => {
    setDealbreakers((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleBackground = (id: string) => {
    setAcceptedBackgrounds((prev) => {
      if (prev.includes(id)) {
        // Don't allow removing all options
        if (prev.length === 1) return prev;
        return prev.filter((b) => b !== id);
      }
      return [...prev, id];
    });
  };

  const handleContinue = () => {
    // Store dealbreaker preferences
    updateRelationshipGoals({
      partner_must_be_jewish: dealbreakers.includes('jewish_only'),
    });
    router.push('/(onboarding)/prompts');
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
            Dealbreakers
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Set your must-haves (you can change these later)
          </Text>
        </View>

        {/* Dealbreakers */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Must-haves
          </Text>
          <View style={styles.dealbreakers}>
            {DEALBREAKERS.map((db) => (
              <Pressable
                key={db.id}
                style={[
                  styles.dealbreakerItem,
                  { backgroundColor: theme.colors.surface },
                ]}
                onPress={() => toggleDealbreaker(db.id)}
              >
                <View style={styles.dealbreakerLeft}>
                  <Ionicons
                    name={db.icon as any}
                    size={22}
                    color={
                      dealbreakers.includes(db.id)
                        ? colors.primary.gold
                        : theme.colors.icon
                    }
                  />
                  <View style={styles.dealbreakerContent}>
                    <Text
                      style={[styles.dealbreakerLabel, { color: theme.colors.text }]}
                    >
                      {db.label}
                    </Text>
                    <Text
                      style={[
                        styles.dealbreakerDescription,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {db.description}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={dealbreakers.includes(db.id)}
                  onValueChange={() => toggleDealbreaker(db.id)}
                  trackColor={{
                    false: colors.neutral[200],
                    true: colors.primary.gold,
                  }}
                  thumbColor={colors.primary.white}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Jewish Backgrounds */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Jewish backgrounds I'm open to
          </Text>
          <Text
            style={[styles.sectionHint, { color: theme.colors.textTertiary }]}
          >
            Select all that apply
          </Text>
          <View style={styles.backgrounds}>
            {JEWISH_BACKGROUNDS.map((bg) => (
              <Pressable
                key={bg.id}
                style={[
                  styles.backgroundOption,
                  {
                    backgroundColor: acceptedBackgrounds.includes(bg.id)
                      ? colors.primary.gold
                      : theme.colors.surface,
                    borderColor: acceptedBackgrounds.includes(bg.id)
                      ? colors.primary.gold
                      : colors.neutral[200],
                  },
                ]}
                onPress={() => toggleBackground(bg.id)}
              >
                <Text style={styles.backgroundEmoji}>{bg.emoji}</Text>
                <Text
                  style={[
                    styles.backgroundLabel,
                    {
                      color: acceptedBackgrounds.includes(bg.id)
                        ? colors.primary.navy
                        : theme.colors.text,
                    },
                  ]}
                >
                  {bg.label}
                </Text>
                {acceptedBackgrounds.includes(bg.id) && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.primary.navy}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Note */}
        <View style={[styles.noteCard, { backgroundColor: colors.transparent.gold20 }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
          <Text style={[styles.noteText, { color: theme.colors.text }]}>
            These preferences help filter your matches but don't guarantee exact results.
            You can always adjust them in settings.
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
    marginBottom: spacing[2],
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: spacing[3],
  },
  dealbreakers: {
    gap: spacing[2],
  },
  dealbreakerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },
  dealbreakerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing[3],
  },
  dealbreakerContent: {
    flex: 1,
  },
  dealbreakerLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[0.5],
  },
  dealbreakerDescription: {
    fontSize: 12,
  },
  backgrounds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  backgroundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: spacing[1.5],
  },
  backgroundEmoji: {
    fontSize: 14,
  },
  backgroundLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  noteCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  noteText: {
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
