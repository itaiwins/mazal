/**
 * Privacy Settings Screen
 *
 * Premium privacy settings with dark theme
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface PrivacyItemProps {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  index?: number;
}

function PrivacyItem({
  icon,
  label,
  description,
  value,
  onValueChange,
  index = 0,
}: PrivacyItemProps) {
  const handleChange = (newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(newValue);
  };

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
      <View style={styles.item}>
        <View style={styles.itemLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon as any} size={20} color={colors.primary.gold} />
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemLabel}>{label}</Text>
            <Text style={styles.itemDesc}>{description}</Text>
          </View>
        </View>
        <Switch
          value={value}
          onValueChange={handleChange}
          trackColor={{ false: colors.neutral[600], true: colors.primary.gold }}
          thumbColor={colors.primary.white}
        />
      </View>
    </Animated.View>
  );
}

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

  const [hideDistance, setHideDistance] = useState(false);
  const [hideAge, setHideAge] = useState(false);
  const [hideLastActive, setHideLastActive] = useState(false);
  const [showOnMap, setShowOnMap] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

  return (
    <View style={styles.container}>
      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[colors.primary.navy, colors.dark.background]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Privacy */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Profile Privacy</Text>
          <View style={styles.card}>
            <PrivacyItem
              icon="location-outline"
              label="Hide distance"
              description="Others won't see how far you are"
              value={hideDistance}
              onValueChange={setHideDistance}
              index={0}
            />
            <View style={styles.divider} />
            <PrivacyItem
              icon="calendar-outline"
              label="Hide age"
              description="Only show age range"
              value={hideAge}
              onValueChange={setHideAge}
              index={1}
            />
            <View style={styles.divider} />
            <PrivacyItem
              icon="time-outline"
              label="Hide last active"
              description="Don't show when you were last online"
              value={hideLastActive}
              onValueChange={setHideLastActive}
              index={2}
            />
          </View>
        </Animated.View>

        {/* Map Privacy */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Map Privacy</Text>
          <View style={styles.card}>
            <PrivacyItem
              icon="map-outline"
              label="Show on Mazal Map"
              description="Let others discover you on the map"
              value={showOnMap}
              onValueChange={setShowOnMap}
              index={3}
            />
          </View>
        </Animated.View>

        {/* Messaging Privacy */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Messaging</Text>
          <View style={styles.card}>
            <PrivacyItem
              icon="checkmark-done-outline"
              label="Read receipts"
              description="Let matches know when you've read messages"
              value={readReceipts}
              onValueChange={setReadReceipts}
              index={4}
            />
          </View>
        </Animated.View>

        {/* Data & Account */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Data & Account</Text>
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={styles.itemLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="download-outline" size={20} color={colors.primary.gold} />
                </View>
                <Text style={styles.itemLabel}>Download my data</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary.gold} />
          </View>
          <Text style={styles.infoText}>
            Your privacy is important to us. We never share your personal information with third parties without your consent.
          </Text>
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
  headerGradient: {
    paddingBottom: spacing[4],
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
    color: colors.primary.white,
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.transparent.white50,
    marginBottom: spacing[3],
    marginLeft: spacing[2],
  },
  card: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
    marginRight: spacing[3],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
  },
  itemDesc: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  divider: {
    height: 1,
    backgroundColor: colors.transparent.white10,
    marginLeft: spacing[4] + 36 + spacing[3],
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
  },
  navItemPressed: {
    backgroundColor: colors.transparent.white05,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    gap: spacing[3],
    marginTop: spacing[6],
    marginHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.transparent.gold20,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.transparent.white70,
  },
});
