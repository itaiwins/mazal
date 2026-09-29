/**
 * Matches Screen
 *
 * View all matches and start conversations
 * Sorted by: Matches, Saftas, Others (prompt responders)
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useMatches, useSaftaConnections, useWhoLikedMeCount, type MatchWithPreview, type SaftaConnectionWithPreview } from '@/api/queries';
import { useAllMessagesSubscription, useMatchesSubscription } from '@/api/realtime';
import { AdBanner } from '@/components/ads';
import { useUIStore } from '@/stores/uiStore';
import { AnimatedHeader } from '@/components/ui/AnimatedHeader';
import { NewMatchCarousel, ConversationCard } from '@/components/matches';
import { DEMO_MATCHES, DEMO_MESSAGES, DEMO_SAFTA_CONNECTIONS, getDemoConversations } from '@/lib/demo/demoProfiles';
import { FEATURE_SAFTA_MODE, FEATURE_WHO_LIKES_YOU } from '@/lib/config/features';

// Message category types
type MessageCategory = 'matches' | 'saftas' | 'others';

// Types for matches display
type NewMatchItem = {
  id: string;
  name: string;
  photo: string;
  matchedAt: Date;
};

type ConversationItem = {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
  isOnline: boolean;
  category: MessageCategory;
  userId?: string; // For "others" to view profile
};

// Sample prompt reply data (from "Others" - people who replied to prompts)
type PromptReplyItem = {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  promptQuestion: string;
  replyMessage: string;
  sentAt: Date;
  isRead: boolean;
};

// Safta message data (from API)
type SaftaMessageItem = {
  id: string;
  saftaId: string;
  saftaName: string;
  saftaPhoto: string | null;
  relationship: string;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
};

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function NewMatchItemCard({ match, onPress }: { match: NewMatchItem; onPress: () => void }) {
  return (
    <Pressable style={styles.newMatchItem} onPress={onPress}>
      <View style={styles.newMatchAvatarContainer}>
        <Image source={{ uri: match.photo }} style={styles.newMatchAvatar} />
        <View style={styles.newMatchBadge}>
          <Text style={styles.newMatchBadgeText}>NEW</Text>
        </View>
      </View>
      <Text style={styles.newMatchName} numberOfLines={1}>{match.name}</Text>
    </Pressable>
  );
}

/**
 * The "Likes You" entry point and its badge (MEXA-315).
 *
 * The count comes from `count_who_liked_me()`, which is free for every signed-in user on
 * purpose - it names nobody, and seeing "3 people like you" is what makes the Gold paywall
 * worth tapping. What is behind the row differs: a subscriber gets the list, a free user
 * gets the same number and an upgrade card. `app/likes/index.tsx` decides which.
 *
 * Deliberately **not** fed by a realtime subscription. `useLikesSubscription` used to
 * invalidate a who-liked-me key off `postgres_changes` on `swipes`, and MEXA-294 deleted it
 * because the event can never reach the person who was swiped on: the only SELECT policy on
 * that table is own-swiper-only, so realtime's RLS re-check filters it away. The number
 * refetches on focus and is invalidated by `useSwipe`.
 *
 * Renders nothing at all when the count is 0 - an entry point promising likes you do not
 * have is the same kind of empty promise this issue was filed about.
 */
