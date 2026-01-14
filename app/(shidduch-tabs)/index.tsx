/**
 * Shidduch Suggestions Screen
 *
 * AI-powered suggestions combined with manual shadchan suggestions
 * Users receive matches based on compatibility scoring
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { getAIRecommendations, type MatchSuggestion, type CompatibilityScore } from '@/services/matchingService';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface Suggestion {
  id: string;
  firstName: string;
  hebrewName?: string;
  age: number | null;
  community: string;
  city: string;
  source: 'algorithm' | 'shadchan';
  sourceName?: string;
  score: number;
  reasons: string[];
  status: 'pending' | 'interested' | 'declined' | 'thinking';
  photoVisible: boolean;
  photoUrl: string | null;
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

const COMMUNITIES = [
  { value: 'modern_orthodox', label: 'Modern Orthodox' },
  { value: 'yeshivish', label: 'Yeshivish' },
  { value: 'chassidish', label: 'Chassidish' },
  { value: 'litvish', label: 'Litvish' },
  { value: 'sephardic', label: 'Sephardic' },
  { value: 'chabad', label: 'Chabad' },
];

const HASHKAFOT = [
  { value: 'machmir', label: 'Machmir' },
  { value: 'middle', label: 'Middle of the Road' },
  { value: 'modern', label: 'Modern' },
  { value: 'open', label: 'Open-Minded' },
];

interface Filters {
  communities: string[];
  hashkafot: string[];
  minAge: number;
  maxAge: number;
  minScore: number;
  aiOnly: boolean;
  shadchanOnly: boolean;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onRespond: (id: string, response: 'interested' | 'declined' | 'thinking') => void;
  onViewProfile: (profileId: string) => void;
  delay: number;
}

function SuggestionCard({ suggestion, onRespond, onViewProfile, delay }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);

  const handleExpandToggle = () => {
    if (!expanded && !viewTracked) {
      // Track view when expanding for the first time
      onViewProfile(suggestion.id);
      setViewTracked(true);
    }
    setExpanded(!expanded);
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.suggestionCard}>
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.1)', 'rgba(212, 175, 55, 0.03)']}
        style={styles.cardGradient}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {suggestion.photoVisible && suggestion.photoUrl ? (
              <Image source={{ uri: suggestion.photoUrl }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person-outline" size={28} color="#d4af37" />
              </View>
            )}
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.cardName}>
                  {suggestion.firstName}{suggestion.age ? `, ${suggestion.age}` : ''}
                </Text>
                {suggestion.hebrewName && (
                  <Text style={styles.hebrewName}>{suggestion.hebrewName}</Text>
                )}
              </View>
              <Text style={styles.cardCommunity}>{suggestion.community}</Text>
              <Text style={styles.cardCity}>{suggestion.city}</Text>
            </View>
          </View>

          {/* Score Badge */}
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreNumber}>{suggestion.score}%</Text>
            <Text style={styles.scoreLabel}>Match</Text>
          </View>
        </View>

        {/* Source Info */}
        <View style={styles.sourceRow}>
          <View style={styles.sourceIcon}>
            <Ionicons
              name={suggestion.source === 'algorithm' ? 'sparkles' : 'people'}
              size={14}
              color="#d4af37"
            />
          </View>
          <Text style={styles.sourceText}>
            {suggestion.source === 'algorithm' ? (
              <>Suggested by <Text style={styles.sourceName}>AI Algorithm</Text></>
            ) : (
              <>Suggested by <Text style={styles.sourceName}>{suggestion.sourceName}</Text></>
            )}
          </Text>
        </View>

        {/* Match Reasons */}
        {suggestion.reasons.length > 0 && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Why this match:</Text>
            {suggestion.reasons.slice(0, 3).map((reason, index) => (
              <View key={index} style={styles.reasonItem}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary.gold} />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Status or Actions */}
        {suggestion.status === 'pending' ? (
          <View style={styles.actionRow}>
            <Pressable
              style={styles.declineButton}
              onPress={() => onRespond(suggestion.id, 'declined')}
            >
              <Text style={styles.declineText}>Not for Me</Text>
            </Pressable>

            <Pressable
              style={styles.thinkingButton}
              onPress={() => onRespond(suggestion.id, 'thinking')}
            >
              <Text style={styles.thinkingText}>Thinking</Text>
            </Pressable>

            <Pressable
              style={styles.interestedButton}
              onPress={() => onRespond(suggestion.id, 'interested')}
            >
              <LinearGradient
                colors={['#d4af37', '#f4d47c', '#d4af37']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.interestedGradient}
              >
                <Text style={styles.interestedText}>Interested</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statusRow}>
            <View style={[
              styles.statusBadge,
              suggestion.status === 'interested' && styles.statusInterested,
              suggestion.status === 'declined' && styles.statusDeclined,
              suggestion.status === 'thinking' && styles.statusThinking,
            ]}>
              <Ionicons
                name={
                  suggestion.status === 'interested' ? 'heart' :
                  suggestion.status === 'declined' ? 'close-circle' : 'time'
                }
                size={14}
                color={
                  suggestion.status === 'interested' ? colors.primary.navy :
                  suggestion.status === 'declined' ? '#ff6b6b' : colors.primary.white
                }
              />
              <Text style={[
                styles.statusText,
                suggestion.status === 'interested' && styles.statusTextInterested,
                suggestion.status === 'declined' && styles.statusTextDeclined,
              ]}>
                {suggestion.status === 'interested' ? 'Interested' :
                 suggestion.status === 'declined' ? 'Declined' : 'Thinking'}
              </Text>
            </View>
          </View>
        )}

        {/* View More */}
        <Pressable
          style={styles.viewMoreButton}
          onPress={handleExpandToggle}
        >
          <Text style={styles.viewMoreText}>
            {expanded ? 'Show Less' : 'View Full Profile'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="rgba(255,255,255,0.5)"
          />
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

export default function ShidduchSuggestionsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    communities: [],
    hashkafot: [],
    minAge: 18,
    maxAge: 50,
    minScore: 0,
    aiOnly: false,
    shadchanOnly: false,
  });

  const toggleCommunity = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      communities: prev.communities.includes(value)
        ? prev.communities.filter((c) => c !== value)
        : [...prev.communities, value],
    }));
  };

  const toggleHashkafa = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      hashkafot: prev.hashkafot.includes(value)
        ? prev.hashkafot.filter((h) => h !== value)
        : [...prev.hashkafot, value],
    }));
  };

  const clearFilters = () => {
    setFilters({
      communities: [],
      hashkafot: [],
      minAge: 18,
      maxAge: 50,
      minScore: 0,
      aiOnly: false,
      shadchanOnly: false,
    });
  };

  const activeFilterCount =
    filters.communities.length +
    filters.hashkafot.length +
    (filters.minScore > 0 ? 1 : 0) +
    (filters.aiOnly ? 1 : 0) +
    (filters.shadchanOnly ? 1 : 0) +
    (filters.minAge !== 18 || filters.maxAge !== 50 ? 1 : 0);

  // Record a profile view in the database
  const recordProfileView = async (viewedProfileId: string) => {
    try {
      await supabase.from('shidduch_profile_views').insert({
        profile_id: viewedProfileId,
        viewer_profile_id: profileId || null,
        viewer_user_id: currentUserId || null,
        view_source: 'suggestion',
      });
      console.log('[Suggestions] Recorded profile view for:', viewedProfileId);
    } catch (error) {
      // Don't block the UI if view tracking fails
      console.error('Error recording profile view:', error);
    }
  };

  const loadSuggestions = async () => {
    if (!session?.user?.id) return;

    try {
      // Get user's internal ID and profile
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) return;

      setCurrentUserId(userData.id);

      // Get user's shidduch profile
      const { data: profile } = await supabase
        .from('shidduch_profiles')
        .select('id')
        .eq('user_id', userData.id)
        .single();

      if (!profile) {
        setHasProfile(false);
        setLoading(false);
        return;
      }

      setProfileId(profile.id);
      setHasProfile(true);

      // Get AI recommendations
      const aiMatches = await getAIRecommendations(profile.id, 10);

      // Transform AI matches to suggestions format
      const aiSuggestions: Suggestion[] = aiMatches.map((match) => {
        const user = match.profile.users;
        const age = user?.date_of_birth
          ? Math.floor(
              (Date.now() - new Date(user.date_of_birth).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null;

        return {
          id: match.profile.id,
          firstName: user?.first_name || 'Anonymous',
          hebrewName: (match.profile as any).hebrew_name,
          age,
          community: COMMUNITY_LABELS[match.profile.community || ''] || 'Not specified',
          city: [user?.current_city, user?.current_state].filter(Boolean).join(', ') || 'Not specified',
          source: 'algorithm' as const,
          score: match.score.total,
          reasons: match.score.reasons,
          status: 'pending' as const,
          photoVisible: false,
          photoUrl: null,
        };
      });

      // Also get any manual shadchan suggestions from the database
      const { data: manualSuggestions } = await supabase
        .from('shidduch_suggestions')
        .select(`
          id,
          profile_a_status,
          compatibility_score,
          profile_b:profile_b_id(
            id,
            hebrew_name,
            community,
            users!inner(
              first_name,
              date_of_birth,
              current_city,
              current_state
            )
          ),
          suggested_by_user:suggested_by_user_id(
            first_name,
            last_name
          )
        `)
        .eq('profile_a_id', profile.id)
        .neq('suggested_by_type', 'algorithm')
        .order('created_at', { ascending: false });

      const manualSuggestionsList: Suggestion[] = (manualSuggestions || []).map((s: any) => {
        const profileB = s.profile_b;
        const user = profileB?.users;
        const age = user?.date_of_birth
          ? Math.floor(
              (Date.now() - new Date(user.date_of_birth).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null;

        return {
          id: s.id,
          firstName: user?.first_name || 'Anonymous',
          hebrewName: profileB?.hebrew_name,
          age,
          community: COMMUNITY_LABELS[profileB?.community || ''] || 'Not specified',
          city: [user?.current_city, user?.current_state].filter(Boolean).join(', ') || 'Not specified',
          source: 'shadchan' as const,
          sourceName: s.suggested_by_user
            ? `${s.suggested_by_user.first_name} ${s.suggested_by_user.last_name}`.trim()
            : 'Shadchan',
          score: s.compatibility_score || 0,
          reasons: [],
          status: s.profile_a_status || 'pending',
          photoVisible: false,
          photoUrl: null,
        };
      });

      // Combine and sort by score
      const allSuggestions = [...manualSuggestionsList, ...aiSuggestions]
        .sort((a, b) => b.score - a.score);

      setSuggestions(allSuggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadSuggestions();
      }
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSuggestions();
  }, []);

  const handleRespond = async (id: string, response: 'interested' | 'declined' | 'thinking') => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: response } : s))
    );

    // Save response to database (update profile_a_status since user is profile A)
    try {
      await supabase
        .from('shidduch_suggestions')
        .update({
          profile_a_status: response,
          profile_a_response_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (error) {
      console.error('Error saving response:', error);
    }
  };

  // Apply filters to suggestions
  const filteredSuggestions = suggestions.filter((s) => {
    // Community filter
    if (filters.communities.length > 0) {
      const communityKey = Object.entries(COMMUNITY_LABELS).find(
        ([_, label]) => label === s.community
      )?.[0];
      if (!communityKey || !filters.communities.includes(communityKey)) {
        return false;
      }
    }

    // Age filter
    if (s.age !== null) {
      if (s.age < filters.minAge || s.age > filters.maxAge) {
        return false;
      }
    }

    // Score filter
    if (filters.minScore > 0 && s.score < filters.minScore) {
      return false;
    }

    // Source filters
    if (filters.aiOnly && s.source !== 'algorithm') {
      return false;
    }
    if (filters.shadchanOnly && s.source !== 'shadchan') {
      return false;
    }

    return true;
  });

  const pendingSuggestions = filteredSuggestions.filter((s) => s.status === 'pending');
  const respondedSuggestions = filteredSuggestions.filter((s) => s.status !== 'pending');

  if (loading) {
    return (
      <LinearGradient colors={['#0a1628', '#1a2744', '#0a1628']} style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.primary.gold} />
          <Text style={styles.loadingText}>Finding your matches...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0a1628']}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d4af37"
          />
        }
      >
        {/* Header with Logo */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.logoHeader}>
          <Text style={styles.logoText}>מזל</Text>
          <Text style={styles.logoSubtext}>MAZAL</Text>
        </Animated.View>

        {/* Title Row */}
        <Animated.View entering={FadeIn.delay(150)} style={styles.header}>
          <View>
            <Text style={styles.hebrewTitle}>הצעות</Text>
            <Text style={styles.title}>Your Suggestions</Text>
          </View>
          <Pressable
            style={styles.filterButton}
            onPress={() => setShowFiltersModal(true)}
          >
            <Ionicons name="options-outline" size={22} color="#d4af37" />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pendingSuggestions.length}</Text>
            <Text style={styles.statLabel}>New</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {respondedSuggestions.filter((s) => s.status === 'interested').length}
            </Text>
            <Text style={styles.statLabel}>Interested</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="sparkles" size={20} color={colors.primary.gold} />
            <Text style={[styles.statLabel, styles.aiLabel]}>AI Powered</Text>
          </View>
        </Animated.View>

        {/* No Profile State */}
        {!hasProfile && (
          <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>✡</Text>
            </View>
            <Text style={styles.emptyTitle}>Complete Your Profile</Text>
            <Text style={styles.emptyText}>
              Create a shidduch profile to start receiving AI-powered match suggestions
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(shidduch-onboarding)/welcome')}
            >
              <Text style={styles.emptyButtonText}>Create Profile</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Empty State */}
        {hasProfile && suggestions.length === 0 && (
          <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={40} color="#d4af37" />
            </View>
            <Text style={styles.emptyTitle}>No Suggestions Yet</Text>
            <Text style={styles.emptyText}>
              Our AI is analyzing profiles to find your best matches. Check back soon!
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(shidduch-tabs)/browse')}
            >
              <Text style={styles.emptyButtonText}>Browse Profiles</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Pending Suggestions */}
        {pendingSuggestions.length > 0 && (
          <>
            <Animated.Text entering={FadeIn.delay(300)} style={styles.sectionTitle}>
              Awaiting Your Response
            </Animated.Text>
            {pendingSuggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onRespond={handleRespond}
                onViewProfile={recordProfileView}
                delay={400 + index * 100}
              />
            ))}
          </>
        )}

        {/* Responded */}
        {respondedSuggestions.length > 0 && (
          <>
            <Animated.Text entering={FadeIn.delay(600)} style={styles.sectionTitle}>
              Your Responses
            </Animated.Text>
            {respondedSuggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onRespond={handleRespond}
                onViewProfile={recordProfileView}
                delay={700 + index * 100}
              />
            ))}
          </>
        )}

        {/* How It Works */}
        <Animated.View entering={FadeInDown.delay(800)} style={styles.howItWorks}>
          <Text style={styles.howItWorksTitle}>How AI Matching Works</Text>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>1</Text>
            </View>
            <Text style={styles.howItWorksText}>
              Our algorithm analyzes community, hashkafa, preferences, and more
            </Text>
          </View>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>2</Text>
            </View>
            <Text style={styles.howItWorksText}>
              You receive suggestions with compatibility scores and reasons
            </Text>
          </View>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>3</Text>
            </View>
            <Text style={styles.howItWorksText}>
              When both sides express interest, you can connect
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Filters Modal */}
      <Modal visible={showFiltersModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Suggestions</Text>
              <Pressable onPress={() => setShowFiltersModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Community Filter */}
              <Text style={styles.filterSectionTitle}>Community</Text>
              <View style={styles.filterOptionsWrap}>
                {COMMUNITIES.map((community) => (
                  <Pressable
                    key={community.value}
                    style={[
                      styles.filterOption,
                      filters.communities.includes(community.value) && styles.filterOptionActive,
                    ]}
                    onPress={() => toggleCommunity(community.value)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filters.communities.includes(community.value) && styles.filterOptionTextActive,
                      ]}
                    >
                      {community.label}
                    </Text>
                    {filters.communities.includes(community.value) && (
                      <Ionicons name="checkmark" size={16} color="#0a1628" />
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Source Filter */}
              <Text style={styles.filterSectionTitle}>Source</Text>
              <View style={styles.filterRow}>
                <View style={styles.filterRowInfo}>
                  <Text style={styles.filterRowLabel}>AI Suggestions Only</Text>
                  <Text style={styles.filterRowDesc}>Only show AI algorithm matches</Text>
                </View>
                <Switch
                  value={filters.aiOnly}
                  onValueChange={(value) => setFilters((prev) => ({
                    ...prev,
                    aiOnly: value,
                    shadchanOnly: value ? false : prev.shadchanOnly,
                  }))}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                  thumbColor={filters.aiOnly ? '#d4af37' : '#666'}
                />
              </View>
              <View style={styles.filterRow}>
                <View style={styles.filterRowInfo}>
                  <Text style={styles.filterRowLabel}>Shadchan Only</Text>
                  <Text style={styles.filterRowDesc}>Only show shadchan suggestions</Text>
                </View>
                <Switch
                  value={filters.shadchanOnly}
                  onValueChange={(value) => setFilters((prev) => ({
                    ...prev,
                    shadchanOnly: value,
                    aiOnly: value ? false : prev.aiOnly,
                  }))}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                  thumbColor={filters.shadchanOnly ? '#d4af37' : '#666'}
                />
              </View>

              {/* Age Range */}
              <Text style={styles.filterSectionTitle}>Age Range</Text>
              <View style={styles.ageRangeRow}>
                <Pressable
                  style={styles.ageButton}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, minAge: Math.max(18, prev.minAge - 1) }))
                  }
                >
                  <Ionicons name="remove" size={20} color="#d4af37" />
                </Pressable>
                <Text style={styles.ageText}>{filters.minAge}</Text>
                <Pressable
                  style={styles.ageButton}
                  onPress={() =>
                    setFilters((prev) => ({
                      ...prev,
                      minAge: Math.min(prev.maxAge - 1, prev.minAge + 1),
                    }))
                  }
                >
                  <Ionicons name="add" size={20} color="#d4af37" />
                </Pressable>
                <Text style={styles.ageToText}>to</Text>
                <Pressable
                  style={styles.ageButton}
                  onPress={() =>
                    setFilters((prev) => ({
                      ...prev,
                      maxAge: Math.max(prev.minAge + 1, prev.maxAge - 1),
                    }))
                  }
                >
                  <Ionicons name="remove" size={20} color="#d4af37" />
                </Pressable>
                <Text style={styles.ageText}>{filters.maxAge}</Text>
                <Pressable
                  style={styles.ageButton}
                  onPress={() =>
                    setFilters((prev) => ({ ...prev, maxAge: Math.min(99, prev.maxAge + 1) }))
                  }
                >
                  <Ionicons name="add" size={20} color="#d4af37" />
                </Pressable>
              </View>

              {/* Min Match Score */}
              <Text style={styles.filterSectionTitle}>Minimum Match Score</Text>
              <View style={styles.scoreOptions}>
                {[0, 50, 60, 70, 80].map((score) => (
                  <Pressable
                    key={score}
                    style={[
                      styles.scoreOption,
                      filters.minScore === score && styles.scoreOptionActive,
                    ]}
                    onPress={() => setFilters((prev) => ({ ...prev, minScore: score }))}
                  >
                    <Text
                      style={[
                        styles.scoreOptionText,
                        filters.minScore === score && styles.scoreOptionTextActive,
                      ]}
                    >
                      {score === 0 ? 'Any' : `${score}%+`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
                  <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                  <Text style={styles.clearFiltersText}>Clear All Filters</Text>
                </Pressable>
              )}
            </ScrollView>

            {/* Apply Button */}
            <Pressable
              style={styles.applyButton}
              onPress={() => setShowFiltersModal(false)}
            >
              <Text style={styles.applyButtonText}>
                Apply Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[4],
  },
  loadingText: {
    fontSize: 16,
    color: colors.transparent.white60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 36,
    color: '#d4af37',
    fontWeight: '300',
    letterSpacing: 4,
  },
  logoSubtext: {
    fontSize: 14,
    color: 'rgba(212, 175, 55, 0.7)',
    letterSpacing: 8,
    fontWeight: '300',
    marginTop: -4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  hebrewTitle: {
    fontSize: 32,
    color: '#d4af37',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#d4af37',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  aiLabel: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
    marginTop: 8,
  },
  suggestionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  photoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  cardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
    marginBottom: 2,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hebrewName: {
    fontSize: 13,
    color: colors.primary.gold,
  },
  cardCommunity: {
    fontSize: 14,
    color: '#d4af37',
    marginBottom: 2,
  },
  cardCity: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  scoreLabel: {
    fontSize: 10,
    color: colors.transparent.white50,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sourceIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  sourceName: {
    color: '#d4af37',
    fontWeight: '600',
  },
  reasonBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  reasonLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  reasonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  statusRow: {
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: spacing[1],
    alignSelf: 'flex-start',
  },
  statusInterested: {
    backgroundColor: colors.primary.gold,
  },
  statusDeclined: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  statusThinking: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.white,
  },
  statusTextInterested: {
    color: colors.primary.navy,
  },
  statusTextDeclined: {
    color: '#ff6b6b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
    backgroundColor: 'rgba(255,107,107,0.1)',
    alignItems: 'center',
  },
  declineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  thinkingButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  thinkingText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  interestedButton: {
    flex: 1.2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  interestedGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  interestedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a1628',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.1)',
  },
  viewMoreText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIconText: {
    fontSize: 40,
    color: '#d4af37',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a1628',
  },
  howItWorks: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  howItWorksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  howItWorksItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  howItWorksNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  howItWorksNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a1628',
  },
  howItWorksText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  // Filter button badge
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0a1628',
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 16,
    marginBottom: 12,
  },
  filterOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterOptionActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
  },
  filterOptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  filterOptionTextActive: {
    color: '#0a1628',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  filterRowInfo: {
    flex: 1,
    marginRight: 16,
  },
  filterRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  filterRowDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  ageRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  ageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  ageText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 36,
    textAlign: 'center',
  },
  ageToText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
  },
  scoreOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  scoreOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  scoreOptionActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
  },
  scoreOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  scoreOptionTextActive: {
    color: '#0a1628',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  clearFiltersText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  applyButton: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#d4af37',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a1628',
  },
});
