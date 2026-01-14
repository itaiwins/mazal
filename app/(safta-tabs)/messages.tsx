/**
 * Safta Messages Tab
 *
 * Manage communications from users who want Safta's help
 * Two sections: Accepted (active chats) and Requests (pending connections)
 * Mirrors the regular matches.tsx styling
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

// Safta mode uses purple accent
const SAFTA_ACCENT = colors.safta.primary;

type MessageCategory = 'accepted' | 'requests';

// Types for Safta connections
type AcceptedConnection = {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
};

type PendingRequest = {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  userAge: number;
  userLocation: string;
  introMessage: string;
  requestedAt: Date;
};

// Empty arrays - data will come from Supabase when connections feature is implemented

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function AcceptedConnectionCard({
  connection,
  onPress,
}: {
  connection: AcceptedConnection;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable style={styles.connectionCard} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: connection.userPhoto }} style={styles.avatar} />
        {connection.unread > 0 && (
          <View style={styles.unreadIndicator}>
            <Text style={styles.unreadIndicatorText}>{connection.unread}</Text>
          </View>
        )}
      </View>
      <View style={styles.connectionContent}>
        <View style={styles.connectionHeader}>
          <Text style={[styles.connectionName, { color: theme.colors.text }]}>
            {connection.userName}
          </Text>
          <Text style={[styles.connectionTime, { color: theme.colors.textSecondary }]}>
            {formatTime(connection.lastMessageTime)}
          </Text>
        </View>
        <Text
          style={[
            styles.connectionMessage,
            { color: connection.unread > 0 ? theme.colors.text : theme.colors.textSecondary },
            connection.unread > 0 && styles.connectionMessageUnread,
          ]}
          numberOfLines={1}
        >
          {connection.lastMessage}
        </Text>
      </View>
    </Pressable>
  );
}

function RequestCard({
  request,
  onAccept,
  onDecline,
  onViewProfile,
}: {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  onViewProfile: () => void;
}) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn}
      style={[styles.requestCard, { backgroundColor: theme.colors.surface }]}
    >
      <Pressable style={styles.requestHeader} onPress={onViewProfile}>
        <Image source={{ uri: request.userPhoto }} style={styles.requestAvatar} />
        <View style={styles.requestInfo}>
          <Text style={[styles.requestName, { color: theme.colors.text }]}>
            {request.userName}, {request.userAge}
          </Text>
          <Text style={[styles.requestLocation, { color: theme.colors.textSecondary }]}>
            {request.userLocation}
          </Text>
        </View>
        <Text style={[styles.requestTime, { color: theme.colors.textTertiary }]}>
          {formatTime(request.requestedAt)}
        </Text>
      </Pressable>

      <View style={styles.requestMessageContainer}>
        <Text style={[styles.requestMessage, { color: theme.colors.text }]}>
          "{request.introMessage}"
        </Text>
      </View>

      <View style={styles.requestActions}>
        <Pressable
          style={[styles.requestAction, styles.declineAction]}
          onPress={onDecline}
        >
          <Ionicons name="close" size={20} color={colors.semantic.error} />
          <Text style={[styles.actionText, { color: colors.semantic.error }]}>Decline</Text>
        </Pressable>
        <Pressable
          style={[styles.requestAction, styles.acceptAction]}
          onPress={onAccept}
        >
          <Ionicons name="checkmark" size={20} color={colors.primary.white} />
          <Text style={[styles.actionText, { color: colors.primary.white }]}>Accept</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function SaftaMessagesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<MessageCategory>('accepted');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptedConnections, setAcceptedConnections] = useState<AcceptedConnection[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Badge counts
  const acceptedCount = acceptedConnections.length;
  const requestsCount = pendingRequests.length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleConnectionPress = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to chat - for now just alert
    Alert.alert('Chat', `Opening chat with user ${userId}`);
    // router.push(`/(safta-tabs)/chat/${userId}`);
  };

  const handleViewProfile = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('View Profile', `Viewing profile for user ${userId}`);
  };

  const handleAcceptRequest = (request: PendingRequest) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Move from requests to accepted
    setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    setAcceptedConnections((prev) => [
      {
        id: request.id,
        userId: request.userId,
        userName: request.userName,
        userPhoto: request.userPhoto,
        lastMessage: 'Connection accepted! Say hello.',
        lastMessageTime: new Date(),
        unread: 0,
      },
      ...prev,
    ]);

    Alert.alert(
      'Request Accepted!',
      `You can now help ${request.userName} find their match.`,
      [{ text: 'Start Chatting', onPress: () => handleConnectionPress(request.userId) }]
    );
  };

  const handleDeclineRequest = (request: PendingRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline ${request.userName}'s request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Messages</Text>
      </View>

      {/* Sorting Tabs - matches regular matches.tsx pattern */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.colors.background }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'accepted' && styles.tabActive,
          ]}
          onPress={() => {
            setActiveTab('accepted');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons
            name="chatbubbles"
            size={16}
            color={activeTab === 'accepted' ? SAFTA_ACCENT : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'accepted' ? SAFTA_ACCENT : theme.colors.textSecondary },
            ]}
          >
            Helping
          </Text>
          {acceptedCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'accepted' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'accepted' && styles.tabBadgeTextActive]}>
                {acceptedCount}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === 'requests' && styles.tabActive,
          ]}
          onPress={() => {
            setActiveTab('requests');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons
            name="mail"
            size={16}
            color={activeTab === 'requests' ? SAFTA_ACCENT : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'requests' ? SAFTA_ACCENT : theme.colors.textSecondary },
            ]}
          >
            Requests
          </Text>
          {requestsCount > 0 && (
            <View style={[styles.tabBadge, activeTab === 'requests' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'requests' && styles.tabBadgeTextActive]}>
                {requestsCount}
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
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.gold}
          />
        }
      >
        {/* HELPING TAB (Accepted Connections) */}
        {activeTab === 'accepted' && (
          <>
            {acceptedConnections.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                  People You're Helping
                </Text>
                {acceptedConnections.map((connection) => (
                  <AcceptedConnectionCard
                    key={connection.id}
                    connection={connection}
                    onPress={() => handleConnectionPress(connection.userId)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.neutral[300]} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  When you accept connection requests, they'll appear here
                </Text>
              </View>
            )}
          </>
        )}

        {/* REQUESTS TAB (Pending Connections) */}
        {activeTab === 'requests' && (
          <>
            {pendingRequests.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                  Connection Requests
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  These users want you to help them find a match
                </Text>
                {pendingRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onAccept={() => handleAcceptRequest(request)}
                    onDecline={() => handleDeclineRequest(request)}
                    onViewProfile={() => handleViewProfile(request.userId)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={48} color={colors.neutral[300]} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  When users request your help, they'll appear here
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
  header: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  // Tab styles - matches regular matches.tsx
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
    backgroundColor: colors.transparent.purple20,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: colors.safta.primary,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  tabBadgeTextActive: {
    color: colors.primary.white,
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
  sectionSubtitle: {
    fontSize: 13,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  // Accepted Connection Card - matches conversationItem pattern
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.safta.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
    borderWidth: 2,
    borderColor: colors.primary.white,
  },
  unreadIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.white,
  },
  connectionContent: {
    flex: 1,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectionTime: {
    fontSize: 12,
  },
  connectionMessage: {
    fontSize: 14,
  },
  connectionMessageUnread: {
    fontWeight: '600',
  },
  // Request Card - matches promptReplyCard pattern
  requestCard: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  requestAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[0.5],
  },
  requestLocation: {
    fontSize: 13,
  },
  requestTime: {
    fontSize: 11,
  },
  requestMessageContainer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  requestMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  requestAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  declineAction: {
    borderRightWidth: 1,
    borderRightColor: colors.neutral[100],
  },
  acceptAction: {
    backgroundColor: colors.safta.primary,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Empty State - matches regular matches.tsx pattern
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
