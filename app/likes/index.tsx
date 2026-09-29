/**
 * Likes You Screen
 *
 * The Gold/Platinum "See who likes you" feature (MEXA-315). Until this screen existed the
 * paywall sold it and nothing behind it had ever been built - there was a React Query key
 * and no query, no hook, no screen and no route.
 *
 * Three states, and which one you get is decided in this order:
 *
 *  1. **Flag off** - the whole feature is off (`FEATURE_WHO_LIKES_YOU`, docs/ROADMAP.md).
 *     Nothing links here in that build, so this is only reachable by a deep link; it sends
 *     you back rather than rendering a screen whose RPCs are not deployed.
 *  2. **Free** - the count, and an upgrade card. The count is deliberately visible without
 *     a subscription: it is the upsell, it names nobody, and `count_who_liked_me()` is
 *     granted to every signed-in caller for exactly that reason.
 *  3. **Gold or Platinum** - the list.
 *
 * Every row rule behind the list lives in the database
 * (`supabase/migrations/00026_who_liked_me.sql`): a `pass` is never returned, and neither
 * is anyone blocked in either direction, deactivated, already answered, or already matched.
 * This file filters nothing and must not start to - a screen-side filter would be a rule
 * with no server behind it.
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useWhoLikedMe, useWhoLikedMeCount, type LikerProfile } from '@/api/queries';
import { useSwipe } from '@/api/mutations';
import { useCanSeeLikes } from '@/features/premium/hooks/usePremium';
import { FEATURE_WHO_LIKES_YOU } from '@/lib/config/features';

/** "3d", "4h", "Just now" - the same shape the Matches screen uses for a last message. */
function formatAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function placeOf(liker: LikerProfile): string | null {
  const parts = [liker.current_city, liker.current_state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function LikerCard({
  liker,
  busy,
  onLikeBack,
  onPass,
}: {
  liker: LikerProfile;
  busy: boolean;
  onLikeBack: () => void;
  onPass: () => void;
}) {
  const place = placeOf(liker);

  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        {liker.primaryPhotoUrl ? (
          <Image source={{ uri: liker.primaryPhotoUrl }} style={styles.photo} contentFit="cover" />
        ) : (
          // A liker with no photo is still a real like, so the card renders rather than
          // being dropped. Dropping it would make the list disagree with the badge.
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="person" size={32} color={colors.transparent.white30} />
          </View>
        )}
        {liker.is_super_like && (
          <View style={styles.superBadge}>
            <Ionicons name="star" size={12} color={colors.primary.navy} />
            <Text style={styles.superBadgeText}>SUPER</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {liker.display_name || liker.first_name}
            {liker.age ? `, ${liker.age}` : ''}
          </Text>
          {liker.is_verified && (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary.gold} />
          )}
        </View>

        <Text style={styles.meta} numberOfLines={1}>
          {[place, liker.distance_miles !== null ? `${Math.round(liker.distance_miles)} mi` : null]
            .filter(Boolean)
            .join(' · ') || 'Nearby'}
        </Text>
        <Text style={styles.ago}>{formatAgo(liker.liked_at)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pass on ${liker.first_name}`}
          style={[styles.actionButton, styles.passButton, busy && styles.actionButtonBusy]}
          disabled={busy}
          onPress={onPass}
        >
          <Ionicons name="close" size={22} color={colors.transparent.white70} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Like ${liker.first_name} back`}
          style={[styles.actionButton, styles.likeButton, busy && styles.actionButtonBusy]}
          disabled={busy}
          onPress={onLikeBack}
        >
          <Ionicons name="heart" size={22} color={colors.primary.navy} />
        </Pressable>
      </View>
    </View>
  );
}

export default function LikesYouScreen() {
  const insets = useSafeAreaInsets();
  const canSeeLikes = useCanSeeLikes();
  const count = useWhoLikedMeCount();
  const { data: likers, isLoading, isError, error, refetch, isRefetching } = useWhoLikedMe();
  const swipe = useSwipe();

  // Which card is mid-swipe. One id rather than a boolean so the other cards stay tappable,
  // and so a slow network cannot make the whole list look frozen.
  const [pendingId, setPendingId] = useState<string | null>(null);

  const answer = useCallback(
    async (liker: LikerProfile, action: 'like' | 'pass') => {
      if (pendingId) return;
      setPendingId(liker.id);
      Haptics.impactAsync(
        action === 'like' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );
      try {
        const result = await swipe.mutateAsync({ swipedUserId: liker.id, action });
        // Liking back somebody who has already liked you is a match by definition - the
        // `swipes_check_match` trigger writes the row in the same transaction (00017) and
        // `performSwipe` reads it back. If it somehow is not a match, say nothing rather
        // than celebrating something that did not happen.
        if (result.isMatch) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "It's a Match!",
            `You and ${liker.first_name} liked each other. Say hello!`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Go to Matches', onPress: () => router.push('/(tabs)/matches') },
            ]
          );
        }
      } catch (e) {
        // The swipe is what removes them from this list, so a failed swipe has to be said
        // out loud - a silently unchanged list is the bug MEXA-314 found in Rewind.
        Alert.alert(
          action === 'like' ? "Couldn't send that like" : "Couldn't pass",
          e instanceof Error ? e.message : 'Please try again.'
        );
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, swipe]
  );

  // Reachable only by deep link in a build with the feature off; the RPCs behind it are not
  // deployed there, so send the user back instead of rendering an error state.
  if (!FEATURE_WHO_LIKES_YOU) {
    return <Redirect href="/(tabs)/matches" />;
  }

  const header = (
    <LinearGradient
      colors={[colors.primary.navy, colors.dark.background]}
      style={[styles.headerGradient, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Likes You</Text>
        <View style={styles.headerRight} />
      </View>
    </LinearGradient>
  );

  // ---- Free: the count and the upgrade card, never the names.
  if (!canSeeLikes) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.lockedState}>
            <View style={styles.lockedIcon}>
              <Ionicons name="heart" size={48} color={colors.primary.gold} />
            </View>
            {/* The big number is the upsell, so it only appears when there is something to
                be sold. A 56pt "0" over "Nobody has liked you yet" says the same thing
                twice and the loud half of it is the discouraging half. */}
            {count > 0 && <Text style={styles.lockedCount}>{count}</Text>}
            <Text style={styles.lockedTitle}>
              {count === 0 ? 'No likes yet' : count === 1 ? 'person likes you' : 'people like you'}
            </Text>
            <Text style={styles.lockedSubtitle}>
              {count === 0
                ? "Keep swiping - when somebody likes you, they'll show up here."
                : 'Upgrade to Mazal Gold to see who they are and match instantly.'}
            </Text>
            {count > 0 && (
              <Pressable
                style={styles.upgradeButton}
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/premium');
                }}
              >
                <Ionicons name="star" size={18} color={colors.primary.navy} />
                <Text style={styles.upgradeButtonText}>Upgrade to Gold</Text>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ---- Gold / Platinum: the list.
  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary.gold}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary.gold} />
          </View>
        ) : isError ? (
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cloud-offline-outline" size={48} color={colors.primary.gold} />
            </View>
            <Text style={styles.emptyTitle}>Couldn&apos;t load your likes</Text>
            <Text style={styles.emptySubtitle}>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </Text>
            <Pressable style={styles.upgradeButton} onPress={() => refetch()}>
              <Ionicons name="refresh" size={18} color={colors.primary.navy} />
              <Text style={styles.upgradeButtonText}>Try again</Text>
            </Pressable>
          </Animated.View>
        ) : !likers || likers.length === 0 ? (
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={48} color={colors.primary.gold} />
            </View>
            <Text style={styles.emptyTitle}>No new likes</Text>
            <Text style={styles.emptySubtitle}>
              When somebody likes you, they&apos;ll appear here until you answer them.
            </Text>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInUp.delay(100).springify()}>
              <Text style={styles.count}>
                {likers.length} {likers.length === 1 ? 'person is' : 'people are'} waiting on you
              </Text>
            </Animated.View>

            <View style={styles.list}>
              {likers.map((liker, index) => (
                <Animated.View
                  key={liker.id}
                  entering={FadeInRight.delay(Math.min(index, 8) * 50).springify()}
                >
                  <LikerCard
                    liker={liker}
                    busy={pendingId === liker.id}
                    onLikeBack={() => answer(liker, 'like')}
                    onPass={() => answer(liker, 'pass')}
                  />
                </Animated.View>
              ))}
            </View>
          </>
        )}
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
    paddingBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.white,
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  centered: {
    paddingTop: spacing[12],
    alignItems: 'center',
  },

  // Empty / error
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 2,
    borderColor: colors.transparent.gold20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    color: colors.transparent.white60,
    marginBottom: spacing[4],
  },

  // Locked (free tier)
  lockedState: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },
  lockedIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 2,
    borderColor: colors.transparent.gold20,
  },
  lockedCount: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.primary.gold,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  lockedSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    color: colors.transparent.white60,
    marginBottom: spacing[5],
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.primary.gold,
    borderRadius: borderRadius.full,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary.navy,
  },

  // List
  count: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.transparent.white50,
    marginTop: spacing[4],
    marginBottom: spacing[3],
    marginLeft: spacing[2],
  },
  list: {
    gap: spacing[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.dark.elevated,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  superBadge: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing[1.5],
    paddingVertical: 2,
    backgroundColor: colors.primary.gold,
    borderRadius: borderRadius.full,
  },
  superBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.primary.navy,
  },
  cardBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    flexShrink: 1,
  },
  meta: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: spacing[0.5],
  },
  ago: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonBusy: {
    opacity: 0.4,
  },
  passButton: {
    backgroundColor: colors.transparent.white10,
    borderWidth: 1,
    borderColor: colors.transparent.white20,
  },
  likeButton: {
    backgroundColor: colors.primary.gold,
  },
});
