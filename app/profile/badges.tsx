/**
 * Profile Badges Screen
 *
 * Select and manage profile badges
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUserProfile } from '@/api/queries';
import { supabase } from '@/api/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/config/queryClient';

const ALL_BADGES = [
  { id: 'birthright', label: 'Birthright Alumni', emoji: '✈️', description: 'Completed a Birthright trip' },
  { id: 'hebrew_speaker', label: 'Hebrew Speaker', emoji: '🗣️', description: 'Conversational in Hebrew' },
  { id: 'day_school', label: 'Day School', emoji: '🎓', description: 'Attended Jewish day school' },
  { id: 'camp', label: 'Camp Alumni', emoji: '🏕️', description: 'Attended Jewish summer camp' },
  { id: 'hillel', label: 'Hillel Active', emoji: '🕍', description: 'Active in Hillel' },
  { id: 'gap_year', label: 'Gap Year Israel', emoji: '🇮🇱', description: 'Did a gap year in Israel' },
  { id: 'shabbat_host', label: 'Shabbat Host', emoji: '🕯️', description: 'Loves hosting Shabbat dinners' },
  { id: 'kosher', label: 'Keeps Kosher', emoji: '🍽️', description: 'Observes kosher dietary laws' },
  { id: 'volunteer', label: 'Jewish Volunteer', emoji: '🤝', description: 'Volunteers with Jewish organizations' },
  { id: 'musician', label: 'Jewish Music', emoji: '🎵', description: 'Plays Jewish/Israeli music' },
  { id: 'greek_life', label: 'Greek Life', emoji: '🏛️', description: 'Fraternity or sorority member' },
];

export default function BadgesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Get user ID from auth store
  const user = useAuthStore((s) => s.user);
  const authUser = useAuthStore((s) => s.authUser);
  const userId = user?.id || authUser?.id;

  // Fetch current badges from profile
  const { data: userProfile, isLoading: isLoadingProfile } = useUserProfile();

  // Initialize selected badges from profile data
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load existing badges when profile data is available
  useEffect(() => {
    if (userProfile?.badges && !isInitialized) {
      const existingBadgeIds = userProfile.badges.map((b) => b.badge_type);
      setSelectedBadges(existingBadgeIds);
      setIsInitialized(true);
    }
  }, [userProfile?.badges, isInitialized]);

  const handleBack = () => {
    router.back();
  };

  const handleToggleBadge = (badgeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (selectedBadges.includes(badgeId)) {
      setSelectedBadges(selectedBadges.filter((id) => id !== badgeId));
    } else {
      if (selectedBadges.length >= 5) {
        Alert.alert('Limit Reached', 'You can display up to 5 badges on your profile.');
        return;
      }
      setSelectedBadges([...selectedBadges, badgeId]);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsSaving(true);

    try {
      // Delete all existing badges for this user
      const { error: deleteError } = await supabase
        .from('user_badges')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting badges:', deleteError);
        throw deleteError;
      }

      // Insert new badges if any are selected
      if (selectedBadges.length > 0) {
        const badgesToInsert = selectedBadges.map((badgeType) => ({
          user_id: userId,
          badge_type: badgeType,
        }));

        const { error: insertError } = await supabase
          .from('user_badges')
          .insert(badgesToInsert);

        if (insertError) {
          console.error('Error inserting badges:', insertError);
          throw insertError;
        }
      }

      // Invalidate user profile cache to refetch with new badges
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Error saving badges:', error);
      Alert.alert('Error', 'Failed to save badges. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading while fetching profile
  if (isLoadingProfile) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
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
          Badges
        </Text>
        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary.gold} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={[styles.infoCard, { backgroundColor: colors.transparent.gold20 }]}
        >
          <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            Select up to 5 badges to display on your profile. Badges help others learn more about your Jewish journey.
          </Text>
        </Animated.View>

        {/* Selected Count */}
        <Text style={[styles.countText, { color: theme.colors.textSecondary }]}>
          {selectedBadges.length}/5 badges selected
        </Text>

        {/* Badges Grid */}
        <View style={styles.badgesGrid}>
          {ALL_BADGES.map((badge, index) => {
            const isSelected = selectedBadges.includes(badge.id);
            return (
              <Animated.View
                key={badge.id}
                entering={FadeInDown.delay(150 + index * 50).springify()}
              >
                <Pressable
                  style={[
                    styles.badgeCard,
                    { backgroundColor: theme.colors.surface },
                    isSelected && styles.badgeCardSelected,
                  ]}
                  onPress={() => handleToggleBadge(badge.id)}
                >
                  <View style={styles.badgeHeader}>
                    <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                    <View
                      style={[
                        styles.badgeCheck,
                        isSelected && styles.badgeCheckSelected,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color={colors.primary.white} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.badgeLabel, { color: theme.colors.text }]}>
                    {badge.label}
                  </Text>
                  <Text style={[styles.badgeDescription, { color: theme.colors.textSecondary }]}>
                    {badge.description}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
  saveButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  countText: {
    fontSize: 14,
    marginBottom: spacing[3],
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  badgeCard: {
    width: '47%',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 160,
  },
  badgeCardSelected: {
    borderColor: colors.primary.gold,
  },
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCheckSelected: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  badgeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  badgeDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});
