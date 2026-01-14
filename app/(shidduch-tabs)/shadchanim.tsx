/**
 * Shadchanim Directory
 *
 * Browse and connect with verified matchmakers
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

// Mock shadchanim data
const MOCK_SHADCHANIM = [
  {
    id: '1',
    name: 'Mrs. Chaya Goldstein',
    photoUrl: null,
    rating: 4.8,
    reviews: 47,
    specialties: ['Young Professionals', 'Modern Orthodox'],
    communities: ['Modern Orthodox', 'Modern Orthodox Machmir'],
    languages: ['English', 'Hebrew'],
    location: 'Brooklyn, NY',
    availability: 'Sunday-Thursday evenings',
    fee: 'Free - donation upon engagement',
    bio: 'Making shidduchim for over 20 years. Specializing in young professionals.',
    isVerified: true,
    isConnected: false,
    activeMatches: 23,
    successfulMatches: 156,
  },
  {
    id: '2',
    name: 'Rabbi Yosef Weiss',
    photoUrl: null,
    rating: 4.9,
    reviews: 89,
    specialties: ['Yeshivish', 'Kollel Families'],
    communities: ['Yeshivish', 'Litvish'],
    languages: ['English', 'Yiddish', 'Hebrew'],
    location: 'Lakewood, NJ',
    availability: 'By appointment',
    fee: '$500 upon engagement',
    bio: 'Experienced shadchan with connections to major yeshivos.',
    isVerified: true,
    isConnected: true,
    activeMatches: 31,
    successfulMatches: 234,
  },
  {
    id: '3',
    name: 'Mrs. Miriam Levy',
    photoUrl: null,
    rating: 4.7,
    reviews: 32,
    specialties: ['Baal Teshuva', 'Sephardic'],
    communities: ['Sephardic', 'Modern Orthodox'],
    languages: ['English', 'Hebrew', 'French'],
    location: 'Los Angeles, CA',
    availability: 'Flexible',
    fee: 'Sliding scale',
    bio: 'Helping people from all backgrounds find their bashert.',
    isVerified: true,
    isConnected: false,
    activeMatches: 15,
    successfulMatches: 89,
  },
];

const COMMUNITY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'modern_orthodox', label: 'Modern Orthodox' },
  { id: 'yeshivish', label: 'Yeshivish' },
  { id: 'chassidish', label: 'Chassidish' },
  { id: 'sephardic', label: 'Sephardic' },
  { id: 'chabad', label: 'Chabad' },
];

interface ShadchanCardProps {
  shadchan: typeof MOCK_SHADCHANIM[0];
  onConnect: (id: string) => void;
  delay: number;
}

function ShadchanCard({ shadchan, onConnect, delay }: ShadchanCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.shadchanCard}>
      <View style={styles.cardHeader}>
        {shadchan.photoUrl ? (
          <Image source={{ uri: shadchan.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={28} color="#d4af37" />
          </View>
        )}
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.shadchanName}>{shadchan.name}</Text>
            {shadchan.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
              </View>
            )}
          </View>
          <Text style={styles.location}>{shadchan.location}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#d4af37" />
            <Text style={styles.rating}>{shadchan.rating}</Text>
            <Text style={styles.reviews}>({shadchan.reviews} reviews)</Text>
          </View>
        </View>
      </View>

      {/* Specialties */}
      <View style={styles.specialtiesRow}>
        {shadchan.specialties.map((specialty, index) => (
          <View key={index} style={styles.specialtyChip}>
            <Text style={styles.specialtyText}>{specialty}</Text>
          </View>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{shadchan.successfulMatches}</Text>
          <Text style={styles.statLabel}>Successful Matches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{shadchan.activeMatches}</Text>
          <Text style={styles.statLabel}>Active Singles</Text>
        </View>
      </View>

      {/* Bio */}
      <Text style={styles.bio} numberOfLines={2}>{shadchan.bio}</Text>

      {/* Info Row */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.infoText}>{shadchan.fee}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.infoText}>{shadchan.availability}</Text>
        </View>
      </View>

      {/* Connect Button */}
      <Pressable
        style={[
          styles.connectButton,
          shadchan.isConnected && styles.connectedButton,
        ]}
        onPress={() => onConnect(shadchan.id)}
        disabled={shadchan.isConnected}
      >
        {shadchan.isConnected ? (
          <>
            <Ionicons name="checkmark" size={18} color="#4ade80" />
            <Text style={styles.connectedText}>Connected</Text>
          </>
        ) : (
          <>
            <Ionicons name="add" size={18} color="#0a1628" />
            <Text style={styles.connectText}>Connect</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function ShadchanimScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [shadchanim, setShadchanim] = useState(MOCK_SHADCHANIM);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleConnect = (id: string) => {
    setShadchanim((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isConnected: true } : s))
    );
  };

  const filteredShadchanim = shadchanim.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.specialties.some((sp) => sp.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter =
      selectedFilter === 'all' ||
      s.communities.some((c) => c.toLowerCase().includes(selectedFilter.replace('_', ' ')));
    return matchesSearch && matchesFilter;
  });

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
        {/* Header */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
          <Text style={styles.hebrewTitle}>שדכנים</Text>
          <Text style={styles.title}>Matchmakers</Text>
        </Animated.View>

        {/* Search */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or specialty..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </Animated.View>

        {/* Filters */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {COMMUNITY_FILTERS.map((filter) => (
              <Pressable
                key={filter.id}
                style={[
                  styles.filterChip,
                  selectedFilter === filter.id && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedFilter === filter.id && styles.filterTextSelected,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Results count */}
        <Animated.Text entering={FadeIn.delay(400)} style={styles.resultsCount}>
          {filteredShadchanim.length} shadchanim found
        </Animated.Text>

        {/* Shadchanim List */}
        {filteredShadchanim.map((shadchan, index) => (
          <ShadchanCard
            key={shadchan.id}
            shadchan={shadchan}
            onConnect={handleConnect}
            delay={500 + index * 100}
          />
        ))}

        {/* Info Box */}
        <Animated.View entering={FadeInDown.delay(800)} style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#d4af37" />
          <Text style={styles.infoBoxText}>
            All shadchanim are verified members of the community. When you connect,
            they receive your profile and can start suggesting matches.
          </Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#FFFFFF',
  },
  filtersContainer: {
    paddingBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
  },
  filterText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  filterTextSelected: {
    color: '#0a1628',
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  shadchanCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  shadchanName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    marginTop: 1,
  },
  location: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d4af37',
  },
  reviews: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  specialtyChip: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyText: {
    fontSize: 12,
    color: '#d4af37',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  bio: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  connectedButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  connectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a1628',
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
});