function LikesYouRow() {
  const theme = useTheme();
  const count = useWhoLikedMeCount();

  if (!FEATURE_WHO_LIKES_YOU || count === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${count} ${count === 1 ? 'person likes' : 'people like'} you`}
        style={styles.likesYouRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/likes');
        }}
      >
        <View style={styles.likesYouIcon}>
          <Ionicons name="heart" size={22} color={colors.primary.gold} />
          <View style={styles.likesYouBadge}>
            <Text style={styles.likesYouBadgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        </View>
        <View style={styles.likesYouText}>
          <Text style={[styles.likesYouTitle, { color: theme.colors.text }]}>Likes You</Text>
          <Text style={[styles.likesYouSubtitle, { color: theme.colors.textSecondary }]}>
            {count === 1 ? '1 person is waiting on you' : `${count} people are waiting on you`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
      </Pressable>
    </Animated.View>
  );
}

function ConversationItemCard({ conversation, onPress }: { conversation: ConversationItem; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable style={styles.conversationItem} onPress={onPress}>
      <View style={styles.conversationAvatarContainer}>
        <Image source={{ uri: conversation.photo }} style={styles.conversationAvatar} />
        {conversation.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.conversationName, { color: theme.colors.text }]}>
            {conversation.name}
          </Text>
          <Text style={[styles.conversationTime, { color: theme.colors.textSecondary }]}>
            {formatTime(conversation.lastMessageTime)}
          </Text>
        </View>
        <View style={styles.conversationMessageRow}>
          <Text
            style={[
              styles.conversationMessage,
              { color: conversation.unread > 0 ? theme.colors.text : theme.colors.textSecondary },
              conversation.unread > 0 && styles.conversationMessageUnread,
            ]}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
          {conversation.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{conversation.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// Safta message card
function SaftaMessageCard({ safta, onPress }: { safta: SaftaMessageItem; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable style={styles.conversationItem} onPress={onPress}>
      <View style={styles.conversationAvatarContainer}>
        <Image source={{ uri: safta.saftaPhoto || SAFTA_DEFAULT_PHOTO }} style={styles.conversationAvatar} />
        <View style={styles.saftaIndicator}>
          <Text style={styles.saftaIndicatorText}>👵</Text>
        </View>
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={styles.saftaNameRow}>
            <Text style={[styles.conversationName, { color: theme.colors.text }]}>
              {safta.saftaName}
            </Text>
            <View style={styles.saftaRelationshipBadge}>
              <Text style={styles.saftaRelationshipText}>{safta.relationship}</Text>
            </View>
          </View>
          <Text style={[styles.conversationTime, { color: theme.colors.textSecondary }]}>
            {formatTime(safta.lastMessageTime)}
          </Text>
        </View>
        <View style={styles.conversationMessageRow}>
          <Text
            style={[
              styles.conversationMessage,
              { color: safta.unread > 0 ? theme.colors.text : theme.colors.textSecondary },
              safta.unread > 0 && styles.conversationMessageUnread,
            ]}
            numberOfLines={1}
          >
            {safta.lastMessage}
          </Text>
          {safta.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{safta.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// Others (prompt reply) card with actions
function PromptReplyCard({
  reply,
  onViewProfile,
  onBlock,
  onMatch,
}: {
  reply: PromptReplyItem;
  onViewProfile: () => void;
  onBlock: () => void;
  onMatch: () => void;
}) {
  const theme = useTheme();
  const [showActions, setShowActions] = useState(false);

  return (
    <View style={[styles.promptReplyCard, { backgroundColor: theme.colors.surface }]}>
      <Pressable
        style={styles.promptReplyHeader}
        onPress={() => setShowActions(!showActions)}
      >
        <Image source={{ uri: reply.senderPhoto }} style={styles.promptReplyAvatar} />
        <View style={styles.promptReplyContent}>
          <View style={styles.promptReplyNameRow}>
            <Text style={[styles.promptReplyName, { color: theme.colors.text }]}>
              {reply.senderName}
            </Text>
            {!reply.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.promptReplyPrompt, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            Replied to: {reply.promptQuestion}
          </Text>
        </View>
        <Text style={[styles.promptReplyTime, { color: theme.colors.textSecondary }]}>
          {formatTime(reply.sentAt)}
        </Text>
      </Pressable>

      {/* The reply message */}
      <View style={styles.promptReplyMessage}>
        <Text style={[styles.promptReplyMessageText, { color: theme.colors.text }]}>
          "{reply.replyMessage}"
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.promptReplyActions}>
        <Pressable
          style={[styles.promptReplyActionButton, styles.viewProfileButton]}
          onPress={onViewProfile}
        >
          <Ionicons name="person-outline" size={16} color={colors.primary.gold} />
          <Text style={styles.viewProfileText}>View Profile</Text>
        </Pressable>
        <Pressable
          style={[styles.promptReplyActionButton, styles.matchButton]}
          onPress={onMatch}
        >
          <Ionicons name="heart" size={16} color={colors.primary.white} />
          <Text style={styles.matchButtonText}>Match</Text>
        </Pressable>
        <Pressable
          style={[styles.promptReplyActionButton, styles.blockButton]}
          onPress={onBlock}
        >
          <Ionicons name="close-circle-outline" size={16} color={colors.semantic.error} />
        </Pressable>
      </View>
    </View>
  );
}

// Placeholder photo for Saftas without photos
const SAFTA_DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=200';

// Prompt replies will come from Supabase when the feature is implemented

export default function MatchesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Check if demo mode is enabled
  const isDemoMode = useUIStore((s) => s.isDemoMode);

  // Active tab for sorting
  const [activeTab, setActiveTab] = useState<MessageCategory>('matches');

  // State for prompt replies (others) - empty until feature is implemented
  const [promptReplies, setPromptReplies] = useState<PromptReplyItem[]>([]);

  // Fetch matches from API
  const { data: apiMatches, isLoading, refetch, isRefetching } = useMatches();

  // Fetch Safta connections from API
  const { data: saftaConnections } = useSaftaConnections();

  // Transform Safta connections to message format (use demo data if in demo mode)
  const saftaMessages: SaftaMessageItem[] = useMemo(() => {
    // Parents/grandparents mode is hidden behind a flag (docs/ROADMAP.md)
    if (!FEATURE_SAFTA_MODE) {
      return [];
    }

    // Use demo data if in demo mode
    if (isDemoMode) {
      return DEMO_SAFTA_CONNECTIONS.map((conn) => ({
        id: conn.id,
        saftaId: conn.saftaId,
        saftaName: conn.saftaName,
        saftaPhoto: conn.saftaPhoto || SAFTA_DEFAULT_PHOTO,
        relationship: conn.relationship === 'grandmother' ? 'Grandparent' :
                     conn.relationship === 'aunt' ? 'Aunt/Uncle' : 'Family',
        lastMessage: conn.lastMessage || 'Connected! Tap to chat.',
        lastMessageTime: new Date(conn.lastMessageTime || conn.connectedAt),
        unread: conn.unreadCount,
      }));
    }

    if (!saftaConnections || saftaConnections.length === 0) {
      return [];
    }

    return saftaConnections.map((conn) => ({
      id: conn.id,
      saftaId: conn.saftaId,
      saftaName: conn.saftaName,
      saftaPhoto: conn.saftaPhoto || SAFTA_DEFAULT_PHOTO,
      relationship: conn.relationship === 'grandparent' ? 'Grandparent' :
                   conn.relationship === 'parent' ? 'Parent' :
                   conn.relationship === 'aunt_uncle' ? 'Aunt/Uncle' :
                   conn.relationship === 'sibling' ? 'Sibling' : 'Family',
      lastMessage: conn.lastMessage || 'Connected! Tap to chat.',
      lastMessageTime: new Date(conn.lastMessageTime || conn.connectedAt),
      unread: conn.unreadCount,
    }));
  }, [saftaConnections, isDemoMode]);

  // Subscribe to real-time updates
  useAllMessagesSubscription();
  useMatchesSubscription();

  // Separate new matches (no messages) from conversations
  const { newMatches, conversations } = useMemo(() => {
    // Use demo data if in demo mode
    if (isDemoMode) {
      const demoConversations = getDemoConversations();
      return {
        newMatches: [] as NewMatchItem[],
        conversations: demoConversations.map(c => ({
          ...c,
          isOnline: Math.random() > 0.5,
        })) as ConversationItem[],
      };
    }

    if (!apiMatches || apiMatches.length === 0) {
      // No matches yet - show empty state
      return {
        newMatches: [] as NewMatchItem[],
        conversations: [] as ConversationItem[],
      };
    }

    const newMatchesList: NewMatchItem[] = [];
    const conversationsList: ConversationItem[] = [];

    apiMatches.forEach((match) => {
      if (!match.lastMessage) {
        // New match - no messages yet
        newMatchesList.push({
          id: match.id,
          name: match.firstName,
          photo: match.primaryPhotoUrl || 'https://via.placeholder.com/200',
          matchedAt: new Date(match.matchedAt),
        });
      } else {
        // Existing conversation
        conversationsList.push({
          id: match.id,
          name: match.firstName,
          photo: match.primaryPhotoUrl || 'https://via.placeholder.com/200',
          lastMessage: match.lastMessage.content || '[Media]',
          lastMessageTime: new Date(match.lastMessage.createdAt),
          unread: match.unreadCount,
          isOnline: false,
          category: 'matches',
        });
      }
    });

    return {
      newMatches: newMatchesList,
      conversations: conversationsList,
    };
  }, [apiMatches, isDemoMode]);

  const handleNewMatchPress = (matchId: string) => {
    router.push(`/(tabs)/messages/${matchId}`);
  };

  const handleConversationPress = (conversationId: string) => {
    router.push(`/(tabs)/messages/${conversationId}`);
  };

  const handleSaftaPress = (connectionId: string) => {
    // Navigate to Safta chat
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/safta-chat/${connectionId}`);
  };

  const handleViewProfile = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to profile view (we'll create this route)
    Alert.alert('View Profile', `Viewing profile for user ${userId}`);
  };

  const handleBlockUser = (replyId: string, userName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userName}? They won't be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            setPromptReplies((prev) => prev.filter((r) => r.id !== replyId));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleMatchFromReply = (reply: PromptReplyItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'It\'s a Match!',
      `You matched with ${reply.senderName}! You can now chat freely.`,
      [{ text: 'Start Chatting', onPress: () => {
        // Remove from prompt replies and add to matches
        setPromptReplies((prev) => prev.filter((r) => r.id !== reply.id));
        router.push(`/(tabs)/messages/${reply.senderId}`);
      }}]
    );
  };

  // Only show loading if not in demo mode (demo mode has preloaded data)
  if (isLoading && !isDemoMode) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  // Calculate badge counts
  const matchesCount = conversations.length + newMatches.length;
  const saftasCount = saftaMessages.length;
  const othersCount = promptReplies.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <AnimatedHeader title="Messages" size="medium" />
      </View>

      {/* Ad Banner - only shows for free users */}
      <AdBanner />

      {/* Sorting Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.colors.background }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'matches' && styles.tabActive,
          ]}
          onPress={() => {
            setActiveTab('matches');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons
            name="heart"
            size={16}
            color={activeTab === 'matches' ? colors.primary.gold : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'matches' ? colors.primary.gold : theme.colors.textSecondary },
            ]}
          >
            Matches
          </Text>
          {matchesCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'matches' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'matches' && styles.tabBadgeTextActive]}>
                {matchesCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Saftas tab - hidden behind a flag (docs/ROADMAP.md) */}
        {FEATURE_SAFTA_MODE && (
          <Pressable
            style={[
              styles.tab,
              activeTab === 'saftas' && styles.tabActive,
            ]}
            onPress={() => {
              setActiveTab('saftas');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.tabEmoji}>👵</Text>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'saftas' ? colors.primary.gold : theme.colors.textSecondary },
              ]}
            >
              Saftas
            </Text>
            {saftasCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'saftas' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'saftas' && styles.tabBadgeTextActive]}>
                  {saftasCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable
          style={[
            styles.tab,
            activeTab === 'others' && styles.tabActive,
          ]}
          onPress={() => {
            setActiveTab('others');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={activeTab === 'others' ? colors.primary.gold : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'others' ? colors.primary.gold : theme.colors.textSecondary },
            ]}
          >
            Others
          </Text>
          {othersCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'others' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'others' && styles.tabBadgeTextActive]}>
                {othersCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary.gold}
          />
        }
      >
        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <>
            {/* "Likes You" (MEXA-315) - the only entry point to the feature, and the badge
                the issue asked for. It sits above the new-match carousel because an
                unanswered like is the thing with an action attached to it. */}
            <LikesYouRow />

            {/* New Matches Carousel with Golden Thread */}
            {newMatches.length > 0 && (
              <NewMatchCarousel
                matches={newMatches.map((match, index) => ({
                  id: match.id,
                  name: match.name,
                  photo: match.photo,
                  matchedAt: match.matchedAt,
                  isNew: index < 3, // First 3 are marked as new
                }))}
                onMatchPress={(match) => handleNewMatchPress(match.id)}
              />
            )}

            {/* Conversations with Glass Morphism Cards */}
            {conversations.length > 0 ? (
              <View style={styles.section}>
                <Animated.View entering={FadeIn.duration(400)} style={styles.sectionHeader}>
                  <Ionicons name="chatbubbles" size={18} color={colors.primary.gold} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                    Conversations
                  </Text>
                </Animated.View>
                {conversations.map((conversation, index) => (
                  <ConversationCard
                    key={conversation.id}
                    conversation={{
                      id: conversation.id,
                      name: conversation.name,
                      photo: conversation.photo,
                      lastMessage: conversation.lastMessage,
                      lastMessageTime: conversation.lastMessageTime,
                      unread: conversation.unread,
                      isOnline: conversation.isOnline,
                    }}
                    index={index}
                    onPress={() => handleConversationPress(conversation.id)}
                    onArchive={() => {
                      // Handle archive - could add mutation here
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                  />
                ))}
              </View>
            ) : newMatches.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={[colors.transparent.gold20, colors.transparent.gold10]}
                  style={styles.emptyIconContainer}
                >
                  <Ionicons name="heart-outline" size={48} color={colors.primary.gold} />
                </LinearGradient>
                <Text style={[styles.emptyTitle, { color: colors.primary.white }]}>
                  No matches yet
                </Text>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  When you match with someone, they'll appear here
                </Text>
              </View>
            ) : null}
          </>
        )}

        {/* SAFTAS TAB - hidden behind a flag (docs/ROADMAP.md) */}
        {FEATURE_SAFTA_MODE && activeTab === 'saftas' && (
          <>
            {saftaMessages.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                  From Your Saftas
                </Text>
                {saftaMessages.map((safta) => (
                  <SaftaMessageCard
                    key={safta.id}
                    safta={safta}
                    onPress={() => handleSaftaPress(safta.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>👵</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  Messages from your Saftas will appear here
                </Text>
              </View>
            )}
          </>
        )}

        {/* OTHERS TAB */}
        {activeTab === 'others' && (
          <>
            {promptReplies.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                  Prompt Replies
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  People who replied to your prompts
                </Text>
                {promptReplies.map((reply) => (
                  <PromptReplyCard
                    key={reply.id}
                    reply={reply}
                    onViewProfile={() => handleViewProfile(reply.senderId)}
                    onBlock={() => handleBlockUser(reply.id, reply.senderName)}
                    onMatch={() => handleMatchFromReply(reply)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.neutral[300]} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  When someone replies to your prompts, they'll appear here
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    backgroundColor: colors.transparent.white10,
    gap: spacing[1.5],
  },
  tabActive: {
    backgroundColor: colors.transparent.gold20,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
  },
  tabBadgeActive: {
    backgroundColor: colors.primary.gold,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  tabBadgeTextActive: {
    color: colors.primary.navy,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[4],
  },
  section: {
    marginTop: spacing[4],
  },

  // "Likes You" entry point (MEXA-315)
  likesYouRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[4],
    padding: spacing[3],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.gold20,
  },
  likesYouIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.transparent.gold20,
  },
  likesYouBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing[1],
    borderRadius: 10,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likesYouBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary.navy,
  },
  likesYouText: {
    flex: 1,
  },
  likesYouTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  likesYouSubtitle: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[4],
  },
  newMatchesList: {
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  newMatchItem: {
    alignItems: 'center',
    width: 72,
  },
  newMatchAvatarContainer: {
    position: 'relative',
  },
  newMatchAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  newMatchBadge: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: [{ translateX: -18 }],
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  newMatchBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary.navy,
    letterSpacing: 0.5,
  },
  newMatchName: {
    marginTop: spacing[2],
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary.navy,
    textAlign: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  conversationAvatarContainer: {
    position: 'relative',
  },
  conversationAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.semantic.success,
    borderWidth: 2,
    borderColor: colors.primary.white,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationTime: {
    fontSize: 12,
  },
  conversationMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  conversationMessage: {
    flex: 1,
    fontSize: 14,
  },
  conversationMessageUnread: {
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: colors.primary.gold,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[1.5],
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[8],
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing[4],
    lineHeight: 22,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  sectionSubtitle: {
    fontSize: 13,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  // New section header styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  sectionEmoji: {
    fontSize: 16,
  },
  sectionBadge: {
    backgroundColor: colors.primary.gold,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[1.5],
    marginLeft: spacing[1],
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  sectionDescription: {
    fontSize: 13,
    paddingHorizontal: spacing[4],
    marginTop: -spacing[2],
    marginBottom: spacing[3],
  },
  sectionEmptyState: {
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
  },
  sectionEmptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Safta styles
  saftaIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary.white,
  },
  saftaIndicatorText: {
    fontSize: 10,
  },
  saftaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  saftaRelationshipBadge: {
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  saftaRelationshipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  // Prompt reply (Others) styles
  promptReplyCard: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  promptReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    gap: spacing[3],
  },
  promptReplyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  promptReplyContent: {
    flex: 1,
  },
  promptReplyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  promptReplyName: {
    fontSize: 15,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.gold,
  },
  promptReplyPrompt: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
  promptReplyTime: {
    fontSize: 11,
  },
  promptReplyMessage: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  promptReplyMessageText: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  promptReplyActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  promptReplyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  viewProfileButton: {
    backgroundColor: colors.transparent.gold10,
  },
  viewProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  matchButton: {
    backgroundColor: colors.primary.gold,
    flex: 1,
    justifyContent: 'center',
  },
  matchButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.white,
  },
  blockButton: {
    backgroundColor: colors.transparent.white10,
  },
});
