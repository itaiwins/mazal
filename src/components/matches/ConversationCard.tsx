/**
 * ConversationCard Component
 *
 * Glass morphism card for conversation list items.
 * Features gold border accent on unread messages,
 * staggered entry animation, and swipe-to-archive gesture.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInRight,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { SPRING_CONFIGS } from '@/constants/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = -80;

interface ConversationData {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
  isOnline: boolean;
  isSafta?: boolean;
  relationship?: string;
}

interface ConversationCardProps {
  conversation: ConversationData;
  index: number;
  onPress: () => void;
  onArchive?: () => void;
}

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

export function ConversationCard({
  conversation,
  index,
  onPress,
  onArchive,
}: ConversationCardProps) {
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const hasUnread = conversation.unread > 0;

  const handlePressIn = () => {
    scale.value = withSpring(0.98, SPRING_CONFIGS.QUICK);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIGS.QUICK);
  };

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      // Only allow swiping left
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -120);
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationX < SWIPE_THRESHOLD && onArchive) {
        // Swipe to archive
        translateX.value = withSpring(-SCREEN_WIDTH, SPRING_CONFIGS.SWIPE_DISMISS);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onArchive)();
      } else {
        // Snap back
        translateX.value = withSpring(0, SPRING_CONFIGS.BOUNCE_BACK);
      }
    })
    .activeOffsetX([-10, 10]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const archiveButtonStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translateX.value) / 80, 1),
    transform: [{ scale: Math.min(Math.abs(translateX.value) / 80, 1) }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 80).springify().damping(15)}
      style={styles.container}
    >
      {/* Archive button (revealed on swipe) */}
      <Animated.View style={[styles.archiveButton, archiveButtonStyle]}>
        <Ionicons name="archive" size={24} color={colors.primary.white} />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
          >
            <View style={[
              styles.card,
              hasUnread && styles.cardUnread,
            ]}>
              {/* Glass effect background */}
              <BlurView intensity={20} tint="dark" style={styles.blurBackground} />
              <LinearGradient
                colors={['rgba(20, 35, 75, 0.6)', 'rgba(20, 35, 75, 0.9)']}
                style={styles.gradientOverlay}
              />

              {/* Gold border for unread */}
              {hasUnread && (
                <View style={styles.unreadBorder} />
              )}

              {/* Content */}
              <View style={styles.content}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <Image
                    source={{ uri: conversation.photo }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                  {conversation.isOnline && <View style={styles.onlineIndicator} />}
                  {conversation.isSafta && (
                    <View style={styles.saftaIndicator}>
                      <Text style={styles.saftaEmoji}>👵</Text>
                    </View>
                  )}
                </View>

                {/* Message info */}
                <View style={styles.messageInfo}>
                  <View style={styles.headerRow}>
                    <View style={styles.nameContainer}>
                      <Text style={[
                        styles.name,
                        hasUnread && styles.nameUnread,
                      ]}>
                        {conversation.name}
                      </Text>
                      {conversation.isSafta && conversation.relationship && (
                        <View style={styles.relationshipBadge}>
                          <Text style={styles.relationshipText}>
                            {conversation.relationship}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.time}>
                      {formatTime(conversation.lastMessageTime)}
                    </Text>
                  </View>

                  <View style={styles.messageRow}>
                    <Text
                      style={[
                        styles.lastMessage,
                        hasUnread && styles.lastMessageUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {conversation.lastMessage}
                    </Text>
                    {hasUnread && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>
                          {conversation.unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    position: 'relative',
  },
  archiveButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: colors.status.error,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  cardUnread: {
    // Handled by unreadBorder
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  unreadBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary.gold,
    borderTopLeftRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    gap: spacing[3],
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.transparent.white20,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  saftaIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  saftaEmoji: {
    fontSize: 12,
  },
  messageInfo: {
    flex: 1,
    gap: spacing[1],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  nameUnread: {
    fontWeight: '700',
  },
  relationshipBadge: {
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  relationshipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  time: {
    fontSize: 12,
    color: colors.transparent.white50,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: colors.transparent.white60,
  },
  lastMessageUnread: {
    color: colors.transparent.white80,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: colors.primary.gold,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.navy,
  },
});

export default ConversationCard;
