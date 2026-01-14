/**
 * Filter Share Message Component
 *
 * Displays shared filters in a chat message
 * Allows the recipient to apply the filters to their search
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface FilterShareData {
  ageRange: [number, number];
  distance: number;
  jewishBackgrounds: string[];
  senderName: string;
}

interface FilterShareMessageProps {
  filters: FilterShareData;
  isMe: boolean;
  onApply?: () => void;
}

export function FilterShareMessage({ filters, isMe, onApply }: FilterShareMessageProps) {
  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApply?.();
  };

  return (
    <View style={[styles.container, isMe && styles.containerMe]}>
      <View style={styles.header}>
        <Ionicons name="options" size={18} color={colors.primary.gold} />
        <Text style={styles.headerText}>
          {isMe ? 'My Filters' : `${filters.senderName}'s Filters`}
        </Text>
      </View>

      <View style={styles.filterDetails}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Age Range:</Text>
          <Text style={styles.filterValue}>{filters.ageRange[0]} - {filters.ageRange[1]}</Text>
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Distance:</Text>
          <Text style={styles.filterValue}>{filters.distance} miles</Text>
        </View>
        {filters.jewishBackgrounds.length > 0 && (
          <View style={styles.backgroundsRow}>
            <Text style={styles.filterLabel}>Backgrounds:</Text>
            <View style={styles.backgrounds}>
              {filters.jewishBackgrounds.slice(0, 3).map((bg, i) => (
                <View key={i} style={styles.backgroundChip}>
                  <Text style={styles.backgroundText}>{bg}</Text>
                </View>
              ))}
              {filters.jewishBackgrounds.length > 3 && (
                <Text style={styles.moreText}>+{filters.jewishBackgrounds.length - 3} more</Text>
              )}
            </View>
          </View>
        )}
      </View>

      {!isMe && onApply && (
        <Pressable style={styles.applyButton} onPress={handleApply}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary.navy} />
          <Text style={styles.applyButtonText}>Apply to My Search</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  containerMe: {
    alignSelf: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  filterDetails: {
    gap: spacing[1.5],
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 13,
    color: colors.transparent.white60,
  },
  filterValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary.white,
  },
  backgroundsRow: {
    marginTop: spacing[1],
  },
  backgrounds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  backgroundChip: {
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  backgroundText: {
    fontSize: 11,
    color: colors.primary.gold,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 11,
    color: colors.transparent.white50,
    alignSelf: 'center',
    marginLeft: spacing[1],
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.primary.gold,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2],
    marginTop: spacing[3],
  },
  applyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
