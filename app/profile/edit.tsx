/**
 * Profile Edit Screen
 *
 * Full profile editor with photos, bio, prompts, and work/education
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUserProfile } from '@/api/queries';
import { useUpdateProfile, useUpdatePhotos, useUpdatePrompts } from '@/api/mutations';
import { usePhotoUpload } from '@/api/storage';
import { PROFILE_PROMPTS, getPromptById } from '@/lib/constants/prompts';

interface PhotoSlot {
  id: string;
  url: string;
  order: number;
  isUploading?: boolean;
}

interface PromptAnswer {
  prompt_id: string;
  prompt_text: string;
  answer: string;
  display_order: number;
}

export default function ProfileEditScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  // API hooks
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const updateProfile = useUpdateProfile();
  const updatePhotos = useUpdatePhotos();
  const updatePrompts = useUpdatePrompts();
  const { pickAndUploadPhoto, isUploading: photoUploading, deletePhoto } = usePhotoUpload();

  // Local state
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [company, setCompany] = useState('');
  const [education, setEducation] = useState('');
  const [prompts, setPrompts] = useState<PromptAnswer[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Prompt modal state
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptAnswer | null>(null);
  const [promptAnswer, setPromptAnswer] = useState('');

  // Load initial data from profile
  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setOccupation(profile.occupation || '');
      setCompany(profile.company || '');
      setEducation(profile.education || '');

      // Load photos
      if (profile.photos && profile.photos.length > 0) {
        setPhotos(
          profile.photos.map((p) => ({
            id: p.id,
            url: p.photo_url,
            order: p.photo_order,
          }))
        );
      }

      // Load prompts
      if (profile.prompts && profile.prompts.length > 0) {
        setPrompts(
          profile.prompts.map((p) => ({
            prompt_id: p.prompt_id,
            prompt_text: getPromptById(p.prompt_id)?.text || p.prompt_id,
            answer: p.answer,
            display_order: p.display_order,
          }))
        );
      }
    }
  }, [profile]);

  const handleAddPhoto = async (index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Create temporary slot for uploading state
    const tempId = `temp-${Date.now()}`;
    const newPhotos = [...photos];

    if (index < photos.length) {
      // Replace existing photo
      newPhotos[index] = { ...newPhotos[index], isUploading: true };
    } else {
      // Add new photo slot
      newPhotos.push({ id: tempId, url: '', order: index, isUploading: true });
    }
    setPhotos(newPhotos);

    const url = await pickAndUploadPhoto();

    if (url) {
      setPhotos((prev) => {
        const updated = [...prev];
        const targetIndex = index < prev.length ? index : prev.length - 1;
        updated[targetIndex] = {
          id: `photo-${Date.now()}`,
          url,
          order: targetIndex,
          isUploading: false,
        };
        return updated;
      });
      setHasChanges(true);
    } else {
      // Remove temp slot if upload failed or cancelled
      setPhotos((prev) => prev.filter((p) => p.id !== tempId && !p.isUploading));
    }
  };

  const handleRemovePhoto = async (index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const photo = photos[index];
          if (photo.url) {
            await deletePhoto(photo.url);
          }
          setPhotos((prev) => prev.filter((_, i) => i !== index));
          setHasChanges(true);
        },
      },
    ]);
  };

  const handleAddPrompt = () => {
    if (prompts.length >= 3) {
      Alert.alert('Maximum Prompts', 'You can only have 3 prompts. Remove one to add another.');
      return;
    }
    setEditingPrompt(null);
    setPromptAnswer('');
    setShowPromptModal(true);
  };

  const handleEditPrompt = (prompt: PromptAnswer) => {
    setEditingPrompt(prompt);
    setPromptAnswer(prompt.answer);
    setShowPromptModal(true);
  };

  const handleSelectPrompt = (promptId: string, promptText: string) => {
    if (editingPrompt) {
      // Editing existing prompt
      setPrompts((prev) =>
        prev.map((p) =>
          p.prompt_id === editingPrompt.prompt_id
            ? { ...p, prompt_id: promptId, prompt_text: promptText, answer: promptAnswer }
            : p
        )
      );
    } else {
      // Adding new prompt
      setPrompts((prev) => [
        ...prev,
        {
          prompt_id: promptId,
          prompt_text: promptText,
          answer: promptAnswer,
          display_order: prev.length,
        },
      ]);
    }
    setShowPromptModal(false);
    setHasChanges(true);
  };

  const handleRemovePrompt = (promptId: string) => {
    Alert.alert('Remove Prompt', 'Are you sure you want to remove this prompt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPrompts((prev) => prev.filter((p) => p.prompt_id !== promptId));
          setHasChanges(true);
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Update profile fields
      await updateProfile.mutateAsync({
        bio,
        occupation,
        company,
        education,
      });

      // Update photos
      if (photos.length > 0) {
        await updatePhotos.mutateAsync(
          photos.map((p, index) => ({
            photo_url: p.url,
            photo_order: index,
            is_primary: index === 0,
          }))
        );
      }

      // Update prompts
      if (prompts.length > 0) {
        await updatePrompts.mutateAsync(
          prompts.map((p, index) => ({
            prompt_id: p.prompt_id,
            answer: p.answer,
            display_order: index,
          }))
        );
      }

      Alert.alert('Success', 'Your profile has been updated');
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert('Discard Changes', 'Are you sure you want to discard your changes?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  if (profileLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable style={styles.headerButton} onPress={handleCancel}>
          <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Profile</Text>
        <Pressable
          style={styles.headerButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary.gold} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Photos</Text>
          <Text style={[styles.sectionHint, { color: theme.colors.textTertiary }]}>
            Add up to 6 photos. First photo is your main.
          </Text>
          <View style={styles.photoGrid}>
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const photo = photos[index];
              return (
                <Pressable
                  key={index}
                  style={[styles.photoSlot, { backgroundColor: theme.colors.surface }]}
                  onPress={() => photo ? handleRemovePhoto(index) : handleAddPhoto(index)}
                  onLongPress={() => photo && handleRemovePhoto(index)}
                >
                  {photo?.isUploading ? (
                    <ActivityIndicator size="small" color={colors.primary.gold} />
                  ) : photo?.url ? (
                    <>
                      <Image source={{ uri: photo.url }} style={styles.photo} />
                      {index === 0 && (
                        <View style={styles.mainBadge}>
                          <Text style={styles.mainBadgeText}>Main</Text>
                        </View>
                      )}
                      <View style={styles.removeButton}>
                        <Ionicons name="close-circle" size={24} color={colors.semantic.error} />
                      </View>
                    </>
                  ) : (
                    <Ionicons name="add" size={28} color={colors.neutral[400]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About Me</Text>
          <TextInput
            style={[
              styles.bioInput,
              { backgroundColor: theme.colors.surface, color: theme.colors.text },
            ]}
            value={bio}
            onChangeText={(text) => {
              setBio(text);
              setHasChanges(true);
            }}
            placeholder="Write something about yourself..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            maxLength={500}
          />
          <Text style={[styles.charCount, { color: theme.colors.textTertiary }]}>
            {bio.length}/500
          </Text>
        </View>

        {/* Prompts Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Prompts</Text>
          <Text style={[styles.sectionHint, { color: theme.colors.textTertiary }]}>
            Add up to 3 prompts to help people get to know you.
          </Text>

          {prompts.map((prompt) => (
            <Pressable
              key={prompt.prompt_id}
              style={[styles.promptCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => handleEditPrompt(prompt)}
            >
              <View style={styles.promptHeader}>
                <Text style={[styles.promptQuestion, { color: theme.colors.textSecondary }]}>
                  {prompt.prompt_text}
                </Text>
                <Pressable onPress={() => handleRemovePrompt(prompt.prompt_id)}>
                  <Ionicons name="close" size={20} color={colors.neutral[400]} />
                </Pressable>
              </View>
              <Text style={[styles.promptAnswer, { color: theme.colors.text }]}>
                {prompt.answer}
              </Text>
            </Pressable>
          ))}

          {prompts.length < 3 && (
            <Pressable
              style={[styles.addButton, { borderColor: colors.primary.gold }]}
              onPress={handleAddPrompt}
            >
              <Ionicons name="add-circle" size={24} color={colors.primary.gold} />
              <Text style={[styles.addButtonText, { color: colors.primary.gold }]}>
                Add a prompt
              </Text>
            </Pressable>
          )}
        </View>

        {/* Work Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Work</Text>
          <View style={[styles.inputCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inputRow}>
              <Ionicons name="briefcase-outline" size={20} color={theme.colors.icon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={occupation}
                onChangeText={(text) => {
                  setOccupation(text);
                  setHasChanges(true);
                }}
                placeholder="Job title"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.inputRow}>
              <Ionicons name="business-outline" size={20} color={theme.colors.icon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={company}
                onChangeText={(text) => {
                  setCompany(text);
                  setHasChanges(true);
                }}
                placeholder="Company"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>
          </View>
        </View>

        {/* Education Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Education</Text>
          <View style={[styles.inputCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inputRow}>
              <Ionicons name="school-outline" size={20} color={theme.colors.icon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={education}
                onChangeText={(text) => {
                  setEducation(text);
                  setHasChanges(true);
                }}
                placeholder="School or university"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Prompt Selection Modal */}
      <Modal
        visible={showPromptModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPromptModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Pressable onPress={() => setShowPromptModal(false)}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingPrompt ? 'Edit Prompt' : 'Add Prompt'}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>
              Choose a prompt
            </Text>

            {PROFILE_PROMPTS.filter(
              (p) => !prompts.some((ep) => ep.prompt_id === p.id) || editingPrompt?.prompt_id === p.id
            ).map((prompt) => (
              <Pressable
                key={prompt.id}
                style={[
                  styles.promptOption,
                  { backgroundColor: theme.colors.surface },
                  editingPrompt?.prompt_id === prompt.id && styles.promptOptionSelected,
                ]}
                onPress={() => handleSelectPrompt(prompt.id, prompt.text)}
              >
                <Text style={[styles.promptOptionText, { color: theme.colors.text }]}>
                  {prompt.text}
                </Text>
              </Pressable>
            ))}

            <Text style={[styles.modalLabel, { color: theme.colors.textSecondary, marginTop: spacing[6] }]}>
              Your answer
            </Text>
            <TextInput
              style={[
                styles.promptInput,
                { backgroundColor: theme.colors.surface, color: theme.colors.text },
              ]}
              value={promptAnswer}
              onChangeText={setPromptAnswer}
              placeholder="Type your answer..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              maxLength={300}
            />
            <Text style={[styles.charCount, { color: theme.colors.textTertiary }]}>
              {promptAnswer.length}/300
            </Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  headerButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 16,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: spacing[4],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: spacing[3],
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  photoSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  mainBadge: {
    position: 'absolute',
    bottom: spacing[2],
    left: spacing[2],
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
  mainBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  removeButton: {
    position: 'absolute',
    top: spacing[1],
    right: spacing[1],
  },
  bioInput: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: spacing[2],
  },
  promptCard: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  promptQuestion: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing[2],
  },
  promptAnswer: {
    fontSize: 15,
    lineHeight: 22,
  },
  inputCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: spacing[12],
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: spacing[2],
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing[3],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptOption: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
  },
  promptOptionSelected: {
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  promptOptionText: {
    fontSize: 15,
  },
  promptInput: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
