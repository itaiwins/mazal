/**
 * Privacy Settings Screen
 *
 * Configure privacy and safety options
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function PrivacyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [hideDistance, setHideDistance] = useState(false);
  const [hideAge, setHideAge] = useState(false);
  const [hideLastActive, setHideLastActive] = useState(false);
  const [showOnMap, setShowOnMap] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

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
          Privacy Settings
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Privacy */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Profile Privacy
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="location-outline" size={22} color={theme.colors.icon} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Hide distance
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    Others won't see how far you are
                  </Text>
                </View>
              </View>
              <Switch
                value={hideDistance}
                onValueChange={setHideDistance}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="calendar-outline" size={22} color={theme.colors.icon} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Hide age
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    Only show age range
                  </Text>
                </View>
              </View>
              <Switch
                value={hideAge}
                onValueChange={setHideAge}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="time-outline" size={22} color={theme.colors.icon} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Hide last active
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    Don't show when you were last online
                  </Text>
                </View>
              </View>
              <Switch
                value={hideLastActive}
                onValueChange={setHideLastActive}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </View>

        {/* Map Privacy */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Map Privacy
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="map-outline" size={22} color={theme.colors.icon} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Show on Mazal Map
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    Let others discover you on the map
                  </Text>
                </View>
              </View>
              <Switch
                value={showOnMap}
                onValueChange={setShowOnMap}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </View>

        {/* Messaging Privacy */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Messaging
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="checkmark-done-outline" size={22} color={theme.colors.icon} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Read receipts
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    Let matches know when you've read messages
                  </Text>
                </View>
              </View>
              <Switch
                value={readReceipts}
                onValueChange={setReadReceipts}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </View>

        {/* Data & Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Data & Account
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Pressable style={styles.navItem}>
              <View style={styles.itemLeft}>
                <Ionicons name="download-outline" size={22} color={theme.colors.icon} />
                <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                  Download my data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
            </Pressable>
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    marginLeft: spacing[4],
  },
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 16,
  },
  itemDesc: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
});
