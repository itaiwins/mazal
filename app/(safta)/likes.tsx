/**
 * Safta Likes
 *
 * View recommendations sent by the grandparent
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

// Sample recommendations data
const RECOMMENDATIONS = [
  {
    id: '1',
    profile: {
      id: 'p1',
      name: 'David',
      age: 28,
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
      occupation: 'Doctor',
    },
    note: 'He reminds me of your grandfather! Very handsome and a doctor too.',
    sentAt: new Date(Date.now() - 3600000),
    status: 'pending', // pending, viewed, matched
  },
  {
    id: '2',
    profile: {
      id: 'p2',
      name: 'Michael',
      age: 30,
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      occupation: 'Lawyer',
    },
    note: 'Such a nice Jewish boy! Good job, good family.',
    sentAt: new Date(Date.now() - 86400000),
    status: 'viewed',
  },
];

interface RecommendationItemProps {
  item: typeof RECOMMENDATIONS[0];
}

function RecommendationItem({ item }: RecommendationItemProps) {
  const theme = useTheme();

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <Animated.View
      entering={FadeIn}
      style={[styles.recommendationCard, { backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.recommendationHeader}>
        <Image
          source={{ uri: item.profile.photo }}
          style={styles.profilePhoto}
          contentFit="cover"
        />
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: theme.colors.text }]}>
            {item.profile.name}, {item.profile.age}
          </Text>
          <Text style={[styles.profileOccupation, { color: theme.colors.textSecondary }]}>
            {item.profile.occupation}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            item.status === 'pending' && styles.statusPending,
            item.status === 'viewed' && styles.statusViewed,
            item.status === 'matched' && styles.statusMatched,
          ]}
        >
          <Text style={styles.statusText}>
            {item.status === 'pending' && '⏳'}
            {item.status === 'viewed' && '👀'}
            {item.status === 'matched' && '💛'}
          </Text>
        </View>
      </View>

      {item.note && (
        <View style={[styles.noteContainer, { backgroundColor: colors.transparent.gold20 }]}>
          <Text style={[styles.noteLabel, { color: theme.colors.textSecondary }]}>
            Your note:
          </Text>
          <Text style={[styles.noteText, { color: theme.colors.text }]}>
            "{item.note}"
          </Text>
        </View>
      )}

      <View style={styles.recommendationFooter}>
        <Text style={[styles.timeText, { color: theme.colors.textTertiary }]}>
          Sent {formatTime(item.sentAt)}
        </Text>
        {item.status === 'pending' && (
          <Text style={[styles.pendingText, { color: colors.primary.gold }]}>
            Waiting for response
          </Text>
        )}
        {item.status === 'viewed' && (
          <Text style={[styles.viewedText, { color: theme.colors.textSecondary }]}>
            Sarah saw this
          </Text>
        )}
        {item.status === 'matched' && (
          <Text style={[styles.matchedText, { color: colors.semantic.success }]}>
            They matched! 🎉
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export default function SaftaLikesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [recommendations] = useState(RECOMMENDATIONS);

  const handleBack = () => {
    router.back();
  };

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
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Your Recommendations
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Stats */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.stats}>
        <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.primary.gold }]}>
            {recommendations.length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Sent
          </Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.semantic.info }]}>
            {recommendations.filter((r) => r.status === 'viewed').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Viewed
          </Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.semantic.success }]}>
            {recommendations.filter((r) => r.status === 'matched').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Matched
          </Text>
        </View>
      </Animated.View>

      {/* Recommendations List */}
      {recommendations.length > 0 ? (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RecommendationItem item={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing[4] },
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>💌</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No recommendations yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Browse profiles and send your first recommendation!
          </Text>
          <Pressable
            style={styles.browseButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(safta)/browse');
            }}
          >
            <Text style={styles.browseButtonText}>Start Browsing</Text>
          </Pressable>
        </View>
      )}
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
  stats: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
  listContent: {
    padding: spacing[4],
    gap: spacing[4],
  },
  recommendationCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  profilePhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
  },
  profileOccupation: {
    fontSize: 14,
    marginTop: spacing[0.5],
  },
  statusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPending: {
    backgroundColor: colors.transparent.gold20,
  },
  statusViewed: {
    backgroundColor: colors.neutral[100],
  },
  statusMatched: {
    backgroundColor: colors.transparent.gold20,
  },
  statusText: {
    fontSize: 16,
  },
  noteContainer: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.md,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  recommendationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    paddingTop: 0,
  },
  timeText: {
    fontSize: 12,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewedText: {
    fontSize: 12,
  },
  matchedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  browseButton: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
