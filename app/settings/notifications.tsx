/**
 * Notification Settings Screen
 *
 * Configure push notification preferences
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [newMatches, setNewMatches] = useState(true);
  const [newMessages, setNewMessages] = useState(true);
  const [newLikes, setNewLikes] = useState(true);
  const [saftaLikes, setSaftaLikes] = useState(true);
  const [superLikes, setSuperLikes] = useState(true);
  const [emailMatches, setEmailMatches] = useState(false);
  const [emailNews, setEmailNews] = useState(false);

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
          Notifications
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Push Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Push Notifications
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="heart" size={22} color={colors.semantic.error} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    New matches
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    When you match with someone
                  </Text>
                </View>
              </View>
              <Switch
                value={newMatches}
                onValueChange={setNewMatches}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="chatbubble" size={22} color={colors.primary.gold} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    New messages
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    When you receive a message
                  </Text>
                </View>
              </View>
              <Switch
                value={newMessages}
                onValueChange={setNewMessages}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="thumbs-up" size={22} color={colors.primary.gold} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    New likes
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    When someone likes your profile
                  </Text>
                </View>
              </View>
              <Switch
                value={newLikes}
                onValueChange={setNewLikes}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="star" size={22} color={colors.primary.gold} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Super Likes
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    When someone Super Likes you
                  </Text>
                </View>
              </View>
              <Switch
                value={superLikes}
                onValueChange={setSuperLikes}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="people" size={22} color={colors.primary.gold} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Safta approvals
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    When your Safta sends you a match
                  </Text>
                </View>
              </View>
              <Switch
                value={saftaLikes}
                onValueChange={setSaftaLikes}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </View>

        {/* Email Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Email Notifications
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="mail-outline" size={22} color={theme.colors.icon} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    Match updates
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    Weekly summary of your matches
                  </Text>
                </View>
              </View>
              <Switch
                value={emailMatches}
                onValueChange={setEmailMatches}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.item}>
              <View style={styles.itemLeft}>
                <Ionicons name="newspaper-outline" size={22} color={theme.colors.icon} />
                <View style={styles.itemContent}>
                  <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                    News & updates
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.colors.textTertiary }]}>
                    Tips, features, and community news
                  </Text>
                </View>
              </View>
              <Switch
                value={emailNews}
                onValueChange={setEmailNews}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
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
