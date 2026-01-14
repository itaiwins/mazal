/**
 * Prompt Card Component
 *
 * Interactive prompt display with like and reply functionality
 */

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

interface PromptCardProps {
  promptId: string;
  question: string;
  answer: string;
  index: number;
  profileName: string;
  onLike: (promptId: string) => void;
  onReply: (promptId: string, message: string) => void;
}

export function PromptCard({
  promptId,
  question,
  answer,
  index,
  profileName,
  onLike,
  onReply,
}: PromptCardProps) {
  const insets = useSafeAreaInsets();
  const [isLiked, setIsLiked] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const scale = useSharedValue(1);

  const MAX_REPLY_LENGTH = 150;

  const handleLike = useCallback(() => {
    if (isLiked) return;

    setIsLiked(true);
    scale.value = withSpring(1.1, { damping: 6 }, () => {
      scale.value = withSpring(1);
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLike(promptId);
  }, [isLiked, promptId, onLike]);

  const handleOpenReply = useCallback(() => {
    setReplyText('');
    setShowReplyModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSendReply = useCallback(() => {
    if (!replyText.trim()) return;

    onReply(promptId, replyText.trim());
    setShowReplyModal(false);
    setIsLiked(true); // Liking via reply
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [promptId, replyText, onReply]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <Animated.View
        entering={FadeInUp.delay(300 + index * 100).springify()}
        style={[styles.container, cardStyle, isLiked && styles.containerLiked]}
      >
        {/* Question */}
        <Text style={styles.question}>{question}</Text>

        {/* Answer */}
        <Text style={styles.answer}>{answer}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, isLiked && styles.actionButtonLiked]}
            onPress={handleLike}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={isLiked ? colors.primary.gold : colors.transparent.white70}
            />
            <Text style={[styles.actionText, isLiked && styles.actionTextLiked]}>
              {isLiked ? 'Liked' : 'Like'}
            </Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleOpenReply}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.transparent.white70} />
            <Text style={styles.actionText}>Reply</Text>
          </Pressable>
        </View>

        {/* Liked indicator glow */}
        {isLiked && <View style={styles.likedGlow} />}
      </Animated.View>

      {/* Reply Modal */}
      <Modal
        visible={showReplyModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowReplyModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top || spacing[4] }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowReplyModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Reply to Prompt</Text>
            <Pressable
              onPress={handleSendReply}
              disabled={!replyText.trim()}
            >
              <Text style={[styles.sendText, !replyText.trim() && styles.sendTextDisabled]}>
                Send
              </Text>
            </Pressable>
          </View>

          {/* Prompt Preview */}
          <View style={styles.promptPreview}>
            <Text style={styles.previewQuestion}>{question}</Text>
            <Text style={styles.previewAnswer}>{answer}</Text>
          </View>

          {/* Reply Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Your reply to {profileName}:</Text>
            <TextInput
              style={styles.input}
              value={replyText}
              onChangeText={(text) => setReplyText(text.slice(0, MAX_REPLY_LENGTH))}
              placeholder="Start a conversation..."
              placeholderTextColor={colors.neutral[500]}
              multiline
              autoFocus
            />
            <Text style={styles.charCount}>
              {replyText.length}/{MAX_REPLY_LENGTH}
            </Text>
          </View>

          {/* Hint */}
          <Text style={styles.hint}>
            This message will be sent when you match. It's a great way to start a conversation!
          </Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: spacing[5],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    overflow: 'hidden',
  },
  containerLiked: {
    borderColor: colors.transparent.gold50,
    backgroundColor: colors.transparent.gold10,
  },
  question: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.transparent.white60,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  answer: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.primary.white,
    lineHeight: 26,
    marginBottom: spacing[4],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.full,
  },
  actionButtonLiked: {
    backgroundColor: colors.transparent.gold20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.transparent.white70,
  },
  actionTextLiked: {
    color: colors.primary.gold,
  },
  likedGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary.gold,
    opacity: 0.1,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.dark.background,
    padding: spacing[4],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  cancelText: {
    fontSize: 16,
    color: colors.transparent.white70,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  sendText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  sendTextDisabled: {
    color: colors.neutral[600],
  },
  promptPreview: {
    marginTop: spacing[5],
    padding: spacing[4],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
  },
  previewQuestion: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginBottom: spacing[1],
  },
  previewAnswer: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
    lineHeight: 22,
  },
  inputContainer: {
    marginTop: spacing[5],
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.transparent.white70,
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 16,
    color: colors.primary.white,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: colors.transparent.white50,
    textAlign: 'right',
    marginTop: spacing[2],
  },
  hint: {
    fontSize: 13,
    color: colors.transparent.white50,
    textAlign: 'center',
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
    lineHeight: 18,
  },
});
