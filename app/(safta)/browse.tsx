/**
 * Safta Browse
 *
 * Grandparents can browse ALL profiles and send recommendations
 * Can use grandchild's filters or set their own search criteria
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/api/supabase/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Profile type for browse
type BrowseProfile = {
  id: string;
  name: string;
  age: number;
  occupation: string;
  jewish_background: string;
  location: string;
  distance: number;
  photos: string[];
  prompts: { question: string; answer: string }[];
};

// Empty arrays - will be populated from Supabase when implemented

const JEWISH_BACKGROUNDS = [
  'Reform',
  'Conservative',
  'Modern Orthodox',
  'Orthodox',
  'Reconstructionist',
  'Just Jewish',
];

export default function SaftaBrowseScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);
  const logout = useAuthStore((s) => s.logout);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Custom filter state (when not using grandchild's preferences)
  const [customMinAge, setCustomMinAge] = useState(25);
  const [customMaxAge, setCustomMaxAge] = useState(35);
  const [customMaxDistance, setCustomMaxDistance] = useState(50);
  const [customBackgrounds, setCustomBackgrounds] = useState<string[]>(JEWISH_BACKGROUNDS);

  // Profile browsing state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [recommendNote, setRecommendNote] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Profiles - empty until fetched from Supabase
  const [profiles, setProfiles] = useState<BrowseProfile[]>([]);

  // Filter profiles based on current filter settings
  const filteredProfiles = useMemo(() => {
    const filters = {
      minAge: customMinAge,
      maxAge: customMaxAge,
      maxDistance: customMaxDistance,
      jewishBackgrounds: customBackgrounds,
    };

    return profiles.filter((profile) => {
      const ageMatch = profile.age >= filters.minAge && profile.age <= filters.maxAge;
      const distanceMatch = profile.distance <= filters.maxDistance;
      const backgroundMatch = filters.jewishBackgrounds.includes(profile.jewish_background);
      return ageMatch && distanceMatch && backgroundMatch;
    });
  }, [profiles, customMinAge, customMaxAge, customMaxDistance, customBackgrounds]);

  const currentProfile = filteredProfiles[currentIndex];

  const toggleBackground = (bg: string) => {
    setCustomBackgrounds((prev) =>
      prev.includes(bg) ? prev.filter((b) => b !== bg) : [...prev, bg]
    );
  };

  const handleRecommend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProfileId(currentProfile.id);
    setShowRecommendModal(true);
  };

  const handleSendRecommendation = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // In production, this would send the recommendation to Supabase
    console.log('Recommending profile:', selectedProfileId, 'with note:', recommendNote);
    setShowRecommendModal(false);
    setRecommendNote('');

    // Move to next profile
    if (currentIndex < filteredProfiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentIndex < filteredProfiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleOpenFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilterModal(true);
  };

  const handleApplyFilters = () => {
    setCurrentIndex(0); // Reset to first profile when filters change
    setShowFilterModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleBack = () => {
    router.back();
  };

  const handleSwitchToUserMode = () => {
    setShowSettingsModal(false);
    if (isOnboardingComplete) {
      // User has completed regular onboarding, go to tabs
      setCurrentMode('user');
      router.replace('/(tabs)');
    } else {
      // User needs to complete regular onboarding first
      setCurrentMode('user');
      router.replace('/(onboarding)/welcome');
    }
  };

  const handleLogout = async () => {
    setShowSettingsModal(false);
    await supabase.auth.signOut();
    logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.menuButton} onPress={() => setShowSettingsModal(true)}>
          <Ionicons name="menu" size={28} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Browse for Sarah
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {filteredProfiles.length > 0 ? `${currentIndex + 1} of ${filteredProfiles.length}` : 'No matches'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.filterButton} onPress={handleOpenFilters}>
            <Ionicons name="options" size={22} color={colors.primary.gold} />
          </Pressable>
          <Pressable
            style={styles.likesButton}
            onPress={() => router.push('/(safta)/likes')}
          >
            <Ionicons name="heart" size={22} color={colors.primary.gold} />
          </Pressable>
        </View>
      </View>

      {/* Filter Mode Indicator */}
      <View style={[styles.filterIndicator, { backgroundColor: theme.colors.surface }]}>
        <Ionicons
          name="options"
          size={16}
          color={colors.primary.gold}
        />
        <Text style={[styles.filterIndicatorText, { color: theme.colors.textSecondary }]}>
          Using your custom filters
        </Text>
        <Pressable onPress={handleOpenFilters}>
          <Text style={[styles.changeFilterText, { color: colors.primary.gold }]}>Edit</Text>
        </Pressable>
      </View>

      {currentProfile ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing[4] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <Animated.View
            key={currentProfile.id}
            entering={SlideInRight.springify().damping(15)}
            style={[styles.profileCard, { backgroundColor: theme.colors.surface }]}
          >
            <Image
              source={{ uri: currentProfile.photos[0] }}
              style={styles.profileImage}
              contentFit="cover"
            />

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {currentProfile.name}, {currentProfile.age}
                </Text>
              </View>
              <Text style={[styles.occupation, { color: theme.colors.textSecondary }]}>
                {currentProfile.occupation}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  ✡️ {currentProfile.jewish_background}
                </Text>
              </View>
            </View>

            {/* Prompts */}
            {currentProfile.prompts.map((prompt, index) => (
              <View key={index} style={styles.promptCard}>
                <Text style={[styles.promptQuestion, { color: theme.colors.textSecondary }]}>
                  {prompt.question}
                </Text>
                <Text style={[styles.promptAnswer, { color: theme.colors.text }]}>
                  {prompt.answer}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Info Note */}
          <View style={[styles.infoNote, { backgroundColor: colors.transparent.gold20 }]}>
            <Ionicons name="information-circle" size={18} color={colors.primary.gold} />
            <Text style={[styles.infoNoteText, { color: theme.colors.text }]}>
              Send this profile to Sarah with a personal note about why you think they'd be a great match!
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.skipButton, { borderColor: colors.neutral[300] }]}
              onPress={handleSkip}
            >
              <Ionicons name="close" size={28} color={colors.neutral[500]} />
            </Pressable>
            <Pressable style={styles.recommendButton} onPress={handleRecommend}>
              <Ionicons name="heart" size={28} color={colors.primary.navy} />
              <Text style={styles.recommendButtonText}>Recommend</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👀</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No more profiles
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Check back later for more profiles to review
          </Text>
        </View>
      )}

      {/* Recommend Modal */}
      <Modal
        visible={showRecommendModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRecommendModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Add a Note
            </Text>
            <Pressable
              style={styles.modalClose}
              onPress={() => setShowRecommendModal(false)}
            >
              <Ionicons name="close" size={24} color={theme.colors.icon} />
            </Pressable>
          </View>

          <View style={styles.modalContent}>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Tell Sarah why you think {currentProfile?.name} could be a good match
            </Text>

            <TextInput
              style={[
                styles.noteInput,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                },
              ]}
              placeholder="e.g., He reminds me of your grandfather when he was young..."
              placeholderTextColor={theme.colors.textTertiary}
              value={recommendNote}
              onChangeText={setRecommendNote}
              multiline
              maxLength={200}
            />

            <Text style={[styles.charCount, { color: theme.colors.textTertiary }]}>
              {recommendNote.length}/200
            </Text>
          </View>

          <View style={styles.modalFooter}>
            <Pressable
              style={styles.sendButton}
              onPress={handleSendRecommendation}
            >
              <Ionicons name="heart" size={20} color={colors.primary.navy} />
              <Text style={styles.sendButtonText}>Send Recommendation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Search Filters
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: spacing[8] }}
          >
            <View>
                {/* Age Range */}
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterGroupTitle, { color: theme.colors.text }]}>
                    Age Range
                  </Text>
                  <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.stepperRow}>
                      <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>
                        Minimum Age
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMinAge(Math.max(18, customMinAge - 1))}
                        >
                          <Ionicons name="remove" size={20} color={colors.primary.navy} />
                        </Pressable>
                        <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                          {customMinAge}
                        </Text>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMinAge(Math.min(customMaxAge - 1, customMinAge + 1))}
                        >
                          <Ionicons name="add" size={20} color={colors.primary.navy} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.stepperRow}>
                      <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>
                        Maximum Age
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxAge(Math.max(customMinAge + 1, customMaxAge - 1))}
                        >
                          <Ionicons name="remove" size={20} color={colors.primary.navy} />
                        </Pressable>
                        <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                          {customMaxAge}
                        </Text>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxAge(Math.min(80, customMaxAge + 1))}
                        >
                          <Ionicons name="add" size={20} color={colors.primary.navy} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Distance */}
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterGroupTitle, { color: theme.colors.text }]}>
                    Maximum Distance
                  </Text>
                  <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.stepperRow}>
                      <Text style={[styles.stepperLabel, { color: theme.colors.text }]}>
                        Miles
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxDistance(Math.max(5, customMaxDistance - 5))}
                        >
                          <Ionicons name="remove" size={20} color={colors.primary.navy} />
                        </Pressable>
                        <Text style={[styles.stepperValue, { color: theme.colors.text }]}>
                          {customMaxDistance}
                        </Text>
                        <Pressable
                          style={[styles.stepperButton, { backgroundColor: colors.neutral[200] }]}
                          onPress={() => setCustomMaxDistance(Math.min(500, customMaxDistance + 5))}
                        >
                          <Ionicons name="add" size={20} color={colors.primary.navy} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Jewish Background */}
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterGroupTitle, { color: theme.colors.text }]}>
                    Jewish Background
                  </Text>
                  <View style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
                    {JEWISH_BACKGROUNDS.map((bg) => (
                      <Pressable
                        key={bg}
                        style={styles.backgroundOption}
                        onPress={() => toggleBackground(bg)}
                      >
                        <Text style={[styles.backgroundLabel, { color: theme.colors.text }]}>
                          {bg}
                        </Text>
                        <Ionicons
                          name={customBackgrounds.includes(bg) ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={customBackgrounds.includes(bg) ? colors.primary.gold : colors.neutral[400]}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.applyButton} onPress={handleApplyFilters}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowSettingsModal(false)}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Safta Settings
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.settingsModalContent}>
            {/* Switch to User Mode */}
            <Pressable
              style={styles.settingsOption}
              onPress={handleSwitchToUserMode}
            >
              <View style={styles.settingsOptionIcon}>
                <Ionicons name="heart" size={24} color={colors.primary.gold} />
              </View>
              <View style={styles.settingsOptionText}>
                <Text style={[styles.settingsOptionTitle, { color: theme.colors.text }]}>
                  Switch to Dating Mode
                </Text>
                <Text style={[styles.settingsOptionDesc, { color: theme.colors.textSecondary }]}>
                  {isOnboardingComplete
                    ? 'Browse profiles for yourself'
                    : 'Set up your dating profile'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.neutral[400]} />
            </Pressable>

            {/* Divider */}
            <View style={[styles.settingsDivider, { backgroundColor: colors.neutral[100] }]} />

            {/* Logout */}
            <Pressable
              style={styles.settingsOption}
              onPress={handleLogout}
            >
              <View style={[styles.settingsOptionIcon, { backgroundColor: colors.transparent.white10 }]}>
                <Ionicons name="log-out-outline" size={24} color={colors.semantic.error} />
              </View>
              <View style={styles.settingsOptionText}>
                <Text style={[styles.settingsOptionTitle, { color: colors.semantic.error }]}>
                  Log Out
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Safta badge */}
          <View style={styles.saftaBadge}>
            <Text style={styles.saftaBadgeEmoji}>👵👴</Text>
            <Text style={[styles.saftaBadgeText, { color: theme.colors.textSecondary }]}>
              You're in Safta Mode
            </Text>
          </View>
        </View>
      </Modal>
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
    height: 56,
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
  likesButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
  },
  profileCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  profileImage: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  profileInfo: {
    padding: spacing[4],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  occupation: {
    fontSize: 15,
    marginBottom: spacing[2],
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary.cream,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 13,
    color: colors.primary.navy,
    fontWeight: '500',
  },
  promptCard: {
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  promptQuestion: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  promptAnswer: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoNote: {
    flexDirection: 'row',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[4],
    paddingTop: spacing[2],
  },
  skipButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  recommendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
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
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  modalSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing[4],
  },
  noteInput: {
    fontSize: 16,
    lineHeight: 24,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: spacing[2],
  },
  modalFooter: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  // New styles for filter functionality
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    gap: spacing[2],
  },
  filterIndicatorText: {
    fontSize: 13,
    flex: 1,
  },
  changeFilterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterSection: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  filterToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  filterToggleText: {
    flex: 1,
  },
  filterToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterToggleDesc: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },
  filterGroup: {
    marginBottom: spacing[4],
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  filterCard: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  stepperLabel: {
    fontSize: 16,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  backgroundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backgroundLabel: {
    fontSize: 16,
  },
  preferencesPreview: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
  },
  preferencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  preferencesDetail: {
    fontSize: 14,
    marginBottom: spacing[1],
  },
  applyButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  // Settings Modal styles
  settingsModalContent: {
    padding: spacing[4],
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    gap: spacing[4],
  },
  settingsOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsOptionText: {
    flex: 1,
  },
  settingsOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  settingsOptionDesc: {
    fontSize: 14,
    marginTop: spacing[0.5],
  },
  settingsDivider: {
    height: 1,
    marginVertical: spacing[2],
  },
  saftaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: 'auto',
    paddingVertical: spacing[6],
  },
  saftaBadgeEmoji: {
    fontSize: 24,
  },
  saftaBadgeText: {
    fontSize: 14,
  },
});
