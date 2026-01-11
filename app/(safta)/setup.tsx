/**
 * Safta Setup
 *
 * Setup screen for creating a Safta account invitation
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const RELATIONSHIP_OPTIONS = [
  { id: 'grandmother', label: 'Grandmother', emoji: '👵' },
  { id: 'grandfather', label: 'Grandfather', emoji: '👴' },
  { id: 'mother', label: 'Mother', emoji: '👩' },
  { id: 'father', label: 'Father', emoji: '👨' },
  { id: 'aunt', label: 'Aunt', emoji: '👩' },
  { id: 'uncle', label: 'Uncle', emoji: '👨' },
  { id: 'other', label: 'Other', emoji: '👤' },
];

export default function SaftaSetupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isValid = name.trim().length >= 2 && relationship;

  const generateInviteCode = () => {
    // Generate a simple invite code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `MAZAL-${code}`;
  };

  const handleCreateInvite = async () => {
    if (!isValid) return;

    setIsCreating(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // In production, this would create a record in Supabase
      const code = generateInviteCode();
      setInviteCode(code);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create invite. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Hi ${name}! I'd love your help finding my bashert. Use code ${inviteCode} to join Mazal as my ${RELATIONSHIP_OPTIONS.find((r) => r.id === relationship)?.label}. Download Mazal: https://mazal.app/safta`,
        title: 'Invite to Mazal Safta Mode',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Invite Family
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!inviteCode ? (
          <>
            {/* Name Input */}
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              style={styles.section}
            >
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Who are you inviting?
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Their name"
                placeholderTextColor={theme.colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={30}
              />
            </Animated.View>

            {/* Relationship */}
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              style={styles.section}
            >
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Their relationship to you
              </Text>
              <View style={styles.relationshipOptions}>
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.relationshipOption,
                      {
                        backgroundColor:
                          relationship === option.id
                            ? colors.primary.gold
                            : theme.colors.surface,
                        borderColor:
                          relationship === option.id
                            ? colors.primary.gold
                            : colors.neutral[200],
                      },
                    ]}
                    onPress={() => setRelationship(option.id)}
                  >
                    <Text style={styles.relationshipEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.relationshipLabel,
                        {
                          color:
                            relationship === option.id
                              ? colors.primary.navy
                              : theme.colors.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* Privacy Note */}
            <Animated.View
              entering={FadeInDown.delay(300).springify()}
              style={[styles.privacyCard, { backgroundColor: colors.transparent.gold20 }]}
            >
              <Ionicons name="shield-checkmark" size={20} color={colors.primary.gold} />
              <Text style={[styles.privacyText, { color: theme.colors.text }]}>
                {name || 'They'} will only be able to see profiles you've already swiped
                left on. Your matches and messages remain private.
              </Text>
            </Animated.View>
          </>
        ) : (
          <>
            {/* Success State */}
            <Animated.View
              entering={FadeInDown.springify()}
              style={styles.successContainer}
            >
              <Animated.View
                entering={ZoomIn.delay(200).springify()}
                style={styles.successIcon}
              >
                <Ionicons name="checkmark-circle" size={64} color={colors.semantic.success} />
              </Animated.View>
              <Text style={[styles.successTitle, { color: theme.colors.text }]}>
                Invite Created!
              </Text>
              <Text style={[styles.successSubtitle, { color: theme.colors.textSecondary }]}>
                Share this code with {name}
              </Text>

              <View style={[styles.codeCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.codeLabel, { color: theme.colors.textSecondary }]}>
                  Invite Code
                </Text>
                <Text style={[styles.code, { color: colors.primary.gold }]}>
                  {inviteCode}
                </Text>
              </View>

              <Pressable style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={colors.primary.navy} />
                <Text style={styles.shareButtonText}>Share Invite</Text>
              </Pressable>

              <Text style={[styles.expireNote, { color: theme.colors.textTertiary }]}>
                This invite expires in 7 days
              </Text>
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      {!inviteCode && (
        <View style={styles.footer}>
          <Pressable
            style={[
              styles.createButton,
              (!isValid || isCreating) && styles.createButtonDisabled,
            ]}
            onPress={handleCreateInvite}
            disabled={!isValid || isCreating}
          >
            <Text style={styles.createButtonText}>
              {isCreating ? 'Creating...' : 'Create Invite'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  section: {
    marginBottom: spacing[6],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  input: {
    fontSize: 16,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
  },
  relationshipOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  relationshipOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: spacing[2],
  },
  relationshipEmoji: {
    fontSize: 18,
  },
  relationshipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  privacyCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: spacing[8],
  },
  successIcon: {
    marginBottom: spacing[4],
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  successSubtitle: {
    fontSize: 16,
    marginBottom: spacing[6],
  },
  codeCard: {
    width: '100%',
    alignItems: 'center',
    padding: spacing[6],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[6],
  },
  codeLabel: {
    fontSize: 13,
    marginBottom: spacing[2],
  },
  code: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  expireNote: {
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  createButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
