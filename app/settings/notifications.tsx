/**
 * Notification Settings Screen
 *
 * Premium notification settings with dark theme
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
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';

interface NotificationItemProps {
  icon: string;
  iconColor?: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  index?: number;
}

function NotificationItem({
  icon,
  iconColor = colors.primary.gold,
  label,
  description,
  value,
  onValueChange,
  index = 0,
}: NotificationItemProps) {
  const handleChange = (newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(newValue);
  };

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
      <View style={styles.item}>
        <View style={styles.itemLeft}>
          <View style={[styles.iconContainer, { backgroundColor: colors.transparent.gold10 }]}>
            <Ionicons name={icon as any} size={20} color={iconColor} />
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

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  const [newMatches, setNewMatches] = useState(true);
  const [newMessages, setNewMessages] = useState(true);
  const [newLikes, setNewLikes] = useState(true);
  const [saftaLikes, setSaftaLikes] = useState(true);
  const [superLikes, setSuperLikes] = useState(true);
  const [emailMatches, setEmailMatches] = useState(false);
  const [emailNews, setEmailNews] = useState(false);

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
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Push Notifications */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Push Notifications</Text>
          <View style={styles.card}>
            <NotificationItem
              icon="heart"
              iconColor={colors.semantic.error}
              label="New matches"
              description="When you match with someone"
              value={newMatches}
              onValueChange={setNewMatches}
              index={0}
            />
            <View style={styles.divider} />
            <NotificationItem
              icon="chatbubble"
              label="New messages"
              description="When you receive a message"
              value={newMessages}
              onValueChange={setNewMessages}
              index={1}
            />
            <View style={styles.divider} />
            <NotificationItem
              icon="thumbs-up"
              label="New likes"
              description="When someone likes your profile"
              value={newLikes}
              onValueChange={setNewLikes}
              index={2}
            />
            <View style={styles.divider} />
            <NotificationItem
              icon="star"
              label="Super Likes"
              description="When someone Super Likes you"
              value={superLikes}
              onValueChange={setSuperLikes}
              index={3}
            />
            {/* Safta approvals - hidden behind a flag (docs/ROADMAP.md) */}
            {FEATURE_SAFTA_MODE && (
              <>
                <View style={styles.divider} />
                <NotificationItem
                  icon="people"
                  label="Safta approvals"
                  description="When your Safta sends you a match"
                  value={saftaLikes}
                  onValueChange={setSaftaLikes}
                  index={4}
                />
              </>
            )}
          </View>
        </Animated.View>

        {/* Email Notifications */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Email Notifications</Text>
          <View style={styles.card}>
            <NotificationItem
              icon="mail-outline"
              iconColor={colors.transparent.white60}
              label="Match updates"
              description="Weekly summary of your matches"
              value={emailMatches}
              onValueChange={setEmailMatches}
              index={5}
            />
            <View style={styles.divider} />
            <NotificationItem
              icon="newspaper-outline"
              iconColor={colors.transparent.white60}
              label="News & updates"
              description="Tips, features, and community news"
              value={emailNews}
              onValueChange={setEmailNews}
              index={6}
            />
          </View>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
          </View>
          <Text style={styles.infoText}>
            You can also manage notifications in your device settings.
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
