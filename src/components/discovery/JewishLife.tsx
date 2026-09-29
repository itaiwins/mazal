/**
 * Jewish Life Section Component
 *
 * Display Jewish background and observance information
 * Only shows fields that are collected during onboarding:
 * - jewish_background (denomination)
 * - observance_level
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { StarOfDavid } from '@/components/icons/StarOfDavid';
import {
  jewishBackgroundLabel,
  observanceLevelLabel,
  observanceLevelDescription,
} from '@/lib/constants/jewish';

interface JewishLifeProps {
  jewishBackground?: string;
  observanceLevel?: string;
}

export function JewishLife({
  jewishBackground,
  observanceLevel,
}: JewishLifeProps) {
  const hasContent = jewishBackground || observanceLevel;

  if (!hasContent) {
    return null;
  }

  const backgroundLabel = jewishBackgroundLabel(jewishBackground);
  const observanceLabel = observanceLevelLabel(observanceLevel);
  const observanceDesc = observanceLevelDescription(observanceLevel);

  return (
    <Animated.View entering={FadeInUp.delay(500)} style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <StarOfDavid size={20} color={colors.primary.gold} />
        <Text style={styles.sectionTitle}>Jewish Life</Text>
      </View>

      {/* Background & Observance Cards */}
      <View style={styles.cardsContainer}>
        {jewishBackground && (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardEmoji}>✡️</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Background</Text>
              <Text style={styles.cardValue}>{backgroundLabel}</Text>
            </View>
          </View>
        )}

        {observanceLevel && (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardEmoji}>🕯️</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Observance</Text>
              <Text style={styles.cardValue}>{observanceLabel}</Text>
              {observanceDesc && (
                <Text style={styles.cardDescription}>{observanceDesc}</Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.white,
  },
  cardsContainer: {
    gap: spacing[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 20,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.transparent.white50,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: spacing[1],
  },
});
