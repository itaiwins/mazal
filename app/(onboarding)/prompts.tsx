/**
 * Prompts Screen
 *
 * Answer profile prompts to show personality
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { PROMPTS } from '@/lib/constants/prompts';
import { validateProfileContent } from '@/lib/moderation';

const MIN_PROMPTS = 2;
const MAX_PROMPTS = 3;
const MIN_ANSWER_LENGTH = 1;
const MAX_ANSWER_LENGTH = 300;

interface PromptAnswer {
  prompt_id: string;
  question: string;
  answer: string;
}

export default function PromptsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateBioPrompts = useOnboardingStore((s) => s.updateBioPrompts);

  const [prompts, setPrompts] = useState<PromptAnswer[]>(
    data?.prompts?.map((p) => ({
      prompt_id: p.prompt_id,
      question: p.prompt_id, // Will be replaced when selecting
      answer: p.answer,
    })) || []
  );
  const [showPicker, setShowPicker] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingAnswer, setEditingAnswer] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('jewish');
  const [moderationError, setModerationError] = useState<string | null>(null);

  // Check that we have enough prompts with answers
  const completedPrompts = prompts.filter(p => p.answer && p.answer.trim().length >= MIN_ANSWER_LENGTH);
  const isValid = completedPrompts.length >= MIN_PROMPTS;

  const categories = Object.keys(PROMPTS);

  const handleSelectPrompt = (promptId: string, question: string) => {
    if (editingIndex !== null) {
      // Replacing existing prompt
      const newPrompts = [...prompts];
      newPrompts[editingIndex] = { prompt_id: promptId, question, answer: '' };
      setPrompts(newPrompts);
      setEditingAnswer('');
    } else if (prompts.length < MAX_PROMPTS) {
      // Adding new prompt
      setPrompts([...prompts, { prompt_id: promptId, question, answer: '' }]);
      setEditingIndex(prompts.length);
      setEditingAnswer('');
    }
    setShowPicker(false);
  };

  const handleSaveAnswer = () => {
    if (editingIndex !== null && editingAnswer.trim().length >= MIN_ANSWER_LENGTH) {
      // Validate content for inappropriate material
      const validation = validateProfileContent(editingAnswer.trim());
      if (!validation.isValid) {
        setModerationError(validation.error || 'This content is not allowed.');
        return;
      }

      setModerationError(null);
      const newPrompts = [...prompts];
      newPrompts[editingIndex] = {
        ...newPrompts[editingIndex],
        answer: editingAnswer.trim(),
      };
      setPrompts(newPrompts);
      setEditingIndex(null);
      setEditingAnswer('');
    }
  };

  const handleRemovePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingAnswer('');
    }
  };

  const handleEditPrompt = (index: number) => {
    setEditingIndex(index);
    setEditingAnswer(prompts[index].answer);
  };

  const handleContinue = () => {
    // Convert to store format with all required fields
    const storePrompts = prompts.map((p, index) => ({
      prompt_id: p.prompt_id,
      prompt_text: p.question,
      answer: p.answer,
      display_order: index,
    }));
    updateBioPrompts({ prompts: storePrompts });
    router.push('/(onboarding)/preferences');
  };

  const usedPromptIds = prompts.map((p) => p.prompt_id);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[16],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Show your personality
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Answer {MIN_PROMPTS}-{MAX_PROMPTS} prompts to complete your profile
          </Text>
        </View>

        {/* Current Prompts */}
        <View style={styles.promptsList}>
          {prompts.map((prompt, index) => (
            <Animated.View
              key={`${prompt.prompt_id}-${index}`}
              entering={FadeIn}
              exiting={FadeOut}
              style={[styles.promptCard, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.promptHeader}>
                <Text style={[styles.promptQuestion, { color: theme.colors.text }]}>
                  {prompt.question}
                </Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => handleRemovePrompt(index)}
                >
                  <Ionicons name="close" size={18} color={colors.neutral[400]} />
                </Pressable>
              </View>

              {editingIndex === index ? (
                <View style={styles.answerInput}>
                  <TextInput
                    style={[styles.textInput, { color: theme.colors.text }]}
                    placeholder="Write your answer..."
                    placeholderTextColor={theme.colors.textTertiary}
                    value={editingAnswer}
                    onChangeText={(text) => {
                      setEditingAnswer(text);
                      if (moderationError) setModerationError(null);
                    }}
                    multiline
                    maxLength={MAX_ANSWER_LENGTH}
                    autoFocus
                  />
                  <View style={styles.answerFooter}>
                    <Text style={[styles.charCount, { color: theme.colors.textTertiary }]}>
                      {editingAnswer.length}/{MAX_ANSWER_LENGTH}
                    </Text>
                    <Pressable
                      style={[
                        styles.saveButton,
                        editingAnswer.trim().length < MIN_ANSWER_LENGTH &&
                          styles.saveButtonDisabled,
                      ]}
                      onPress={handleSaveAnswer}
                      disabled={editingAnswer.trim().length < MIN_ANSWER_LENGTH}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                  </View>
                  {moderationError && (
                    <Text style={styles.moderationError}>{moderationError}</Text>
                  )}
                </View>
              ) : (
                <Pressable onPress={() => handleEditPrompt(index)}>
                  {prompt.answer ? (
                    <Text style={[styles.promptAnswer, { color: theme.colors.text }]}>
                      {prompt.answer}
                    </Text>
                  ) : (
                    <Text
                      style={[styles.promptPlaceholder, { color: theme.colors.textTertiary }]}
                    >
                      Tap to write your answer...
                    </Text>
                  )}
                </Pressable>
              )}
            </Animated.View>
          ))}

          {/* Add Prompt Button */}
          {prompts.length < MAX_PROMPTS && (
            <Pressable
              style={[styles.addPromptButton, { borderColor: colors.primary.gold }]}
              onPress={() => {
                setEditingIndex(null);
                setShowPicker(true);
              }}
            >
              <Ionicons name="add-circle" size={24} color={colors.primary.gold} />
              <Text style={[styles.addPromptText, { color: colors.primary.gold }]}>
                Add a prompt
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.continueButton,
            !isValid && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <Text style={styles.continueText}>
            Continue ({completedPrompts.length}/{MIN_PROMPTS} complete)
          </Text>
        </Pressable>
      </View>

      {/* Prompt Picker Modal */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Choose a prompt
            </Text>
            <Pressable
              style={styles.modalClose}
              onPress={() => setShowPicker(false)}
            >
              <Ionicons name="close" size={24} color={theme.colors.icon} />
            </Pressable>
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {categories.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.categoryTab,
                  selectedCategory === cat && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color:
                        selectedCategory === cat
                          ? colors.primary.gold
                          : theme.colors.textSecondary,
                    },
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Prompts List */}
          <ScrollView style={styles.promptPicker}>
            {PROMPTS[selectedCategory as keyof typeof PROMPTS]?.map((prompt) => {
              const isUsed = usedPromptIds.includes(prompt.id);
              return (
                <Pressable
                  key={prompt.id}
                  style={[
                    styles.promptOption,
                    { backgroundColor: theme.colors.surface },
                    isUsed && styles.promptOptionUsed,
                  ]}
                  onPress={() => handleSelectPrompt(prompt.id, prompt.question)}
                  disabled={isUsed}
                >
                  <Text
                    style={[
                      styles.promptOptionText,
                      { color: isUsed ? theme.colors.textTertiary : theme.colors.text },
                    ]}
                  >
                    {prompt.question}
                  </Text>
                  {isUsed && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.semantic.success}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  header: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
  },
  promptsList: {
    gap: spacing[4],
  },
  promptCard: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  promptQuestion: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing[2],
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptAnswer: {
    fontSize: 15,
    lineHeight: 22,
  },
  promptPlaceholder: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  answerInput: {
    gap: spacing[2],
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  answerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  moderationError: {
    fontSize: 13,
    color: colors.semantic.error,
    marginTop: spacing[2],
  },
  addPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: spacing[2],
  },
  addPromptText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  continueButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTabs: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  categoryTabsContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  categoryTab: {
    paddingVertical: spacing[3],
  },
  categoryTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary.gold,
  },
  categoryTabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  promptPicker: {
    flex: 1,
    padding: spacing[4],
  },
  promptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    marginBottom: spacing[2],
    borderRadius: borderRadius.lg,
  },
  promptOptionUsed: {
    opacity: 0.6,
  },
  promptOptionText: {
    fontSize: 15,
    flex: 1,
    marginRight: spacing[2],
  },
});
