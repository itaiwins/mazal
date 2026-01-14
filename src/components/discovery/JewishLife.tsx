/**
 * Jewish Life Section Component
 *
 * Display Jewish background and observance information beautifully
 */

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { StarOfDavid } from '@/components/icons/StarOfDavid';

interface JewishLifeProps {
  jewishBackground?: string;
  observanceLevel?: string;
  keepsShabbat?: string;
  keepsKosher?: string;
  synagogueAttendance?: string;
  wantsChildren?: string;
  partnerMustBeJewish?: boolean;
  raiseChildrenJewish?: boolean;
}

// Format display strings
const formatValue = (value?: string): string => {
  if (!value) return '';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface ValueChipProps {
  label: string;
  isPrimary?: boolean;
}

function ValueChip({ label, isPrimary }: ValueChipProps) {
  return (
    <View style={[styles.chip, isPrimary && styles.chipPrimary]}>
      <Text style={[styles.chipText, isPrimary && styles.chipTextPrimary]}>{label}</Text>
    </View>
  );
}

interface DetailItemProps {
  icon: string;
  label: string;
  value: string;
}

function DetailItem({ icon, label, value }: DetailItemProps) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailIcon}>
        <Text style={styles.detailIconText}>{icon}</Text>
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function JewishLife({
  jewishBackground,
  observanceLevel,
  keepsShabbat,
  keepsKosher,
  synagogueAttendance,
  wantsChildren,
  partnerMustBeJewish,
  raiseChildrenJewish,
}: JewishLifeProps) {
  const hasContent =
    jewishBackground ||
    observanceLevel ||
    keepsShabbat ||
    keepsKosher ||
    wantsChildren;

  if (!hasContent) {
    return null;
  }

  return (
    <Animated.View entering={FadeInUp.delay(500)} style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <StarOfDavid size={20} color={colors.primary.gold} />
        <Text style={styles.sectionTitle}>Jewish Life</Text>
      </View>

      {/* Primary Chips */}
      <View style={styles.chipsContainer}>
        {jewishBackground && (
          <ValueChip label={formatValue(jewishBackground)} isPrimary />
        )}
        {observanceLevel && (
          <ValueChip label={formatValue(observanceLevel)} />
        )}
      </View>

      {/* Detail Items */}
      <View style={styles.detailsContainer}>
        {keepsShabbat && (
          <DetailItem icon="🕯️" label="Shabbat" value={formatValue(keepsShabbat)} />
        )}
        {keepsKosher && (
          <DetailItem icon="🍽️" label="Kosher" value={formatValue(keepsKosher)} />
        )}
        {synagogueAttendance && (
          <DetailItem icon="🏛️" label="Synagogue" value={formatValue(synagogueAttendance)} />
        )}
        {wantsChildren && (
          <DetailItem icon="👶" label="Wants Kids" value={formatValue(wantsChildren)} />
        )}
      </View>

      {/* Important Preferences */}
      {(partnerMustBeJewish || raiseChildrenJewish) && (
        <View style={styles.preferencesContainer}>
          {partnerMustBeJewish && (
            <View style={styles.preferenceItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary.gold} />
              <Text style={styles.preferenceText}>Partner must be Jewish</Text>
            </View>
          )}
          {raiseChildrenJewish && (
            <View style={styles.preferenceItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary.gold} />
              <Text style={styles.preferenceText}>Raise children Jewish</Text>
            </View>
          )}
        </View>
      )}
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  chip: {
    backgroundColor: colors.transparent.white10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
  },
  chipPrimary: {
    backgroundColor: colors.transparent.gold20,
    borderWidth: 1,
    borderColor: colors.transparent.gold50,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.transparent.white80,
  },
  chipTextPrimary: {
    color: colors.primary.gold,
  },
  detailsContainer: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  detailIcon: {
    width: 32,
    alignItems: 'center',
  },
  detailIconText: {
    fontSize: 18,
  },
  detailContent: {
    marginLeft: spacing[3],
  },
  detailLabel: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary.white,
  },
  preferencesContainer: {
    marginTop: spacing[4],
    gap: spacing[2],
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  preferenceText: {
    fontSize: 14,
    color: colors.transparent.white80,
  },
});
