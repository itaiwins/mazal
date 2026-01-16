/**
 * Orthodox Matches Screen
 *
 * View matches and conversations
 */

import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { NewMatchCarousel, ConversationCard } from '@/components/matches';
import { StarOfDavid } from '@/components/icons/StarOfDavid';

interface Match {
  id: string;
  matched_at: string;
  other_user: {
    id: string;
    first_name: string;
    photo_url: string | null;
    jewish_background: string;
  };
  last_message?: string;
  unread_count: number;
}

function MatchCard({ match, onPress }: { match: Match; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Animated.View entering={FadeInUp.springify()} style={styles.matchCard}>
        {match.other_user.photo_url ? (
          <Image source={{ uri: match.other_user.photo_url }} style={styles.matchPhoto} />
        ) : (
          <View style={styles.matchPhotoPlaceholder}>
            <Ionicons name="person" size={24} color={colors.neutral[400]} />
          </View>
        )}

        <View style={styles.matchContent}>
          <View style={styles.matchHeader}>
            <Text style={styles.matchName}>{match.other_user.first_name}</Text>
            {match.other_user.jewish_background && (
              <View style={styles.backgroundBadge}>
                <Text style={styles.backgroundBadgeText}>
                  {match.other_user.jewish_background.replace(/_/g, ' ')}
                </Text>
              </View>
            )}
          </View>

          {match.last_message ? (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {match.last_message}
            </Text>
          ) : (
            <Text style={styles.newMatch}>New match! Say hello</Text>
          )}
        </View>

        {match.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{match.unread_count}</Text>
          </View>
        )}

        <Ionicons name="chevron-forward" size={20} color={colors.transparent.white40} />
      </Animated.View>
    </Pressable>
  );
}

export default function OrthodoxMatchesScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('matches')
          .select(`
            id,
            created_at,
            user1_id,
            user2_id,
            user1:users!matches_user1_id_fkey(id, first_name, jewish_background, photos:user_photos(photo_url, photo_order)),
            user2:users!matches_user2_id_fkey(id, first_name, jewish_background, photos:user_photos(photo_url, photo_order))
          `)
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedMatches = (data || []).map((match: any) => {
          const otherUser = match.user1_id === user.id ? match.user2 : match.user1;
          const primaryPhoto = otherUser?.photos?.find((p: any) => p.photo_order === 0) ||
                              otherUser?.photos?.[0];

          return {
            id: match.id,
            matched_at: match.created_at,
            other_user: {
              id: otherUser?.id || '',
              first_name: otherUser?.first_name || 'Anonymous',
              photo_url: primaryPhoto?.photo_url || null,
              jewish_background: otherUser?.jewish_background || '',
            },
            last_message: undefined,
            unread_count: 0,
          };
        });

        setMatches(formattedMatches);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing[2], paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.starOfDavid}>✡</Text>
          <View>
            <Text style={styles.hebrewTitle}>התאמות</Text>
            <Text style={styles.title}>Your Matches</Text>
          </View>
        </View>

        {/* Matches List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.gold} />
          </View>
        ) : matches.length > 0 ? (
          <>
            {/* New Matches Carousel */}
            {matches.filter(m => !m.last_message).length > 0 && (
              <NewMatchCarousel
                matches={matches
                  .filter(m => !m.last_message)
                  .map((match, index) => ({
                    id: match.id,
                    name: match.other_user.first_name,
                    photo: match.other_user.photo_url || 'https://via.placeholder.com/120',
                    matchedAt: new Date(match.matched_at),
                    isNew: index < 3,
                  }))}
                onMatchPress={(match) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/(orthodox-tabs)/messages/${match.id}`);
                }}
              />
            )}

            {/* Conversations Section */}
            <Animated.View entering={FadeIn.duration(400)} style={styles.conversationsHeader}>
              <Ionicons name="chatbubbles" size={18} color={colors.primary.gold} />
              <Text style={styles.conversationsTitle}>Conversations</Text>
            </Animated.View>

            {matches.filter(m => m.last_message).length > 0 ? (
              <View style={styles.conversationsList}>
                {matches
                  .filter(m => m.last_message)
                  .map((match, index) => (
                    <ConversationCard
                      key={match.id}
                      conversation={{
                        id: match.id,
                        name: match.other_user.first_name,
                        photo: match.other_user.photo_url || 'https://via.placeholder.com/120',
                        lastMessage: match.last_message || '',
                        lastMessageTime: new Date(match.matched_at),
                        unread: match.unread_count,
                        isOnline: false,
                      }}
                      index={index}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/(orthodox-tabs)/messages/${match.id}`);
                      }}
                      onArchive={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }}
                    />
                  ))}
              </View>
            ) : (
              <View style={styles.noConversations}>
                <Text style={styles.noConversationsText}>
                  Start a conversation with one of your matches above
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <StarOfDavid size={48} color={colors.primary.gold} />
            </View>
            <Text style={styles.emptyStateTitle}>No Matches Yet</Text>
            <Text style={styles.emptyStateText}>
              Keep swiping to find your bashert. When you match, they'll appear here.
            </Text>
            <Pressable
              style={styles.discoverButton}
              onPress={() => router.push('/(orthodox-tabs)')}
            >
              <LinearGradient
                colors={[colors.primary.gold, '#e6c358']}
                style={styles.discoverButtonGradient}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
              >
                <Text style={styles.discoverButtonText}>Discover Singles</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  starOfDavid: {
    fontSize: 40,
    color: colors.primary.gold,
  },
  hebrewTitle: {
    fontSize: 20,
    color: colors.primary.gold,
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  loadingContainer: {
    paddingVertical: spacing[8],
    alignItems: 'center',
  },
  matchesList: {
    gap: spacing[3],
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    gap: spacing[3],
  },
  matchPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  matchPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchContent: {
    flex: 1,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: 4,
  },
  matchName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  backgroundBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  backgroundBadgeText: {
    fontSize: 10,
    color: colors.primary.gold,
    textTransform: 'capitalize',
  },
  lastMessage: {
    fontSize: 14,
    color: colors.transparent.white60,
  },
  newMatch: {
    fontSize: 14,
    color: colors.primary.gold,
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: colors.primary.gold,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  conversationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
    marginTop: spacing[4],
  },
  conversationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.transparent.white70,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conversationsList: {
    gap: spacing[2],
  },
  noConversations: {
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  noConversationsText: {
    fontSize: 14,
    color: colors.transparent.white50,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  emptyStateIcon: {
    fontSize: 64,
    color: colors.primary.gold,
    marginBottom: spacing[4],
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.transparent.white60,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[6],
  },
  discoverButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  discoverButtonGradient: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
  discoverButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
