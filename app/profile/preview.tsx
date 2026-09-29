/**
 * Profile Preview Screen
 *
 * See your profile as others see it
 */

import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions, Share, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useUserProfile } from '@/api/queries/useUserProfile';
import { getPromptById } from '@/lib/constants/prompts';
import {
  jewishBackgroundLabel,
  observanceLevelLabel,
  shabbatObservanceLabel,
  kosherLevelLabel,
  synagogueAttendanceLabel,
  jewishEducationLabel,
  lookingForLabel,
  wantsChildrenLabel,
} from '@/lib/constants/jewish';

const { width } = Dimensions.get('window');

// Calculate age from date of birth
function calculateAge(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 25;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Get prompt text by ID
function getPromptText(promptId: string): string {
  const prompt = getPromptById(promptId);
  return prompt?.text || promptId;
}

export default function ProfilePreviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  // Fetch full profile with photos and prompts
  const { data: profileData, isLoading } = useUserProfile();

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Generate a shareable profile link
      // In production, this would be a deep link or web URL
      const profileUrl = `https://mazal.app/profile/${user?.id}`;
      const message = `Check out ${user?.first_name || 'my'}'s profile on Mazal - the Jewish dating app!`;

      const result = await Share.share({
        message: `${message}\n\n${profileUrl}`,
        title: `${user?.first_name || 'User'}'s Mazal Profile`,
        url: profileUrl, // iOS only
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type of result.activityType
          console.log('Shared via:', result.activityType);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not share profile. Please try again.');
    }
  };

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
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Preview</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color={colors.primary.gold} />
          </Pressable>
          <Pressable style={styles.editButton} onPress={() => router.push('/profile/edit')}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.gold} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.card}>
            {/* Photo */}
            {profileData?.photos && profileData.photos.length > 0 ? (
              <Image
                source={{ uri: profileData.photos[0].photo_url }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: theme.colors.surface }]}>
                <Ionicons name="person" size={80} color={colors.neutral[300]} />
              </View>
            )}

            {/* Info Overlay */}
            <View style={styles.infoOverlay}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>
                  {profileData?.first_name || user?.first_name || 'Your Name'}, {calculateAge(profileData?.date_of_birth || user?.date_of_birth)}
                </Text>
                {(profileData?.is_verified || user?.is_verified) && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
                )}
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="location" size={14} color={colors.primary.white} />
                <Text style={styles.detail}>{profileData?.current_city || user?.current_city || 'Your City'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="briefcase" size={14} color={colors.primary.white} />
                <Text style={styles.detail}>{profileData?.occupation || user?.occupation || 'Your Job'}</Text>
              </View>
            </View>
          </View>

          {/* Additional Photos */}
          {profileData?.photos && profileData.photos.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoGallery}
              contentContainerStyle={styles.photoGalleryContent}
            >
              {profileData.photos.slice(1).map((photo: any, index: number) => (
                <Image
                  key={photo.id || index}
                  source={{ uri: photo.photo_url }}
                  style={styles.galleryPhoto}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          )}

          {/* Bio Section */}
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About Me</Text>
            <Text style={[styles.bio, { color: theme.colors.textSecondary }]}>
              {profileData?.bio || user?.bio || 'Your bio will appear here. Tell potential matches about yourself!'}
            </Text>
          </View>

          {/* Jewish Identity */}
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Jewish Identity</Text>
            <View style={styles.badges}>
              {/* Jewish Background */}
              <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                <Text style={styles.badgeEmoji}>✡️</Text>
                <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                  {jewishBackgroundLabel(
                    profileData?.jewish_background || user?.jewish_background
                  ) || 'Jewish'}
                </Text>
              </View>
              {/* Observance Level */}
              {(profileData?.observance_level || user?.observance_level) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>📿</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    {observanceLevelLabel(
                      profileData?.observance_level || user?.observance_level
                    )}
                  </Text>
                </View>
              )}
              {/* Shabbat */}
              {(profileData?.keeps_shabbat || user?.keeps_shabbat) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>🕯️</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    Shabbat:{' '}
                    {shabbatObservanceLabel(
                      profileData?.keeps_shabbat || user?.keeps_shabbat
                    )}
                  </Text>
                </View>
              )}
              {/* Kosher */}
              {(profileData?.keeps_kosher || user?.keeps_kosher) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>🍽️</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    Kosher:{' '}
                    {kosherLevelLabel(profileData?.keeps_kosher || user?.keeps_kosher)}
                  </Text>
                </View>
              )}
              {/* Synagogue Attendance */}
              {(profileData?.synagogue_attendance || user?.synagogue_attendance) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>🕍</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    Shul:{' '}
                    {synagogueAttendanceLabel(
                      profileData?.synagogue_attendance || user?.synagogue_attendance
                    )}
                  </Text>
                </View>
              )}
              {/* Jewish Education */}
              {(profileData?.jewish_education || user?.jewish_education) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>📚</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    {jewishEducationLabel(
                      profileData?.jewish_education || user?.jewish_education
                    )}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Relationship Goals */}
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Looking For</Text>
            <View style={styles.badges}>
              {(profileData?.looking_for || user?.looking_for) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>💕</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    {lookingForLabel(profileData?.looking_for || user?.looking_for)}
                  </Text>
                </View>
              )}
              {(profileData?.wants_children || user?.wants_children) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>👶</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    Kids:{' '}
                    {wantsChildrenLabel(
                      profileData?.wants_children || user?.wants_children
                    )}
                  </Text>
                </View>
              )}
              {(profileData?.partner_must_be_jewish ?? user?.partner_must_be_jewish) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>✡️</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    Jewish Partner Required
                  </Text>
                </View>
              )}
              {(profileData?.raise_children_jewish ?? user?.raise_children_jewish) && (
                <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.badgeEmoji}>👨‍👩‍👧</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    Raise Jewish Kids
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Prompts */}
          {profileData?.prompts && profileData.prompts.length > 0 ? (
            profileData.prompts.map((prompt: any, index: number) => (
              <View key={prompt.id || index} style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.promptQuestion, { color: theme.colors.textSecondary }]}>
                  {getPromptText(prompt.prompt_id)}
                </Text>
                <Text style={[styles.promptAnswer, { color: theme.colors.text }]}>
                  {prompt.answer}
                </Text>
              </View>
            ))
          ) : (
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.promptQuestion, { color: theme.colors.textSecondary }]}>
                No prompts added yet
              </Text>
              <Text style={[styles.promptAnswer, { color: theme.colors.text }]}>
                Add prompts to let potential matches know more about you!
              </Text>
            </View>
          )}

          {/* Tip */}
          <View style={[styles.tipCard, { backgroundColor: colors.transparent.gold20 }]}>
            <Ionicons name="bulb" size={20} color={colors.primary.gold} />
            <Text style={[styles.tipText, { color: theme.colors.text }]}>
              This is how others see your profile. Add more photos and prompts to stand out!
            </Text>
          </View>
        </ScrollView>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  shareButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: spacing[2],
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: spacing[4],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: width - spacing[8],
  },
  photoPlaceholder: {
    width: '100%',
    height: width - spacing[8],
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoGallery: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  photoGalleryContent: {
    gap: spacing[2],
  },
  galleryPhoto: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[4],
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[0.5],
  },
  detail: {
    fontSize: 14,
    color: colors.primary.white,
  },
  section: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  promptQuestion: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing[2],
  },
  promptAnswer: {
    fontSize: 16,
    lineHeight: 24,
  },
  tipCard: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[3],
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
