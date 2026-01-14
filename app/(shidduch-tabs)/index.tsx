/**
 * Shidduch Suggestions Screen
 *
 * Curated suggestions from shadchanim - NO swiping
 * Users receive hand-picked matches based on compatibility
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';

// Mock data for suggestions
const MOCK_SUGGESTIONS = [
  {
    id: '1',
    firstName: 'Sarah',
    age: 23,
    community: 'Modern Orthodox',
    city: 'Brooklyn, NY',
    shadchan: 'Mrs. Goldstein',
    reason: 'Similar backgrounds, both from Chicago originally',
    status: 'pending',
    photoVisible: true,
    photoUrl: null,
  },
  {
    id: '2',
    firstName: 'Rivka',
    age: 22,
    community: 'Yeshivish',
    city: 'Lakewood, NJ',
    shadchan: 'Rabbi Weiss',
    reason: 'Both looking for learning + working, similar hashkafa',
    status: 'interested',
    photoVisible: false,
    photoUrl: null,
  },
];

interface SuggestionCardProps {
  suggestion: typeof MOCK_SUGGESTIONS[0];
  onRespond: (id: string, response: 'interested' | 'declined' | 'thinking') => void;
  delay: number;
}

function SuggestionCard({ suggestion, onRespond, delay }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);

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
              <Text style={styles.cardName}>{suggestion.firstName}, {suggestion.age}</Text>
              <Text style={styles.cardCommunity}>{suggestion.community}</Text>
              <Text style={styles.cardCity}>{suggestion.city}</Text>
            </View>
          </View>
          {suggestion.status === 'interested' && (
            <View style={styles.statusBadge}>
              <Ionicons name="heart" size={12} color="#0a1628" />
              <Text style={styles.statusText}>Interested</Text>
            </View>
          )}
        </View>

        {/* Shadchan Info */}
        <View style={styles.shadchanRow}>
          <View style={styles.shadchanIcon}>
            <Ionicons name="people" size={14} color="#d4af37" />
          </View>
          <Text style={styles.shadchanText}>
            Suggested by <Text style={styles.shadchanName}>{suggestion.shadchan}</Text>
          </Text>
        </View>

        {/* Reason */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Why this match:</Text>
          <Text style={styles.reasonText}>{suggestion.reason}</Text>
        </View>

        {/* Actions */}
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
            <Text style={styles.thinkingText}>Need to Think</Text>
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

        {/* View More */}
        <Pressable
          style={styles.viewMoreButton}
          onPress={() => setExpanded(!expanded)}
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
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState(MOCK_SUGGESTIONS);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate fetch
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleRespond = (id: string, response: 'interested' | 'declined' | 'thinking') => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: response } : s))
    );
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const respondedSuggestions = suggestions.filter((s) => s.status !== 'pending');

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
          <View>
            <Text style={styles.hebrewTitle}>הצעות</Text>
            <Text style={styles.title}>Your Suggestions</Text>
          </View>
          <Pressable style={styles.filterButton}>
            <Ionicons name="options-outline" size={22} color="#d4af37" />
          </Pressable>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pendingSuggestions.length}</Text>
            <Text style={styles.statLabel}>New Suggestions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {respondedSuggestions.filter((s) => s.status === 'interested').length}
            </Text>
            <Text style={styles.statLabel}>Mutual Interest</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Active Shadchanim</Text>
          </View>
        </Animated.View>

        {/* Empty State */}
        {suggestions.length === 0 && (
          <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>✡</Text>
            </View>
            <Text style={styles.emptyTitle}>No Suggestions Yet</Text>
            <Text style={styles.emptyText}>
              Connect with shadchanim to start receiving personalized suggestions
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(shidduch-tabs)/shadchanim')}
            >
              <Text style={styles.emptyButtonText}>Find Shadchanim</Text>
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
                delay={700 + index * 100}
              />
            ))}
          </>
        )}

        {/* How It Works */}
        <Animated.View entering={FadeInDown.delay(800)} style={styles.howItWorks}>
          <Text style={styles.howItWorksTitle}>How Shidduchim Works</Text>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>1</Text>
            </View>
            <Text style={styles.howItWorksText}>
              Shadchanim review your profile and suggest compatible matches
            </Text>
          </View>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>2</Text>
            </View>
            <Text style={styles.howItWorksText}>
              You and your parents can research the suggestion
            </Text>
          </View>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>3</Text>
            </View>
            <Text style={styles.howItWorksText}>
              When both sides say yes, contact info is shared
            </Text>
          </View>
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
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4af37',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0a1628',
  },
  shadchanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  shadchanIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shadchanText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  shadchanName: {
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
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
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
});
