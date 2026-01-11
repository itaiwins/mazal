/**
 * Discovery Preferences Screen
 *
 * Configure matching preferences
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function PreferencesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [ageRange, setAgeRange] = useState([22, 35]);
  const [distance, setDistance] = useState(50);
  const [showJewishOnly, setShowJewishOnly] = useState(true);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

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
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Discovery Preferences
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Age Range */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Age Range
          </Text>
          <View style={[styles.stepperCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.stepperRow}>
              <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>Minimum</Text>
              <View style={styles.stepperControls}>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                  onPress={() => setAgeRange([Math.max(18, ageRange[0] - 1), ageRange[1]])}
                >
                  <Ionicons name="remove" size={20} color={colors.primary.navy} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: theme.colors.text }]}>{ageRange[0]}</Text>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                  onPress={() => setAgeRange([Math.min(ageRange[1] - 1, ageRange[0] + 1), ageRange[1]])}
                >
                  <Ionicons name="add" size={20} color={colors.primary.navy} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.neutral[100] }]} />
            <View style={styles.stepperRow}>
              <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>Maximum</Text>
              <View style={styles.stepperControls}>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                  onPress={() => setAgeRange([ageRange[0], Math.max(ageRange[0] + 1, ageRange[1] - 1)])}
                >
                  <Ionicons name="remove" size={20} color={colors.primary.navy} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: theme.colors.text }]}>{ageRange[1]}</Text>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                  onPress={() => setAgeRange([ageRange[0], Math.min(70, ageRange[1] + 1)])}
                >
                  <Ionicons name="add" size={20} color={colors.primary.navy} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Maximum Distance
          </Text>
          <View style={[styles.stepperCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.stepperRow}>
              <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>Distance</Text>
              <View style={styles.stepperControls}>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                  onPress={() => setDistance(Math.max(5, distance - 5))}
                >
                  <Ionicons name="remove" size={20} color={colors.primary.navy} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: theme.colors.text }]}>{distance} mi</Text>
                <Pressable
                  style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                  onPress={() => setDistance(Math.min(100, distance + 5))}
                >
                  <Ionicons name="add" size={20} color={colors.primary.navy} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Filters
          </Text>
          <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.filterItem}>
              <View style={styles.filterItemLeft}>
                <Ionicons name="star" size={22} color={colors.primary.gold} />
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>
                  Jewish only
                </Text>
              </View>
              <Switch
                value={showJewishOnly}
                onValueChange={setShowJewishOnly}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
            <View style={styles.filterItem}>
              <View style={styles.filterItemLeft}>
                <Ionicons name="checkmark-circle" size={22} color={colors.semantic.success} />
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>
                  Verified profiles only
                </Text>
              </View>
              <Switch
                value={showVerifiedOnly}
                onValueChange={setShowVerifiedOnly}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </View>

        {/* Looking For */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Looking For
          </Text>
          <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
            {['Men', 'Women', 'Everyone'].map((option) => (
              <Pressable key={option} style={styles.optionItem}>
                <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
                  {option}
                </Text>
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={option === 'Women' ? colors.primary.gold : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
        </View>
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
  section: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  stepperCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  stepperLabel: {
    fontSize: 16,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginLeft: spacing[4],
  },
  filterCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  filterItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  filterLabel: {
    fontSize: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  optionLabel: {
    fontSize: 16,
  },
});
