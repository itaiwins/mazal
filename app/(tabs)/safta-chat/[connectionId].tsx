/**
 * Safta Chat Screen
 *
 * Chat interface between a user and their connected Safta
 */

import { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useSaftaMessages, useSaftaConnectionById, type SaftaMessage } from '@/api/queries';
import { useSendSaftaMessage, useMarkSaftaMessagesAsRead } from '@/api/mutations';
import { useAuthStore } from '@/stores/authStore';

// Default Safta avatar
const SAFTA_DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=200';

interface MessageBubbleProps {
  message: SaftaMessage;
  isMe: boolean;
  showAvatar: boolean;
  saftaPhoto: string;
}

function MessageBubble({ message, isMe, showAvatar, saftaPhoto }: MessageBubbleProps) {
  return (
    <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
      {!isMe && showAvatar && (
        <Image source={{ uri: saftaPhoto }} style={styles.messageAvatar} />
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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
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

export default function SaftaChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const [message, setMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const currentUser = useAuthStore((s) => s.user);

  // Fetch connection details and messages
  const { data: connection, isLoading: connectionLoading, error: connectionError } = useSaftaConnectionById(connectionId);
  const { data: messages, isLoading: messagesLoading } = useSaftaMessages(connectionId);

  // Mutations
  const sendMessage = useSendSaftaMessage();
  const markAsRead = useMarkSaftaMessagesAsRead();

  // Mark messages as read when viewing
  useEffect(() => {
    if (connectionId && messages && messages.length > 0) {
      markAsRead.mutate(connectionId);
    }
  }, [connectionId, messages?.length]);

  const inputHeight = useSharedValue(48);

  const handleSend = () => {
    if (!message.trim() || !connectionId) return;

    const messageContent = message.trim();
    setMessage('');

    sendMessage.mutate({
      connectionId,
      content: messageContent,
    });

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const inputContainerStyle = useAnimatedStyle(() => ({
    minHeight: inputHeight.value,
  }));

  // Group messages by date
  const groupedMessages = (messages || []).reduce((groups, msg) => {
    const dateKey = formatDate(msg.createdAt);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(msg);
    return groups;
  }, {} as Record<string, SaftaMessage[]>);

  const flatData = Object.entries(groupedMessages).flatMap(([date, msgs]) => [
    { type: 'date' as const, date, id: `date-${date}` },
    ...msgs.map((msg, idx) => ({
      type: 'message' as const,
      message: msg,
      id: msg.id,
      showAvatar: idx === 0 || msgs[idx - 1]?.senderType !== msg.senderType,
    })),
  ]);

  // Loading state
  if (connectionLoading || messagesLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  // Error state
  if (connectionError || !connection) {
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
            Connection Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: theme.colors.textSecondary }]}>
            This Safta connection may no longer be available.
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

  const relationshipLabel = connection.relationship === 'grandparent' ? 'Grandparent' :
                            connection.relationship === 'parent' ? 'Parent' :
                            connection.relationship === 'aunt_uncle' ? 'Aunt/Uncle' :
                            connection.relationship === 'sibling' ? 'Sibling' : 'Family';

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
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: SAFTA_DEFAULT_PHOTO }}
              style={styles.headerAvatar}
            />
            <View style={styles.saftaBadge}>
              <Text style={styles.saftaBadgeText}>👵</Text>
            </View>
          </View>
          <View>
            <Text style={[styles.headerName, { color: theme.colors.text }]}>
              {connection.saftaName}
            </Text>
            <Text style={[styles.headerRelationship, { color: theme.colors.textSecondary }]}>
              {relationshipLabel}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={flatData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👵</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Start a conversation with {connection.saftaName}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Ask for recommendations or share updates about your dating journey!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'date') {
            return (
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{item.date}</Text>
              </View>
            );
          }
          const msg = item as { message: SaftaMessage; showAvatar: boolean };
          const isMe = msg.message.senderType === 'user';
          return (
            <MessageBubble
              message={msg.message}
              isMe={isMe}
              showAvatar={msg.showAvatar}
              saftaPhoto={SAFTA_DEFAULT_PHOTO}
            />
          );
        }}
        onContentSizeChange={() => {
          if (flatData.length > 0) {
            flatListRef.current?.scrollToEnd();
          }
        }}
      />

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
            placeholder="Message your Safta..."
            placeholderTextColor={theme.colors.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <ActivityIndicator size="small" color={colors.primary.white} />
            ) : (
              <Ionicons name="send" size={20} color={colors.primary.white} />
            )}
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
  avatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  saftaBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.safta.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary.white,
  },
  saftaBadgeText: {
    fontSize: 10,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerRelationship: {
    fontSize: 12,
    marginTop: 1,
  },
  headerRight: {
    width: 44,
  },
  messagesContent: {
    padding: spacing[4],
    paddingBottom: spacing[2],
    flexGrow: 1,
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
    backgroundColor: colors.safta.light,
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
    backgroundColor: colors.safta.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[0.5],
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[10],
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
