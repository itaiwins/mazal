/**
 * Chat Screen
 *
 * Individual conversation with a match
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useMessages, useMatchById } from '@/api/queries';
import { useSendMessage, useMarkMessagesAsRead } from '@/api/mutations';
import { useMessagesSubscription, useTypingIndicator, useTypingSubscription } from '@/api/realtime';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { FilterShareMessage, ProfileShareMessage } from '@/components/chat';
import { DEMO_MATCHES, DEMO_MESSAGES } from '@/lib/demo/demoProfiles';

// Message type
type MessageItem = {
  id: string;
  content: string;
  senderId: string;
  createdAt: Date;
  isRead: boolean;
};

// Default match data when loading
const DEFAULT_MATCH_DATA = {
  id: '',
  name: '',
  photo: '',
  isOnline: false,
};

interface MessageBubbleProps {
  message: MessageItem;
  isMe: boolean;
  showAvatar: boolean;
  matchPhoto?: string;
}

function MessageBubble({ message, isMe, showAvatar, matchPhoto }: MessageBubbleProps) {
  return (
    <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
      {!isMe && showAvatar && matchPhoto && (
        <Image source={{ uri: matchPhoto }} style={styles.messageAvatar} />
      )}
      {!isMe && !showAvatar && <View style={styles.messageAvatarPlaceholder} />}
      <View
        style={[
          styles.messageBubble,
          isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isMe ? styles.messageTextMe : styles.messageTextOther,
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString();
}

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [message, setMessage] = useState('');
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = useAuthStore((s) => s.user);

  // Check if demo mode is enabled
  const isDemoMode = useUIStore((s) => s.isDemoMode);

  // Demo mode: get demo data
  const demoMatch = isDemoMode ? DEMO_MATCHES.find(m => m.id === matchId) : null;
  const demoMessages = isDemoMode && matchId ? DEMO_MESSAGES[matchId] || [] : [];

  // Fetch messages and match data from API (skip if in demo mode)
  const { data: apiMessages, isLoading: messagesLoading, error: messagesError } = useMessages(isDemoMode ? undefined : matchId);
  const { data: matchData, error: matchError, isLoading: matchLoading } = useMatchById(isDemoMode ? undefined : matchId);

  // Subscribe to real-time messages (skip in demo mode)
  useMessagesSubscription(isDemoMode ? undefined : matchId);

  // Typing indicator (skip in demo mode)
  const { setTyping } = useTypingIndicator(isDemoMode ? undefined : matchId);
  useTypingSubscription(isDemoMode ? undefined : matchId, (userId, isTyping) => {
    setIsOtherTyping(isTyping);
  });

  // Mark messages as read (skip in demo mode)
  const markAsRead = useMarkMessagesAsRead();
  useEffect(() => {
    if (matchId && !isDemoMode) {
      markAsRead.mutate(matchId);
    }
  }, [matchId, apiMessages, isDemoMode]);

  // Send message mutation
  const sendMessage = useSendMessage();

  // Use demo messages or API messages
  const messages: MessageItem[] = isDemoMode
    ? demoMessages.map((m) => ({
        id: m.id,
        content: m.content || '',
        senderId: m.sender_id === 'current-user' ? 'me' : 'other',
        createdAt: new Date(m.created_at),
        isRead: m.is_read ?? false,
      }))
    : apiMessages
    ? apiMessages.map((m) => ({
        id: m.id,
        content: m.content || '',
        senderId: m.sender_id === currentUser?.id ? 'me' : 'other',
        createdAt: new Date(m.created_at),
        isRead: m.is_read ?? false,
      }))
    : [];

  // Normalize match data to a consistent shape
  const otherUser = isDemoMode ? demoMatch?.otherUser : matchData?.otherUser;
  const match = {
    id: otherUser?.id || DEFAULT_MATCH_DATA.id,
    name: otherUser?.first_name || DEFAULT_MATCH_DATA.name,
    photo: otherUser?.photos?.[0]?.photo_url || DEFAULT_MATCH_DATA.photo,
    isOnline: DEFAULT_MATCH_DATA.isOnline, // TODO: Get real online status
  };

  const inputHeight = useSharedValue(48);

  const handleSend = () => {
    if (!message.trim()) return;

    const messageContent = message.trim();

    // Stop typing indicator
    setTyping(false);

    // Clear message immediately for better UX
    setMessage('');

    if (matchId) {
      // Send via API
      sendMessage.mutate({
        matchId,
        content: messageContent,
      });
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Handle typing
  const handleTextChange = (text: string) => {
    setMessage(text);
    if (matchId) {
      setTyping(text.length > 0);
    }
  };

  const inputContainerStyle = useAnimatedStyle(() => ({
    minHeight: inputHeight.value,
  }));

  // Handle share filters
  const handleShareFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Share Your Filters',
      'Would you like to share your current search filters with this person? They can apply your filters to their own search.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share Filters',
          onPress: () => {
            // In production, this would send the filters as a special message
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Filters Shared', 'Your search filters have been sent!');
          },
        },
      ]
    );
  };

  // Handle apply received filters
  const handleApplyFilters = (filters: any) => {
    // In production, this would update the user's search filters
    Alert.alert(
      'Apply Filters',
      'Your search filters have been updated!',
      [{ text: 'OK' }]
    );
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const dateKey = formatDate(msg.createdAt);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(msg);
    return groups;
  }, {} as Record<string, MessageItem[]>);

  const flatData = Object.entries(groupedMessages).flatMap(([date, msgs]) => [
    { type: 'date', date, id: `date-${date}` },
    ...msgs.map((msg, idx) => ({
      type: 'message',
      message: msg,
      id: msg.id,
      showAvatar: idx === 0 || msgs[idx - 1]?.senderId !== msg.senderId,
    })),
  ]);

  // Skip loading state in demo mode
  if (!isDemoMode && (messagesLoading || matchLoading)) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  // Handle error state (conversation not found or not authorized)
  // In demo mode, check if we found the demo match
  const hasError = isDemoMode
    ? !demoMatch
    : (matchError || (!matchData && !messagesLoading && !matchLoading));

  if (hasError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </Pressable>
        </View>
        <View style={[styles.centered, { flex: 1 }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={64} color={colors.neutral[300]} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            Conversation Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: theme.colors.textSecondary }]}>
            This conversation may no longer be available or you may not have permission to view it.
          </Text>
          <Pressable
            style={styles.errorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Pressable style={styles.profileInfo}>
          <Image
            source={{ uri: match.photo || 'https://via.placeholder.com/200' }}
            style={styles.headerAvatar}
          />
          <View>
            <Text style={[styles.headerName, { color: theme.colors.text }]}>
              {match.name}
            </Text>
            {isOtherTyping ? (
              <Text style={styles.typingStatus}>Typing...</Text>
            ) : match.isOnline ? (
              <Text style={styles.onlineStatus}>Online now</Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable style={styles.shareFiltersButton} onPress={handleShareFilters}>
          <Ionicons name="options-outline" size={22} color={colors.primary.gold} />
        </Pressable>
        <Pressable style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.icon} />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={flatData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (item.type === 'date') {
            return (
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{item.date}</Text>
              </View>
            );
          }
          const msg = item as { message: MessageItem; showAvatar: boolean };
          return (
            <MessageBubble
              message={msg.message}
              isMe={msg.message.senderId === 'me'}
              showAvatar={msg.showAvatar}
              matchPhoto={match.photo}
            />
          );
        }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Typing indicator would go here */}

      {/* Input */}
      <Animated.View
        style={[
          styles.inputContainer,
          { paddingBottom: insets.bottom + spacing[2] },
          inputContainerStyle,
        ]}
      >
        <View style={[styles.inputRow, { backgroundColor: theme.colors.surface }]}>
          <TextInput
            style={[styles.input, styles.inputPadded, { color: theme.colors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textTertiary}
            value={message}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
          <Pressable
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Ionicons name="send" size={20} color={colors.primary.white} />
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
  },
  onlineStatus: {
    fontSize: 12,
    color: colors.semantic.success,
    marginTop: 1,
  },
  typingStatus: {
    fontSize: 12,
    color: colors.primary.gold,
    marginTop: 1,
    fontStyle: 'italic',
  },
  shareFiltersButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.transparent.gold10,
    borderRadius: 20,
    marginRight: spacing[1],
  },
  moreButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContent: {
    padding: spacing[4],
    paddingBottom: spacing[2],
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: spacing[4],
  },
  dateText: {
    fontSize: 12,
    color: colors.neutral[500],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing[1],
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: spacing[2],
  },
  messageAvatarPlaceholder: {
    width: 28,
    marginRight: spacing[2],
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
  },
  messageBubbleMe: {
    backgroundColor: colors.primary.gold,
    borderBottomRightRadius: spacing[1],
  },
  messageBubbleOther: {
    backgroundColor: colors.secondary.cream,
    borderBottomLeftRadius: spacing[1],
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextMe: {
    color: colors.primary.navy,
  },
  messageTextOther: {
    color: colors.primary.navy,
  },
  inputContainer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: spacing[2],
  },
  inputPadded: {
    paddingLeft: spacing[4],
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[0.5],
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing[4],
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    marginTop: spacing[2],
    textAlign: 'center',
    paddingHorizontal: spacing[8],
    lineHeight: 20,
  },
  errorButton: {
    marginTop: spacing[6],
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
});
