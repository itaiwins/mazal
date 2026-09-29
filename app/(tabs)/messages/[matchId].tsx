/**
 * Chat Screen
 *
 * Premium redesigned conversation with dark theme
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  SharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useDotNavigatorInset } from '@/components/navigation/DotNavigator';
import { useMessages, useMatchById } from '@/api/queries';
import { useSendMessage, useMarkMessagesAsRead, useBlockUser, useUnmatch } from '@/api/mutations';
import { useMessagesSubscription, useTypingIndicator, useTypingSubscription } from '@/api/realtime';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
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
  // Different entrance animations for sent vs received
  const enteringAnimation = isMe
    ? FadeInRight.springify().damping(18).stiffness(200)
    : FadeInLeft.springify().damping(18).stiffness(200);

  return (
    <Animated.View
      entering={enteringAnimation}
      style={[styles.messageRow, isMe && styles.messageRowMe]}
    >
      {!isMe && showAvatar && matchPhoto && (
        <Image source={{ uri: matchPhoto }} style={styles.messageAvatar} />
      )}
      {!isMe && !showAvatar && <View style={styles.messageAvatarPlaceholder} />}
      {isMe ? (
        <LinearGradient
          colors={[colors.primary.gold, '#b8922a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.messageBubble, styles.messageBubbleMe]}
        >
          <Text style={[styles.messageText, styles.messageTextMe]}>
            {message.content}
          </Text>
          <View style={styles.messageTimeContainer}>
            <Text style={styles.messageTimeMe}>
              {formatTime(message.createdAt)}
            </Text>
            {message.isRead && (
              <Ionicons name="checkmark-done" size={14} color={colors.primary.navy} />
            )}
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.messageBubble, styles.messageBubbleOther]}>
          <Text style={[styles.messageText, styles.messageTextOther]}>
            {message.content}
          </Text>
          <Text style={styles.messageTimeOther}>
            {formatTime(message.createdAt)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

function TypingIndicator() {
  // Animated values for wave effect
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);

  useEffect(() => {
    const animateDot = (dotY: SharedValue<number>, delay: number) => {
      setTimeout(() => {
        const loop = () => {
          dotY.value = withSpring(-6, { damping: 8, stiffness: 300 }, () => {
            dotY.value = withSpring(0, { damping: 8, stiffness: 300 }, () => {
              setTimeout(loop, 600);
            });
          });
        };
        loop();
      }, delay);
    };

    animateDot(dot1Y, 0);
    animateDot(dot2Y, 150);
    animateDot(dot3Y, 300);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
  }));

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={[styles.typingDot, dot1Style]} />
      <Animated.View style={[styles.typingDot, dot2Style]} />
      <Animated.View style={[styles.typingDot, dot3Style]} />
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
  const insets = useSafeAreaInsets();
  const dotNavigatorInset = useDotNavigatorInset();
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

  // Block / unmatch mutations
  const blockUser = useBlockUser();
  const unmatchUser = useUnmatch();

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
    isOnline: DEFAULT_MATCH_DATA.isOnline,
  };

  const inputHeight = useSharedValue(48);

  const handleSend = () => {
    if (!message.trim()) return;

    const messageContent = message.trim();

    // Stop typing indicator
    setTyping(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
      'Would you like to share your current search filters with this person?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share Filters',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Filters Shared', 'Your search filters have been sent!');
          },
        },
      ]
    );
  };

  // Handle more options menu
  const handleMoreOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Options',
      undefined,
      [
        {
          text: 'View Profile',
          onPress: () => {
            // Navigate to profile view
            Alert.alert('Coming Soon', 'Profile view will be available soon!');
          },
        },
        {
          text: 'Report User',
          onPress: () => {
            Alert.alert(
              'Report User',
              'Are you sure you want to report this user?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report',
                  style: 'destructive',
                  onPress: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Reported', 'Thank you for your report. We will review it shortly.');
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Block User',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Block User',
              'Are you sure you want to block this user? You will no longer see each other.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: () => {
                    if (!match.id) return;
                    blockUser.mutate(match.id, {
                      onSuccess: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert('Blocked', 'This user has been blocked.');
                        router.replace('/(tabs)/matches');
                      },
                      onError: () => {
                        Alert.alert('Something went wrong', 'Could not block this user. Please try again.');
                      },
                    });
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Unmatch',
              'Are you sure you want to unmatch? This conversation will be deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Unmatch',
                  style: 'destructive',
                  onPress: () => {
                    if (!matchId) return;
                    unmatchUser.mutate(matchId, {
                      onSuccess: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert('Unmatched', 'You have been unmatched from this person.');
                        router.replace('/(tabs)/matches');
                      },
                      onError: () => {
                        Alert.alert('Something went wrong', 'Could not unmatch. Please try again.');
                      },
                    });
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  // Handle error state
  const hasError = isDemoMode
    ? !demoMatch
    : (matchError || (!matchData && !messagesLoading && !matchLoading));

  if (hasError) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/matches')}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
        </View>
        <View style={[styles.centered, { flex: 1 }]}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.transparent.white30} />
          </View>
          <Text style={styles.errorTitle}>Conversation Not Found</Text>
          <Text style={styles.errorSubtitle}>
            This conversation may no longer be available
          </Text>
          <Pressable style={styles.errorButton} onPress={() => router.replace('/(tabs)/matches')}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <LinearGradient
        colors={[colors.primary.navy, colors.dark.background]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/matches')}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <Pressable style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: match.photo || 'https://via.placeholder.com/200' }}
                style={styles.headerAvatar}
              />
              {match.isOnline && <View style={styles.onlineDot} />}
            </View>
            <View>
              <Text style={styles.headerName}>{match.name}</Text>
              {isOtherTyping ? (
                <Text style={styles.typingStatus}>typing...</Text>
              ) : match.isOnline ? (
                <Text style={styles.onlineStatus}>Online</Text>
              ) : (
                <Text style={styles.offlineStatus}>Offline</Text>
              )}
            </View>
          </Pressable>
          <Pressable style={styles.shareButton} onPress={handleShareFilters}>
            <Ionicons name="options-outline" size={20} color={colors.primary.gold} />
          </Pressable>
          <Pressable style={styles.moreButton} onPress={handleMoreOptions}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.primary.white} />
          </Pressable>
        </Animated.View>
      </LinearGradient>

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

      {/* Typing indicator */}
      {isOtherTyping && (
        <View style={styles.typingWrapper}>
          <Image source={{ uri: match.photo }} style={styles.typingAvatar} />
          <View style={styles.typingBubble}>
            <TypingIndicator />
          </View>
        </View>
      )}

      {/* Input - positioned above dot navigator */}
      <Animated.View
        style={[
          styles.inputContainer,
          // 70 was a hand-guess at the DotNavigator's height, and it was 15pt short, so
          // the composer sat under the dots (MEXA-338, finding 9). The navigator now
          // publishes its own height.
          { paddingBottom: dotNavigatorInset },
          inputContainerStyle,
        ]}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.transparent.white40}
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
            <Ionicons name="send" size={18} color={colors.primary.navy} />
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.semantic.success,
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  onlineStatus: {
    fontSize: 12,
    color: colors.semantic.success,
    marginTop: 1,
  },
  offlineStatus: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginTop: 1,
  },
  typingStatus: {
    fontSize: 12,
    color: colors.primary.gold,
    marginTop: 1,
    fontStyle: 'italic',
  },
  shareButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.transparent.gold20,
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
    color: colors.transparent.white50,
    backgroundColor: colors.transparent.white10,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
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
    borderBottomRightRadius: spacing[1],
  },
  messageBubbleOther: {
    backgroundColor: colors.transparent.white10,
    borderBottomLeftRadius: spacing[1],
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextMe: {
    color: colors.primary.navy,
  },
  messageTextOther: {
    color: colors.primary.white,
  },
  messageTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: spacing[1],
  },
  messageTimeMe: {
    fontSize: 11,
    color: 'rgba(13, 27, 62, 0.6)',
  },
  messageTimeOther: {
    fontSize: 11,
    color: colors.transparent.white40,
    marginTop: spacing[1],
    textAlign: 'right',
  },
  typingWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: spacing[2],
  },
  typingBubble: {
    backgroundColor: colors.transparent.white10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    borderBottomLeftRadius: spacing[1],
  },
  typingContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.gold,
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  inputContainer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.transparent.white10,
    backgroundColor: colors.dark.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.primary.white,
    maxHeight: 100,
    paddingVertical: spacing[2],
    paddingLeft: spacing[3],
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
    opacity: 0.4,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: colors.transparent.white50,
    marginTop: spacing[2],
    textAlign: 'center',
    paddingHorizontal: spacing[8],
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
    color: colors.primary.navy,
  },
});
