/**
 * Browse Profiles Tab
 *
 * Search and filter through all visible shidduch profiles
 * Users can discover potential matches manually
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface BrowseProfile {
  id: string;
  first_name: string | null;
  hebrew_name: string | null;
  age: number | null;
  community: string | null;
  city: string | null;
  state: string | null;
  hashkafa_details: string | null;
  looking_for_description: string | null;
  gender: string | null;
  created_at: string;
}

interface Filters {
  gender: string;
  communities: string[]; // Changed to array for multi-select
  ageMin: string;
  ageMax: string;
  city: string;
  hashkafa: string;
}

const COMMUNITIES = [
  { id: 'modern_orthodox', label: 'Modern Orthodox' },
  { id: 'modern_orthodox_machmir', label: 'MO Machmir' },
  { id: 'yeshivish', label: 'Yeshivish' },
  { id: 'chassidish', label: 'Chassidish' },
  { id: 'sephardi', label: 'Sephardi' },
  { id: 'chabad', label: 'Chabad' },
  { id: 'carlebachian', label: 'Carlebachian' },
  { id: 'other', label: 'Other' },
];

const HASHKAFOT = [
  { id: 'very_machmir', label: 'Very Machmir' },
  { id: 'machmir', label: 'Machmir' },
  { id: 'middle_of_road', label: 'Middle of Road' },
  { id: 'more_relaxed', label: 'More Relaxed' },
  { id: 'flexible', label: 'Flexible' },
];

const GENDERS = [
  { id: '', label: 'All' },
  { id: 'male', label: 'Men' },
  { id: 'female', label: 'Women' },
];

const COMMUNITY_LABELS: Record<string, string> = {
  modern_orthodox: 'Modern Orthodox',
  yeshivish: 'Yeshivish',
  chassidish: 'Chassidish',
  litvish: 'Litvish',
  sephardic: 'Sephardic',
  chabad: 'Chabad',
  other: 'Other',
};

export default function BrowseProfilesScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();

  const [profiles, setProfiles] = useState<BrowseProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    gender: '',
    communities: [],
    ageMin: '',
    ageMax: '',
    city: '',
    hashkafa: '',
  });

  const loadProfiles = async () => {
    if (!session?.user?.id) return;

    try {
      // Get user's internal ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) return;

      setCurrentUserId(userData.id);

      // Get user's shidduch profile ID for view tracking
      const { data: myProfile } = await supabase
        .from('shidduch_profiles')
        .select('id')
        .eq('user_id', userData.id)
        .single();

      if (myProfile) {
        setCurrentProfileId(myProfile.id);
      }

      // Build query with filters - using existing columns only.
      //
      // The user columns used to arrive as an embedded
      // `users:users!shidduch_profiles_user_id_fkey(...)`. `users` has been own-row-only
      // since 00013 (MEXA-261) and everyone listed here is somebody else, so the embed came
      // back null and the whole list rendered nameless. They come from
      // `user_public_profiles` in a second query keyed on the user ids instead (MEXA-279).
      let query = supabase
        .from('shidduch_profiles')
        .select(`
          id,
          user_id,
          hebrew_name,
          community,
          hashkafa_details,
          looking_for_description,
          created_at
        `)
        .eq('profile_visible', true)
        .eq('accepting_suggestions', true)
        .neq('user_id', userData.id) // Don't show own profiles
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply community filter - support multiple communities
      if (filters.communities.length > 0) {
        query = query.in('community', filters.communities);
      }

      const { data: profilesData, error } = await query;

      if (error) {
        console.error('Error loading profiles:', error);
        return;
      }

      const profileUserIds = [
        ...new Set((profilesData ?? []).map((p) => p.user_id)),
      ].filter((id): id is string => !!id);

      const { data: profileUsers, error: usersError } = await supabase
        .from('user_public_profiles')
        .select('id, first_name, date_of_birth, gender, current_city, current_state')
        .in('id', profileUserIds);

      if (usersError) {
        console.error('Error loading profile users:', usersError);
        return;
      }

      // A profile whose user is inactive, blocked either way, or the caller has no entry
      // here and so renders without a name, age or city - the same as it did when the embed
      // was null. Left as-is rather than dropped, to keep this change to the read path.
      const profileUsersById = new Map((profileUsers ?? []).map((u) => [u.id, u]));

      // Transform and filter data
      const transformedProfiles: BrowseProfile[] = (profilesData || [])
        .map((p) => {
          const user = p.user_id ? profileUsersById.get(p.user_id) : undefined;
          const age = user?.date_of_birth
            ? Math.floor(
                (Date.now() - new Date(user.date_of_birth).getTime()) /
                  (365.25 * 24 * 60 * 60 * 1000)
              )
            : null;

          return {
            id: p.id,
            first_name: user?.first_name ?? null,
            hebrew_name: p.hebrew_name,
            age,
            community: p.community,
            city: user?.current_city ?? null,
            state: user?.current_state ?? null,
            hashkafa_details: p.hashkafa_details,
            looking_for_description: p.looking_for_description,
            created_at: p.created_at,
            gender: user?.gender ?? null,
          };
        })
        .filter((p: any) => {
          // Apply client-side filters
          if (filters.gender && p.gender !== filters.gender) return false;
          if (filters.ageMin && p.age && p.age < parseInt(filters.ageMin)) return false;
          if (filters.ageMax && p.age && p.age > parseInt(filters.ageMax)) return false;
          if (filters.city && p.city && !p.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
          if (filters.hashkafa && p.hashkafa_details && !p.hashkafa_details.toLowerCase().includes(filters.hashkafa.toLowerCase())) return false;

          // Apply search query
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const name = (p.first_name || '').toLowerCase();
            const hebrew = (p.hebrew_name || '').toLowerCase();
            const community = (COMMUNITY_LABELS[p.community || ''] || '').toLowerCase();
            const city = (p.city || '').toLowerCase();
            return name.includes(q) || hebrew.includes(q) || community.includes(q) || city.includes(q);
          }

          return true;
        });

      setProfiles(transformedProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [filters, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadProfiles();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProfiles();
  };

  // Record a profile view in the database
  const recordProfileView = async (viewedProfileId: string, viewSource: string = 'browse') => {
    try {
      await supabase.from('shidduch_profile_views').insert({
        profile_id: viewedProfileId,
        viewer_profile_id: currentProfileId || null,
        viewer_user_id: currentUserId || null,
        view_source: viewSource,
      });
      console.log('[Browse] Recorded profile view for:', viewedProfileId);
    } catch (error) {
      // Don't block the UI if view tracking fails
      console.error('Error recording profile view:', error);
    }
  };

  // Handle profile card press - record view and potentially show details
  const handleProfilePress = async (profile: BrowseProfile) => {
    // Record the view
    recordProfileView(profile.id, 'browse');
    // TODO: Navigate to profile detail screen or show modal
    console.log('[Browse] Viewing profile:', profile.first_name);
  };

  const handleSearch = () => {
    loadProfiles();
  };

  const clearFilters = () => {
    setFilters({
      gender: '',
      communities: [],
      ageMin: '',
      ageMax: '',
      city: '',
      hashkafa: '',
    });
    setSearchQuery('');
  };

  const toggleCommunity = (communityId: string) => {
    setFilters((prev) => ({
      ...prev,
      communities: prev.communities.includes(communityId)
        ? prev.communities.filter((c) => c !== communityId)
        : [...prev.communities, communityId],
    }));
  };

  const activeFilterCount =
    (filters.gender ? 1 : 0) +
    filters.communities.length +
    (filters.ageMin ? 1 : 0) +
    (filters.ageMax ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.hashkafa ? 1 : 0);

  const renderProfileCard = ({ item: profile, index }: { item: BrowseProfile; index: number }) => {
    const community = profile.community
      ? COMMUNITY_LABELS[profile.community] || profile.community
      : null;
    const location = [profile.city, profile.state].filter(Boolean).join(', ');

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50)}
        style={styles.profileCard}
      >
        <Pressable style={styles.profileCardInner} onPress={() => handleProfilePress(profile)}>
          <View style={styles.profileAvatar}>
            <Text style={styles.avatarText}>
              {(profile.first_name || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileName}>
                {profile.first_name || 'Anonymous'}
                {profile.age ? `, ${profile.age}` : null}
              </Text>
              {profile.hebrew_name && (
                <Text style={styles.profileHebrew}>{profile.hebrew_name}</Text>
              )}
            </View>
            {community && <Text style={styles.profileCommunity}>{community}</Text>}
            {location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color={colors.transparent.white50} />
                <Text style={styles.profileLocation}>{location}</Text>
              </View>
            )}
            {profile.hashkafa_details && (
              <Text style={styles.profileBio} numberOfLines={2}>
                {profile.hashkafa_details}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.transparent.white30} />
        </Pressable>
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
        <Text style={styles.hebrewTitle}>חיפוש פרופילים</Text>
        <Text style={styles.title}>Browse Profiles</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color={colors.transparent.white50} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, community, location..."
            placeholderTextColor={colors.transparent.white30}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.transparent.white50} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.primary.navy : colors.primary.gold} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} found
        </Text>
        {activeFilterCount > 0 && (
          <Pressable onPress={clearFilters}>
            <Text style={styles.clearFilters}>Clear filters</Text>
          </Pressable>
        )}
      </View>

      {/* Profiles List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.gold} />
        </View>
      ) : (
        <FlatList
          data={profiles}
          renderItem={renderProfileCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={48} color={colors.primary.gold} />
              </View>
              <Text style={styles.emptyTitle}>No Profiles Found</Text>
              <Text style={styles.emptyText}>
                Try adjusting your search or filters to find more matches.
              </Text>
            </View>
          }
        />
      )}

      {/* Filters Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing[4] }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={colors.primary.white} />
              </Pressable>
            </View>

            <ScrollView style={styles.filtersScroll} showsVerticalScrollIndicator={false}>
              {/* Gender Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Looking for</Text>
                <View style={styles.filterOptions}>
                  {GENDERS.map((g) => (
                    <Pressable
                      key={g.id}
                      style={[
                        styles.filterOption,
                        filters.gender === g.id && styles.filterOptionSelected,
                      ]}
                      onPress={() => setFilters((prev) => ({ ...prev, gender: g.id }))}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.gender === g.id && styles.filterOptionTextSelected,
                        ]}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Community Filter - Multi-select */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>
                  Communities {filters.communities.length > 0 && `(${filters.communities.length} selected)`}
                </Text>
                <View style={styles.filterOptionsWrap}>
                  {COMMUNITIES.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.filterOption,
                        filters.communities.includes(c.id) && styles.filterOptionSelected,
                      ]}
                      onPress={() => toggleCommunity(c.id)}
                    >
                      {filters.communities.includes(c.id) && (
                        <Ionicons name="checkmark" size={14} color={colors.primary.navy} />
                      )}
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.communities.includes(c.id) && styles.filterOptionTextSelected,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Hashkafa Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Hashkafa (Religious Outlook)</Text>
                <View style={styles.filterOptionsWrap}>
                  {HASHKAFOT.map((h) => (
                    <Pressable
                      key={h.id}
                      style={[
                        styles.filterOption,
                        filters.hashkafa === h.id && styles.filterOptionSelected,
                      ]}
                      onPress={() => setFilters((prev) => ({
                        ...prev,
                        hashkafa: prev.hashkafa === h.id ? '' : h.id,
                      }))}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.hashkafa === h.id && styles.filterOptionTextSelected,
                        ]}
                      >
                        {h.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Age Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Age Range</Text>
                <View style={styles.ageInputs}>
                  <TextInput
                    style={styles.ageInput}
                    placeholder="Min"
                    placeholderTextColor={colors.transparent.white30}
                    value={filters.ageMin}
                    onChangeText={(v) => setFilters((prev) => ({ ...prev, ageMin: v }))}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.ageSeparator}>to</Text>
                  <TextInput
                    style={styles.ageInput}
                    placeholder="Max"
                    placeholderTextColor={colors.transparent.white30}
                    value={filters.ageMax}
                    onChangeText={(v) => setFilters((prev) => ({ ...prev, ageMax: v }))}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Location */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Location</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="City"
                  placeholderTextColor={colors.transparent.white30}
                  value={filters.city}
                  onChangeText={(v) => setFilters((prev) => ({ ...prev, city: v }))}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Clear All</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={() => setShowFilters(false)}>
                <LinearGradient
                  colors={[colors.primary.gold, '#f4d47c', colors.primary.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.applyButtonGradient}
                >
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </LinearGradient>
              </Pressable>
            </View>
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
    paddingBottom: spacing[3],
    alignItems: 'center',
  },
  hebrewTitle: {
    fontSize: 20,
    color: colors.primary.gold,
    letterSpacing: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.primary.white,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.dark.background,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  resultsCount: {
    fontSize: 14,
    color: colors.transparent.white50,
  },
  clearFilters: {
    fontSize: 14,
    color: colors.primary.gold,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing[5],
  },
  profileCard: {
    marginBottom: spacing[3],
  },
  profileCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: spacing[3],
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  profileInfo: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
    marginBottom: spacing[0.5],
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  profileHebrew: {
    fontSize: 12,
    color: colors.primary.gold,
  },
  profileCommunity: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginBottom: spacing[0.5],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[1],
  },
  profileLocation: {
    fontSize: 12,
    color: colors.transparent.white50,
  },
  profileBio: {
    fontSize: 12,
    color: colors.transparent.white40,
    lineHeight: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a1628',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing[4],
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.white,
  },
  filtersScroll: {
    paddingHorizontal: spacing[5],
  },
  filterSection: {
    marginBottom: spacing[5],
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  filterOptions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  filterOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  filterOptionSelected: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  filterOptionText: {
    fontSize: 14,
    color: colors.primary.white,
  },
  filterOptionTextSelected: {
    color: colors.primary.navy,
    fontWeight: '600',
  },
  ageInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  ageInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.primary.white,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    textAlign: 'center',
  },
  ageSeparator: {
    fontSize: 14,
    color: colors.transparent.white50,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.primary.white,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.1)',
  },
  clearButton: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.white,
  },
  applyButton: {
    flex: 2,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary.navy,
  },
});
