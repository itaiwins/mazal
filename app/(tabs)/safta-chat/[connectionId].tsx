/**
 * Safta Chat Screen
 *
 * Premium chat interface between a user and their connected Safta
 * Matches premium dark theme design
 * Includes preference sharing functionality
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
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useSaftaMessages, useSaftaConnectionById, type SaftaMessage } from '@/api/queries';
import { useSendSaftaMessage, useMarkSaftaMessagesAsRead } from '@/api/mutations';
import { useAuthStore } from '@/stores/authStore';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';

// Available Jewish backgrounds for preferences
const JEWISH_BACKGROUNDS = [
  'Reform',
  'Conservative',
  'Modern Orthodox',
  'Orthodox',
  'Reconstructionist',
  'Just Jewish',
];

// Default Safta avatar
const SAFTA_DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=200';

interface MessageBubbleProps {
  message: SaftaMessage;
  isMe: boolean;
  showAvatar: boolean;
  saftaPhoto: string;
}

function MessageBubble({ message, isMe, showAvatar, saftaPhoto }: MessageBubbleProps) {
  // Different entrance animations for sent vs received
  const enteringAnimation = isMe
    ? FadeInRight.springify().damping(18).stiffness(200)
    : FadeInLeft.springify().damping(18).stiffness(200);

  return (
    <Animated.View
      entering={enteringAnimation}
      style={[styles.messageRow, isMe && styles.messageRowMe]}
    >
      {!isMe && showAvatar && (
        <Image source={{ uri: saftaPhoto }} style={styles.messageAvatar} />
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
          <Text style={styles.messageTimeMe}>
            {formatTime(message.createdAt)}
          </Text>
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
  // Parents/grandparents mode is hidden behind a flag (docs/ROADMAP.md)
  if (!FEATURE_SAFTA_MODE) {
    return <Redirect href="/(tabs)/" />;
  }

  return <SaftaChatScreenContent />;
}

function SaftaChatScreenContent() {
  const insets = useSafeAreaInsets();
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const [message, setMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const currentUser = useAuthStore((s) => s.user);

  // Preferences modal state
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [prefMinAge, setPrefMinAge] = useState(25);
  const [prefMaxAge, setPrefMaxAge] = useState(35);
  const [prefMaxDistance, setPrefMaxDistance] = useState(50);
  const [prefBackgrounds, setPrefBackgrounds] = useState<string[]>(['Just Jewish']);
  const [prefNote, setPrefNote] = useState('');

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

  // Toggle background preference
  const toggleBackground = (bg: string) => {
    setPrefBackgrounds((prev) =>
      prev.includes(bg) ? prev.filter((b) => b !== bg) : [...prev, bg]
    );
  };

  // Send preferences to Safta
  const handleSendPreferences = () => {
    if (prefBackgrounds.length === 0) {
      Alert.alert('Please select at least one Jewish background');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Create a formatted preferences message
    const preferencesMessage = `📋 My Dating Preferences\n\n` +
      `👤 Age Range: ${prefMinAge} - ${prefMaxAge}\n` +
      `📍 Max Distance: ${prefMaxDistance} miles\n` +
      `✡️ Jewish Background: ${prefBackgrounds.join(', ')}\n` +
      (prefNote ? `\n💬 Note: ${prefNote}` : '');

    // Send as a message
    if (connectionId) {
      sendMessage.mutate({
        connectionId,
        content: preferencesMessage,
      });
    }

    // Close modal and reset
    setShowPreferencesModal(false);
    setPrefNote('');

    // Scroll to bottom after sending
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  // Error state
  if (connectionError || !connection) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.primary.navy, colors.dark.background]}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
        >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
            </Pressable>
          </View>
        </LinearGradient>
        <View style={[styles.centered, { flex: 1 }]}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.transparent.white30} />
          </View>
          <Text style={styles.errorTitle}>Connection Not Found</Text>
          <Text style={styles.errorSubtitle}>
            This Safta connection may no longer be available.
          </Text>
          <Pressable style={styles.errorButton} onPress={() => router.back()}>
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
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <Pressable style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: SAFTA_DEFAULT_PHOTO }}
                style={styles.headerAvatar}
              />
              <View style={styles.saftaBadge}>
                <Text style={styles.saftaBadgeText}>S</Text>
              </View>
            </View>
            <View>
              <Text style={styles.headerName}>{connection.saftaName}</Text>
              <Text style={styles.headerRelationship}>{relationshipLabel}</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.sharePrefsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPreferencesModal(true);
            }}
          >
            <Ionicons name="options-outline" size={20} color={colors.primary.gold} />
          </Pressable>
          <Pressable style={styles.moreButton}>
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="chatbubbles" size={48} color={colors.primary.gold} />
            </View>
            <Text style={styles.emptyTitle}>
              Start a conversation with {connection.saftaName}
            </Text>
            <Text style={styles.emptySubtitle}>
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
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message your Safta..."
            placeholderTextColor={colors.transparent.white40}
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
              <ActivityIndicator size="small" color={colors.primary.navy} />
            ) : (
              <Ionicons name="send" size={18} color={colors.primary.navy} />
            )}
          </Pressable>
        </View>
      </Animated.View>

      {/* Share Preferences Modal */}
      <Modal
        visible={showPreferencesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreferencesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowPreferencesModal(false)}>
              <Ionicons name="close" size={28} color={colors.primary.white} />
            </Pressable>
            <Text style={styles.modalTitle}>Share My Preferences</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: spacing[8] }}
          >
            <Text style={styles.modalSubtitle}>
              Let {connection?.saftaName || 'your Safta'} know what you're looking for.
              They'll use these preferences to find better matches for you.
            </Text>

            {/* Age Range */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Age Range</Text>
              <View style={styles.filterCard}>
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>Minimum Age</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepperButton}
                      onPress={() => setPrefMinAge(Math.max(18, prefMinAge - 1))}
                    >
                      <Ionicons name="remove" size={20} color={colors.primary.navy} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{prefMinAge}</Text>
                    <Pressable
                      style={styles.stepperButton}
                      onPress={() => setPrefMinAge(Math.min(prefMaxAge - 1, prefMinAge + 1))}
                    >
                      <Ionicons name="add" size={20} color={colors.primary.navy} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>Maximum Age</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepperButton}
                      onPress={() => setPrefMaxAge(Math.max(prefMinAge + 1, prefMaxAge - 1))}
                    >
                      <Ionicons name="remove" size={20} color={colors.primary.navy} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{prefMaxAge}</Text>
                    <Pressable
                      style={styles.stepperButton}
                      onPress={() => setPrefMaxAge(Math.min(80, prefMaxAge + 1))}
                    >
                      <Ionicons name="add" size={20} color={colors.primary.navy} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            {/* Distance */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Maximum Distance</Text>
              <View style={styles.filterCard}>
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>Miles</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepperButton}
                      onPress={() => setPrefMaxDistance(Math.max(5, prefMaxDistance - 5))}
                    >
                      <Ionicons name="remove" size={20} color={colors.primary.navy} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{prefMaxDistance}</Text>
                    <Pressable
                      style={styles.stepperButton}
                      onPress={() => setPrefMaxDistance(Math.min(500, prefMaxDistance + 5))}
                    >
                      <Ionicons name="add" size={20} color={colors.primary.navy} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            {/* Jewish Background */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Jewish Background</Text>
              <View style={styles.filterCard}>
                {JEWISH_BACKGROUNDS.map((bg) => (
                  <Pressable
                    key={bg}
                    style={styles.backgroundOption}
                    onPress={() => toggleBackground(bg)}
                  >
                    <Text style={styles.backgroundLabel}>{bg}</Text>
                    <Ionicons
                      name={prefBackgrounds.includes(bg) ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={prefBackgrounds.includes(bg) ? colors.primary.gold : colors.neutral[400]}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Additional Note */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Additional Note (Optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Any other preferences or things to know..."
                placeholderTextColor={colors.transparent.white40}
                value={prefNote}
                onChangeText={setPrefNote}
                multiline
                maxLength={200}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.sendPrefsButton} onPress={handleSendPreferences}>
              <Ionicons name="send" size={20} color={colors.primary.navy} />
              <Text style={styles.sendPrefsButtonText}>Send to {connection?.saftaName || 'Safta'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  saftaBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  saftaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  headerRelationship: {
    fontSize: 12,
    color: colors.primary.gold,
    marginTop: 1,
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
    flexGrow: 1,
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
  messageTimeMe: {
    fontSize: 11,
    color: 'rgba(13, 27, 62, 0.6)',
    marginTop: spacing[1],
    textAlign: 'right',
  },
  messageTimeOther: {
    fontSize: 11,
    color: colors.transparent.white40,
    marginTop: spacing[1],
    textAlign: 'right',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[10],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.transparent.white60,
    textAlign: 'center',
    lineHeight: 20,
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
    color: colors.primary.navy,
  },
  // Share Preferences Button in Header
  sharePrefsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.transparent.gold20,
    borderRadius: 20,
    marginRight: spacing[1],
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  modalSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.transparent.white70,
    marginBottom: spacing[6],
  },
  modalFooter: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.transparent.white10,
  },
  filterGroup: {
    marginBottom: spacing[5],
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  filterCard: {
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  stepperLabel: {
    fontSize: 16,
    color: colors.primary.white,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
    minWidth: 40,
    textAlign: 'center',
  },
  backgroundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  backgroundLabel: {
    fontSize: 16,
    color: colors.primary.white,
  },
  noteInput: {
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 16,
    color: colors.primary.white,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sendPrefsButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  sendPrefsButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
