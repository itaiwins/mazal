/**
 * My Profiles Tab
 *
 * Shows all profiles created by this account (for parents/grandparents/shadchanim)
 * Allows creating new profiles and managing existing ones
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useShidduchOnboardingStore } from '@/stores/shidduchOnboardingStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface ManagedProfile {
  id: string;
  user_id: string;
  hebrew_name: string | null;
  community: string | null;
  profile_visible: boolean;
  accepting_suggestions: boolean;
  created_at: string;
  updated_at: string;
  // User info from join
  first_name: string | null;
  last_name: string | null;
}

interface ProfileStats {
  profileViews: number;
  suggestionsReceived: number;
  interestedResponses: number;
  mutualMatches: number;
  lastActive: string | null;
}

const COMMUNITY_LABELS: Record<string, string> = {
  modern_orthodox: 'Modern Orthodox',
  yeshivish: 'Yeshivish',
  chassidish: 'Chassidish',
  litvish: 'Litvish',
  sephardic: 'Sephardic',
  chabad: 'Chabad',
  other: 'Other',
};

// Creator type labels removed until migration is applied

export default function MyProfilesScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { reset: resetOnboarding } = useShidduchOnboardingStore();

  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ManagedProfile | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadProfiles = async () => {
    if (!session?.user?.id) return;

    try {
      // Get user's internal ID
      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) {
        console.log('No user data found');
        setLoading(false);
        return;
      }

      // Get profiles for this user - using left join to handle cases where user join fails
      const { data: profilesData, error } = await supabase
        .from('shidduch_profiles')
        .select(`
          id,
          user_id,
          hebrew_name,
          community,
          profile_visible,
          accepting_suggestions,
          created_at,
          updated_at
        `)
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading profiles:', error);
        setLoading(false);
        return;
      }

      console.log('Found profiles:', profilesData?.length || 0);

      // Use the user data we already have since these are self-created profiles
      const transformedProfiles = (profilesData || []).map((profile: any) => ({
        ...profile,
        first_name: userData.first_name || null,
        last_name: userData.last_name || null,
      }));

      setProfiles(transformedProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfiles();
    }, [session?.user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProfiles();
  };

  const handleCreateNew = () => {
    resetOnboarding();
    router.push('/(shidduch-onboarding)/welcome');
  };

  const handleEditProfile = (profile: ManagedProfile) => {
    // Navigate to profile editing - go through onboarding sections
    Alert.alert(
      'Edit Profile',
      'Which section would you like to edit?',
      [
        {
          text: 'Personal Details',
          onPress: () => router.push('/(shidduch-onboarding)/basics'),
        },
        {
          text: 'Family Background',
          onPress: () => router.push('/(shidduch-onboarding)/family'),
        },
        {
          text: 'Religious Outlook',
          onPress: () => router.push('/(shidduch-onboarding)/hashkafa'),
        },
        {
          text: 'What Looking For',
          onPress: () => router.push('/(shidduch-onboarding)/looking-for'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleViewStats = async (profile: ManagedProfile) => {
    setSelectedProfile(profile);
    setShowStatsModal(true);
    setLoadingStats(true);

    try {
      // Use the database function to get comprehensive stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_profile_stats', { p_profile_id: profile.id });

      if (statsError) {
        console.error('Error calling get_profile_stats:', statsError);
        // Fall back to manual queries if function doesn't exist yet
        const { count: suggestionsCount } = await supabase
          .from('shidduch_suggestions')
          .select('*', { count: 'exact', head: true })
          .or(`profile_a_id.eq.${profile.id},profile_b_id.eq.${profile.id}`);

        const { count: matchesCount } = await supabase
          .from('shidduch_suggestions')
          .select('*', { count: 'exact', head: true })
          .or(`profile_a_id.eq.${profile.id},profile_b_id.eq.${profile.id}`)
          .eq('profile_a_status', 'interested')
          .eq('profile_b_status', 'interested');

        // Get profile views count directly from the views table
        const { count: viewsCount } = await supabase
          .from('shidduch_profile_views')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', profile.id);

        // Get unique viewers count
        const { data: uniqueViewers } = await supabase
          .from('shidduch_profile_views')
          .select('viewer_profile_id')
          .eq('profile_id', profile.id)
          .not('viewer_profile_id', 'is', null);

        const uniqueViewerCount = new Set(uniqueViewers?.map(v => v.viewer_profile_id) || []).size;

        setProfileStats({
          profileViews: viewsCount || 0,
          suggestionsReceived: suggestionsCount || 0,
          interestedResponses: uniqueViewerCount, // Using unique viewers as "interested"
          mutualMatches: matchesCount || 0,
          lastActive: profile.updated_at,
        });
      } else if (statsData && statsData.length > 0) {
        // Use the data from the database function
        const stats = statsData[0];
        setProfileStats({
          profileViews: Number(stats.profile_views) || 0,
          suggestionsReceived: Number(stats.suggestions_received) || 0,
          interestedResponses: Number(stats.interested_responses) || 0,
          mutualMatches: Number(stats.mutual_matches) || 0,
          lastActive: stats.last_view_at || profile.updated_at,
        });
      } else {
        // No data returned
        setProfileStats({
          profileViews: 0,
          suggestionsReceived: 0,
          interestedResponses: 0,
          mutualMatches: 0,
          lastActive: profile.updated_at,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setProfileStats({
        profileViews: 0,
        suggestionsReceived: 0,
        interestedResponses: 0,
        mutualMatches: 0,
        lastActive: profile.updated_at,
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const toggleProfileVisibility = async (profile: ManagedProfile) => {
    try {
      const newVisibility = !profile.profile_visible;
      const { error } = await supabase
        .from('shidduch_profiles')
        .update({ profile_visible: newVisibility })
        .eq('id', profile.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, profile_visible: newVisibility } : p
        )
      );
    } catch (error) {
      console.error('Error toggling visibility:', error);
      Alert.alert('Error', 'Failed to update profile visibility');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderProfileCard = (profile: ManagedProfile, index: number) => {
    const name = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(' ') || 'Unnamed Profile';
    const community = profile.community
      ? COMMUNITY_LABELS[profile.community] || profile.community
      : 'Not specified';

    return (
      <Animated.View
        key={profile.id}
        entering={FadeInDown.delay(index * 100)}
        style={styles.profileCard}
      >
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Text style={styles.avatarText}>
              {(profile.first_name || 'P').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{name}</Text>
            {profile.hebrew_name && (
              <Text style={styles.profileHebrew}>{profile.hebrew_name}</Text>
            )}
            <View style={styles.profileMeta}>
              <Text style={styles.profileCommunity}>{community}</Text>
              <View style={styles.metaDot} />
              <Text style={styles.profileCreator}>Created by you</Text>
            </View>
            <Text style={styles.profileDate}>
              Created {formatDate(profile.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.profileStatus}>
          <View
            style={[
              styles.statusBadge,
              profile.profile_visible ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                profile.profile_visible ? styles.dotActive : styles.dotInactive,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                profile.profile_visible ? styles.statusTextActive : styles.statusTextInactive,
              ]}
            >
              {profile.profile_visible ? 'Active' : 'Hidden'}
            </Text>
          </View>
          {profile.accepting_suggestions && profile.profile_visible && (
            <View style={styles.acceptingBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary.gold} />
              <Text style={styles.acceptingText}>Accepting Suggestions</Text>
            </View>
          )}
        </View>

        <View style={styles.profileActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleEditProfile(profile)}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.primary.white} />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => toggleProfileVisibility(profile)}
          >
            <Ionicons
              name={profile.profile_visible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.primary.white}
            />
            <Text style={styles.actionText}>
              {profile.profile_visible ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleViewStats(profile)}
          >
            <Ionicons name="stats-chart-outline" size={18} color={colors.primary.white} />
            <Text style={styles.actionText}>Stats</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0a1628']}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={styles.hebrewTitle}>הפרופילים שלי</Text>
        <Text style={styles.title}>My Profiles</Text>
        <Text style={styles.subtitle}>
          Manage profiles you've created for singles
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.gold} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.gold}
            />
          }
        >
          {/* Create New Button */}
          <Animated.View entering={FadeIn.delay(100)}>
            <Pressable style={styles.createButton} onPress={handleCreateNew}>
              <LinearGradient
                colors={[colors.primary.gold, '#f4d47c', colors.primary.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createButtonGradient}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.primary.navy} />
                <Text style={styles.createButtonText}>Create New Profile</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Profile Count */}
          <Animated.View entering={FadeIn.delay(200)} style={styles.countContainer}>
            <Text style={styles.countText}>
              {profiles.length} {profiles.length === 1 ? 'Profile' : 'Profiles'}
            </Text>
          </Animated.View>

          {/* Profiles List */}
          {profiles.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={48} color={colors.primary.gold} />
              </View>
              <Text style={styles.emptyTitle}>No Profiles Yet</Text>
              <Text style={styles.emptyText}>
                Create your first profile for a single you want to help find their bashert.
              </Text>
            </Animated.View>
          ) : (
            <View style={styles.profilesList}>
              {profiles.map((profile, index) => renderProfileCard(profile, index))}
            </View>
          )}

          {/* Info Note */}
          <Animated.View entering={FadeInDown.delay(400)} style={styles.infoNote}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.transparent.gold70}
            />
            <Text style={styles.infoNoteText}>
              Each profile represents a single person you're helping to find a match.
              You can manage multiple profiles from this account.
            </Text>
          </Animated.View>
        </ScrollView>
      )}

      {/* Stats Modal */}
      <Modal visible={showStatsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Stats</Text>
              <Pressable onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            {selectedProfile && (
              <View style={styles.statsProfileInfo}>
                <View style={styles.statsAvatar}>
                  <Text style={styles.statsAvatarText}>
                    {(selectedProfile.first_name || 'P').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.statsProfileName}>
                    {[selectedProfile.first_name, selectedProfile.last_name]
                      .filter(Boolean)
                      .join(' ') || 'Unnamed Profile'}
                  </Text>
                  {selectedProfile.hebrew_name && (
                    <Text style={styles.statsProfileHebrew}>{selectedProfile.hebrew_name}</Text>
                  )}
                </View>
              </View>
            )}

            {loadingStats ? (
              <View style={styles.statsLoading}>
                <ActivityIndicator size="large" color={colors.primary.gold} />
                <Text style={styles.statsLoadingText}>Loading stats...</Text>
              </View>
            ) : profileStats ? (
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Ionicons name="eye-outline" size={24} color={colors.primary.gold} />
                  <Text style={styles.statNumber}>{profileStats.profileViews}</Text>
                  <Text style={styles.statLabel}>Profile Views</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="people-outline" size={24} color={colors.primary.gold} />
                  <Text style={styles.statNumber}>{profileStats.suggestionsReceived}</Text>
                  <Text style={styles.statLabel}>Suggestions</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="heart-outline" size={24} color={colors.primary.gold} />
                  <Text style={styles.statNumber}>{profileStats.interestedResponses}</Text>
                  <Text style={styles.statLabel}>Interested</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="checkmark-circle-outline" size={24} color={colors.primary.gold} />
                  <Text style={styles.statNumber}>{profileStats.mutualMatches}</Text>
                  <Text style={styles.statLabel}>Matches</Text>
                </View>
              </View>
            ) : null}

            {profileStats?.lastActive && (
              <View style={styles.lastActiveRow}>
                <Ionicons name="time-outline" size={16} color={colors.transparent.white50} />
                <Text style={styles.lastActiveText}>
                  Last updated: {formatDate(profileStats.lastActive)}
                </Text>
              </View>
            )}

            <Pressable
              style={styles.closeStatsButton}
              onPress={() => setShowStatsModal(false)}
            >
              <Text style={styles.closeStatsText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    alignItems: 'center',
  },
  hebrewTitle: {
    fontSize: 24,
    color: colors.primary.gold,
    marginBottom: spacing[1],
    letterSpacing: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: 14,
    color: colors.transparent.white60,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
  },
  createButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing[4],
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  countContainer: {
    marginBottom: spacing[4],
  },
  countText: {
    fontSize: 14,
    color: colors.transparent.white50,
  },
  profilesList: {
    gap: spacing[4],
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: spacing[4],
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: spacing[3],
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[0.5],
  },
  profileHebrew: {
    fontSize: 14,
    color: colors.primary.gold,
    marginBottom: spacing[1],
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCommunity: {
    fontSize: 12,
    color: colors.transparent.white50,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.transparent.white30,
    marginHorizontal: spacing[2],
  },
  profileCreator: {
    fontSize: 12,
    color: colors.transparent.white50,
  },
  profileDate: {
    fontSize: 11,
    color: colors.transparent.white30,
    marginTop: 4,
  },
  profileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  statusActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  statusInactive: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#22c55e',
  },
  dotInactive: {
    backgroundColor: '#9ca3af',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#22c55e',
  },
  statusTextInactive: {
    color: '#9ca3af',
  },
  acceptingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  acceptingText: {
    fontSize: 12,
    color: colors.primary.gold,
  },
  profileActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.1)',
    paddingTop: spacing[3],
    gap: spacing[2],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    gap: spacing[1],
  },
  actionText: {
    fontSize: 13,
    color: colors.primary.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: 14,
    color: colors.transparent.white60,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing[4],
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    color: colors.transparent.gold70,
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a2744',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 14,
  },
  statsAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  statsProfileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsProfileHebrew: {
    fontSize: 14,
    color: colors.primary.gold,
    marginTop: 2,
  },
  statsLoading: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  statsLoadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    textAlign: 'center',
  },
  lastActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  lastActiveText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  closeStatsButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  closeStatsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
