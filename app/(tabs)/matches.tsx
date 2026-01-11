/**
 * Matches Screen
 *
 * View all matches and start conversations
 */

import { useState, useMemo } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useMatches, type MatchWithPreview } from '@/api/queries';
import { useAllMessagesSubscription, useMatchesSubscription } from '@/api/realtime';

// Sample data for demo
const NEW_MATCHES = [
  {
    id: '1',
    name: 'Sarah',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    matchedAt: new Date(),
  },
  {
    id: '2',
    name: 'Emma',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    matchedAt: new Date(Date.now() - 86400000),
  },
];

const CONVERSATIONS = [
  {
    id: '1',
    name: 'Rachel',
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200',
    lastMessage: "That sounds amazing! I'd love to try that challah recipe",
    lastMessageTime: new Date(Date.now() - 3600000),
    unread: 2,
    isOnline: true,
  },
  {
    id: '2',
    name: 'David',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    lastMessage: "Shabbat Shalom! Want to grab coffee after?",
    lastMessageTime: new Date(Date.now() - 86400000),
    unread: 0,
    isOnline: false,
  },
  {
    id: '3',
    name: 'Michael',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    lastMessage: "You: Definitely! Best pastrami is at Katz's",
    lastMessageTime: new Date(Date.now() - 172800000),
    unread: 0,
    isOnline: false,
  },
];

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

function NewMatchItem({ match, onPress }: { match: typeof NEW_MATCHES[0]; onPress: () => void }) {
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

function ConversationItem({ conversation, onPress }: { conversation: typeof CONVERSATIONS[0]; onPress: () => void }) {
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

export default function MatchesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Fetch matches from API
  const { data: apiMatches, isLoading, refetch, isRefetching } = useMatches();

  // Subscribe to real-time updates
  useAllMessagesSubscription();
  useMatchesSubscription();

  // Separate new matches (no messages) from conversations
  const { newMatches, conversations } = useMemo(() => {
    if (!apiMatches || apiMatches.length === 0) {
      // Use sample data when no API data
      return {
        newMatches: NEW_MATCHES,
        conversations: CONVERSATIONS,
      };
    }

    const newMatchesList: typeof NEW_MATCHES = [];
    const conversationsList: typeof CONVERSATIONS = [];

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
          isOnline: false, // Will be updated with presence subscription
        });
      }
    });

    return {
      newMatches: newMatchesList.length > 0 ? newMatchesList : NEW_MATCHES,
      conversations: conversationsList.length > 0 ? conversationsList : CONVERSATIONS,
    };
  }, [apiMatches]);

  const handleNewMatchPress = (matchId: string) => {
    router.push(`/(tabs)/messages/${matchId}`);
  };

  const handleConversationPress = (conversationId: string) => {
    router.push(`/(tabs)/messages/${conversationId}`);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Matches</Text>
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
        {/* New Matches Section */}
        {newMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
              New Matches
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.newMatchesList}
            >
              {newMatches.map((match) => (
                <NewMatchItem
                  key={match.id}
                  match={match}
                  onPress={() => handleNewMatchPress(match.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Conversations Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Messages
          </Text>
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                onPress={() => handleConversationPress(conversation.id)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.neutral[300]} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                When you match, start the conversation here
              </Text>
            </View>
          )}
        </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[4],
  },
  section: {
    marginTop: spacing[4],
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
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing[4],
    lineHeight: 22,
  },
});
