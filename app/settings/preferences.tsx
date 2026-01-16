/**
 * Discovery Preferences Screen
 *
 * Premium redesigned matching preferences with dark theme
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();

  const [ageRange, setAgeRange] = useState([22, 35]);
  const [distance, setDistance] = useState(50);
  const [showJewishOnly, setShowJewishOnly] = useState(true);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [lookingFor, setLookingFor] = useState('women');

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d5a']}
        style={[styles.header, { paddingTop: insets.top + spacing[2] }]}
      >
        <Animated.View entering={FadeIn.delay(100)} style={styles.headerContent}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Discovery Preferences</Text>
          <View style={styles.headerRight} />
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Age Range */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.sectionTitle}>Age Range</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Minimum Age</Text>
              <View style={styles.stepperControls}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setAgeRange([Math.max(18, ageRange[0] - 1), ageRange[1]])}
                >
                  <Ionicons name="remove" size={20} color={colors.primary.white} />
                </Pressable>
                <Text style={styles.stepperValue}>{ageRange[0]}</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setAgeRange([Math.min(ageRange[1] - 1, ageRange[0] + 1), ageRange[1]])}
                >
                  <Ionicons name="add" size={20} color={colors.primary.white} />
                </Pressable>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Maximum Age</Text>
              <View style={styles.stepperControls}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setAgeRange([ageRange[0], Math.max(ageRange[0] + 1, ageRange[1] - 1)])}
                >
                  <Ionicons name="remove" size={20} color={colors.primary.white} />
                </Pressable>
                <Text style={styles.stepperValue}>{ageRange[1]}</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setAgeRange([ageRange[0], Math.min(70, ageRange[1] + 1)])}
                >
                  <Ionicons name="add" size={20} color={colors.primary.white} />
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Distance */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="location-outline" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.sectionTitle}>Maximum Distance</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Distance</Text>
              <View style={styles.stepperControls}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setDistance(Math.max(5, distance - 5))}
                >
                  <Ionicons name="remove" size={20} color={colors.primary.white} />
                </Pressable>
                <Text style={styles.stepperValue}>{distance} mi</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setDistance(Math.min(100, distance + 5))}
                >
                  <Ionicons name="add" size={20} color={colors.primary.white} />
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Looking For */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="heart-outline" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.sectionTitle}>Looking For</Text>
          </View>
          <View style={styles.card}>
            {[
              { id: 'men', label: 'Men' },
              { id: 'women', label: 'Women' },
              { id: 'everyone', label: 'Everyone' },
            ].map((option, index) => (
              <Pressable
                key={option.id}
                style={[
                  styles.optionRow,
                  index < 2 && styles.optionRowBorder,
                ]}
                onPress={() => setLookingFor(option.id)}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
                {lookingFor === option.id ? (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark" size={18} color={colors.primary.navy} />
                  </View>
                ) : (
                  <View style={styles.unselectedIndicator} />
                )}
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Filters */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="filter-outline" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.sectionTitle}>Filters</Text>
          </View>
          <View style={styles.card}>
            <View style={[styles.filterRow, styles.optionRowBorder]}>
              <View style={styles.filterInfo}>
                <View style={styles.filterIconContainer}>
                  <Ionicons name="star" size={18} color={colors.primary.gold} />
                </View>
                <View>
                  <Text style={styles.filterLabel}>Jewish profiles only</Text>
                  <Text style={styles.filterDescription}>
                    Only show verified Jewish members
                  </Text>
                </View>
              </View>
              <Switch
                value={showJewishOnly}
                onValueChange={setShowJewishOnly}
                trackColor={{ false: colors.transparent.white20, true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
            <View style={styles.filterRow}>
              <View style={styles.filterInfo}>
                <View style={styles.filterIconContainer}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.semantic.success} />
                </View>
                <View>
                  <Text style={styles.filterLabel}>Verified profiles only</Text>
                  <Text style={styles.filterDescription}>
                    Only show photo-verified profiles
                  </Text>
                </View>
              </View>
              <Switch
                value={showVerifiedOnly}
                onValueChange={setShowVerifiedOnly}
                trackColor={{ false: colors.transparent.white20, true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.saveContainer}>
          <Pressable style={styles.saveButton} onPress={() => router.back()}>
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    paddingBottom: spacing[4],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  card: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.transparent.white10,
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
    color: colors.primary.white,
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
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
    minWidth: 50,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.transparent.white10,
    marginLeft: spacing[4],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  optionLabel: {
    fontSize: 16,
    color: colors.primary.white,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unselectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.transparent.white30,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  filterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  filterIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary.white,
  },
  filterDescription: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginTop: 2,
  },
  saveContainer: {
    paddingHorizontal: spacing[4],
    marginTop: spacing[6],
  },
  saveButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
