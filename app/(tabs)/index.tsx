/**
 * Discovery Screen
 *
 * Main swiping interface for finding matches
 */

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator, Modal, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useDiscoveryStore } from '@/stores/discoveryStore';
import { useMatchStore } from '@/stores/matchStore';
import { usePremiumStore } from '@/stores/premiumStore';
import { useDiscoveryProfiles } from '@/api/queries';
import { useSwipe } from '@/api/mutations';
import { useMatchesSubscription } from '@/api/realtime';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing[8];
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_VELOCITY = 500;

// Sample profile data for demo
const SAMPLE_PROFILES = [
  {
    id: '1',
    first_name: 'Sarah',
    age: 27,
    current_city: 'Manhattan',
    distance: 3,
    jewish_background: 'Reform',
    bio: 'Marketing by day, amateur challah baker by weekend.',
    photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800'],
    prompts: [{ question: "My Shabbat looks like...", answer: "Friends, wine, and way too much food" }],
    safta_likes: 8,
  },
  {
    id: '2',
    first_name: 'David',
    age: 29,
    current_city: 'Brooklyn',
    distance: 5,
    jewish_background: 'Conservative',
    bio: 'Building apps during the week, building community on weekends.',
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800'],
    prompts: [{ question: "Best Jewish food take:", answer: "Pastrami > Corned beef. Always." }],
    safta_likes: 15,
  },
  {
    id: '3',
    first_name: 'Rachel',
    age: 25,
    current_city: 'Los Angeles',
    distance: 2,
    jewish_background: 'Just Jewish',
    bio: 'Screenwriter who feels guilty about everything.',
    photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800'],
    prompts: [{ question: "The way to my heart is...", answer: "Making me laugh and good pastrami" }],
    safta_likes: 3,
  },
];

interface ProfileCardProps {
  profile: any; // Supports both API DiscoveryUser and SAMPLE_PROFILES format
  isActive: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onTap: () => void;
}

// Helper to get photo URL from profile (handles both API and sample data formats)
function getProfilePhotoUrl(profile: any, index: number = 0): string | null {
  if (!profile.photos || profile.photos.length === 0) return null;
  const photo = profile.photos[index];
  if (typeof photo === 'string') return photo;
  if (photo && photo.photo_url) return photo.photo_url;
  return null;
}

// Helper to get first prompt from profile
function getProfilePrompt(profile: any): { question: string; answer: string } | null {
  if (!profile.prompts || profile.prompts.length === 0) return null;
  const prompt = profile.prompts[0];
  if (prompt.question && prompt.answer) return prompt;
  if (prompt.prompt_id && prompt.answer) {
    // API format - use prompt_id as question placeholder
    return { question: 'My favorite thing about...', answer: prompt.answer };
  }
  return null;
}

function ProfileCard({ profile, isActive, onSwipeLeft, onSwipeRight, onSwipeUp, onTap }: ProfileCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const scale = useSharedValue(isActive ? 1 : 0.95);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1 : 0.95);
  }, [isActive]);

  const triggerHaptic = useCallback((type: 'like' | 'pass' | 'super') => {
    if (type === 'like') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'super') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const handleSwipeComplete = useCallback((direction: 'left' | 'right' | 'up') => {
    if (direction === 'left') {
      triggerHaptic('pass');
      onSwipeLeft();
    } else if (direction === 'right') {
      triggerHaptic('like');
      onSwipeRight();
    } else {
      triggerHaptic('super');
      onSwipeUp();
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, triggerHaptic]);

  const handleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTap();
  }, [onTap]);

  // Tap gesture for viewing profile
  const tapGesture = Gesture.Tap()
    .enabled(isActive)
    .onEnd(() => {
      runOnJS(handleTap)();
    });

  const gesture = Gesture.Pan()
    .enabled(isActive)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      cardRotation.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      const shouldSwipeRight = translateX.value > SWIPE_THRESHOLD || event.velocityX > SWIPE_VELOCITY;
      const shouldSwipeLeft = translateX.value < -SWIPE_THRESHOLD || event.velocityX < -SWIPE_VELOCITY;
      const shouldSwipeUp = translateY.value < -SWIPE_THRESHOLD * 1.5 || event.velocityY < -SWIPE_VELOCITY;

      if (shouldSwipeRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        cardRotation.value = withTiming(30, { duration: 300 });
        runOnJS(handleSwipeComplete)('right');
      } else if (shouldSwipeLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        cardRotation.value = withTiming(-30, { duration: 300 });
        runOnJS(handleSwipeComplete)('left');
      } else if (shouldSwipeUp) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 300 });
        runOnJS(handleSwipeComplete)('up');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        cardRotation.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${cardRotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const likeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const nopeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const superLikeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_THRESHOLD * 1.5, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const photoUrl = getProfilePhotoUrl(profile);
  const prompt = getProfilePrompt(profile);
  const saftaLikes = profile.safta_likes || profile.safta_approved_count || 0;

  // Combine tap and pan gestures
  const combinedGesture = Gesture.Race(tapGesture, gesture);

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        {/* Background image */}
        {photoUrl ? (
          <Animated.Image
            source={{ uri: photoUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: colors.neutral[300] }]} />
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          locations={[0.5, 1]}
          style={styles.cardGradient}
        />

        {/* Swipe indicators */}
        <Animated.View style={[styles.likeIndicator, likeIndicatorStyle]}>
          <Text style={styles.likeText}>LIKE</Text>
        </Animated.View>
        <Animated.View style={[styles.nopeIndicator, nopeIndicatorStyle]}>
          <Text style={styles.nopeText}>NOPE</Text>
        </Animated.View>
        <Animated.View style={[styles.superLikeIndicator, superLikeIndicatorStyle]}>
          <Text style={styles.superLikeText}>SUPER</Text>
        </Animated.View>

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Safta badge */}
          {saftaLikes > 0 && (
            <View style={styles.saftaBadge}>
              <Text style={styles.saftaText}>👵 {saftaLikes} Saftas approve!</Text>
            </View>
          )}

          {/* Basic info */}
          <View style={styles.basicInfo}>
            <Text style={styles.name}>{profile.first_name}, {profile.age}</Text>
            <Text style={styles.location}>
              {profile.current_city || 'Nearby'} {profile.distance ? `• ${profile.distance} miles` : ''}
            </Text>
            <View style={styles.backgroundBadge}>
              <Text style={styles.backgroundText}>{profile.jewish_background}</Text>
            </View>
          </View>

          {/* Prompt preview */}
          {prompt && (
            <View style={styles.promptPreview}>
              <Text style={styles.promptQuestion}>{prompt.question}</Text>
              <Text style={styles.promptAnswer} numberOfLines={2}>{prompt.answer}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function DiscoveryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const showCelebration = useMatchStore((s) => s.showCelebration);

  // Fetch discovery profiles from API
  const { data: apiProfiles, isLoading, error, refetch } = useDiscoveryProfiles();

  // Swipe mutation
  const swipeMutation = useSwipe();

  // Subscribe to new matches
  useMatchesSubscription((event) => {
    // When a match happens from the swipe, show celebration
    // The match check is done in the mutation, this is for external matches
  });

  // Use API profiles if available, otherwise fall back to sample data
  const profiles = apiProfiles && apiProfiles.length > 0 ? apiProfiles : SAMPLE_PROFILES;

  const handleSwipeLeft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const profile = profiles[currentIndex];
    if (profile && apiProfiles && apiProfiles.length > 0) {
      swipeMutation.mutate({ swipedUserId: profile.id, action: 'pass' });
    }
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  }, [currentIndex, profiles, apiProfiles, swipeMutation]);

  const handleSwipeRight = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const profile = profiles[currentIndex];
    if (profile && apiProfiles && apiProfiles.length > 0) {
      swipeMutation.mutate(
        { swipedUserId: profile.id, action: 'like' },
        {
          onSuccess: (result) => {
            if (result.isMatch) {
              // Extra haptic for match!
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showCelebration({
                id: result.matchId || `match-${profile.id}`,
                created_at: new Date().toISOString(),
                other_user: {
                  id: profile.id,
                  first_name: profile.first_name,
                  display_name: profile.first_name,
                  primary_photo_url: getProfilePhotoUrl(profile, 0),
                },
                unread_count: 0,
              });
            }
          },
        }
      );
    } else {
      // Demo mode: simulate match (50% chance)
      if (Math.random() > 0.5) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showCelebration({
          id: `match-${profile.id}`,
          created_at: new Date().toISOString(),
          other_user: {
            id: profile.id,
            first_name: profile.first_name,
            display_name: profile.first_name,
            primary_photo_url: getProfilePhotoUrl(profile, 0),
          },
          unread_count: 0,
        });
      }
    }
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  }, [currentIndex, profiles, apiProfiles, swipeMutation, showCelebration]);

  const handleSwipeUp = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const profile = profiles[currentIndex];
    if (profile && apiProfiles && apiProfiles.length > 0) {
      swipeMutation.mutate(
        { swipedUserId: profile.id, action: 'super_like' },
        {
          onSuccess: (result) => {
            if (result.isMatch) {
              // Extra haptic for match!
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showCelebration({
                id: result.matchId || `match-${profile.id}`,
                created_at: new Date().toISOString(),
                other_user: {
                  id: profile.id,
                  first_name: profile.first_name,
                  display_name: profile.first_name,
                  primary_photo_url: getProfilePhotoUrl(profile, 0),
                },
                unread_count: 0,
              });
            }
          },
        }
      );
    }
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  }, [currentIndex, profiles, apiProfiles, swipeMutation, showCelebration]);

  // Reset index when profiles change
  useEffect(() => {
    setCurrentIndex(0);
  }, [apiProfiles]);

  const handleViewProfile = useCallback((profile: any) => {
    setSelectedProfile(profile);
    setShowProfileModal(true);
  }, []);

  const hasMoreProfiles = currentIndex < profiles.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={[styles.logoText, { color: theme.colors.text }]}>Mazal</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="options-outline" size={24} color={theme.colors.icon} />
          </Pressable>
        </View>
      </View>

      {/* Card stack */}
      <View style={styles.cardStack}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary.gold} />
        ) : hasMoreProfiles ? (
          profiles
            .slice(currentIndex, currentIndex + 3)
            .reverse()
            .map((profile, index, arr) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isActive={index === arr.length - 1}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeUp={handleSwipeUp}
                onTap={() => handleViewProfile(profile)}
              />
            ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color={colors.neutral[300]} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              You've seen everyone nearby!
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Check back later for new profiles
            </Text>
            <Pressable
              style={styles.expandButton}
              onPress={() => router.push('/settings')}
            >
              <Text style={styles.expandButtonText}>Adjust Filters</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Action buttons - simplified to 3 core actions */}
      {hasMoreProfiles && (
        <View style={[styles.actionButtons, { paddingBottom: insets.bottom + spacing[2] }]}>
          <Pressable style={[styles.actionButton, styles.nopeButton]} onPress={handleSwipeLeft}>
            <Ionicons name="close" size={32} color={colors.semantic.error} />
          </Pressable>
          <Pressable style={[styles.actionButton, styles.superLikeButton]} onPress={handleSwipeUp}>
            <Ionicons name="star" size={24} color={colors.semantic.info} />
          </Pressable>
          <Pressable style={[styles.actionButton, styles.likeButton]} onPress={handleSwipeRight}>
            <Ionicons name="heart" size={32} color={colors.primary.white} />
          </Pressable>
        </View>
      )}

      {/* Profile Detail Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        {selectedProfile && (
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.modalHeader, { paddingTop: insets.top }]}>
              <Pressable onPress={() => setShowProfileModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedProfile.first_name}'s Profile
              </Text>
              <View style={{ width: 44 }} />
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Main Photo */}
              <Image
                source={{ uri: getProfilePhotoUrl(selectedProfile) || '' }}
                style={styles.modalPhoto}
                resizeMode="cover"
              />

              {/* Basic Info */}
              <View style={styles.modalInfo}>
                <Text style={[styles.modalName, { color: theme.colors.text }]}>
                  {selectedProfile.first_name}, {selectedProfile.age}
                </Text>
                <Text style={[styles.modalLocation, { color: theme.colors.textSecondary }]}>
                  {selectedProfile.current_city || 'Nearby'} {selectedProfile.distance ? `• ${selectedProfile.distance} miles` : ''}
                </Text>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>{selectedProfile.jewish_background}</Text>
                </View>
              </View>

              {/* Bio */}
              {selectedProfile.bio && (
                <View style={[styles.modalSection, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>About</Text>
                  <Text style={[styles.modalBio, { color: theme.colors.textSecondary }]}>
                    {selectedProfile.bio}
                  </Text>
                </View>
              )}

              {/* Prompts */}
              {selectedProfile.prompts && selectedProfile.prompts.length > 0 && (
                <View style={styles.modalPrompts}>
                  {selectedProfile.prompts.map((prompt: any, idx: number) => (
                    <View key={idx} style={[styles.modalPromptCard, { backgroundColor: theme.colors.surface }]}>
                      <Text style={[styles.modalPromptQuestion, { color: theme.colors.textSecondary }]}>
                        {prompt.question || 'My favorite thing about...'}
                      </Text>
                      <Text style={[styles.modalPromptAnswer, { color: theme.colors.text }]}>
                        {prompt.answer}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Safta Likes */}
              {(selectedProfile.safta_likes || selectedProfile.safta_approved_count) > 0 && (
                <View style={[styles.modalSaftaBadge, { backgroundColor: colors.transparent.gold20 }]}>
                  <Text style={styles.modalSaftaText}>
                    👵 {selectedProfile.safta_likes || selectedProfile.safta_approved_count} Saftas approve!
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Action Buttons */}
            <View style={[styles.modalActions, { paddingBottom: insets.bottom + spacing[4] }]}>
              <Pressable
                style={[styles.modalActionButton, styles.modalPassButton]}
                onPress={() => {
                  setShowProfileModal(false);
                  handleSwipeLeft();
                }}
              >
                <Ionicons name="close" size={28} color={colors.semantic.error} />
              </Pressable>
              <Pressable
                style={[styles.modalActionButton, styles.modalSuperButton]}
                onPress={() => {
                  setShowProfileModal(false);
                  handleSwipeUp();
                }}
              >
                <Ionicons name="star" size={24} color={colors.semantic.info} />
              </Pressable>
              <Pressable
                style={[styles.modalActionButton, styles.modalLikeButton]}
                onPress={() => {
                  setShowProfileModal(false);
                  handleSwipeRight();
                }}
              >
                <Ionicons name="heart" size={28} color={colors.primary.white} />
              </Pressable>
            </View>
          </View>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    ...shadows.card,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  likeIndicator: {
    position: 'absolute',
    top: spacing[6],
    left: spacing[6],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 4,
    borderColor: colors.semantic.success,
    transform: [{ rotate: '-15deg' }],
  },
  likeText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.semantic.success,
  },
  nopeIndicator: {
    position: 'absolute',
    top: spacing[6],
    right: spacing[6],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 4,
    borderColor: colors.semantic.error,
    transform: [{ rotate: '15deg' }],
  },
  nopeText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.semantic.error,
  },
  superLikeIndicator: {
    position: 'absolute',
    bottom: spacing[20],
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 4,
    borderColor: colors.semantic.info,
  },
  superLikeText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.semantic.info,
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[4],
  },
  saftaBadge: {
    backgroundColor: colors.transparent.gold50,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
  },
  saftaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.white,
  },
  basicInfo: {
    marginBottom: spacing[3],
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  location: {
    fontSize: 14,
    color: colors.transparent.white80,
    marginTop: spacing[1],
  },
  backgroundBadge: {
    backgroundColor: colors.transparent.white20,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: spacing[2],
  },
  backgroundText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary.white,
  },
  promptPreview: {
    backgroundColor: colors.transparent.white10,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
  },
  promptQuestion: {
    fontSize: 12,
    color: colors.transparent.white80,
    marginBottom: spacing[1],
  },
  promptAnswer: {
    fontSize: 14,
    color: colors.primary.white,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[6],
    paddingVertical: spacing[4],
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  nopeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.white,
    borderWidth: 2,
    borderColor: colors.semantic.error,
  },
  superLikeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary.white,
    borderWidth: 2,
    borderColor: colors.semantic.info,
  },
  likeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.gold,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: spacing[4],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    marginTop: spacing[2],
    textAlign: 'center',
  },
  expandButton: {
    marginTop: spacing[6],
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
  },
  expandButtonText: {
    color: colors.primary.navy,
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: spacing[4],
  },
  modalPhoto: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.5,
  },
  modalInfo: {
    padding: spacing[4],
  },
  modalName: {
    fontSize: 28,
    fontWeight: '700',
  },
  modalLocation: {
    fontSize: 15,
    marginTop: spacing[1],
  },
  modalBadge: {
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: spacing[2],
  },
  modalBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary.gold,
  },
  modalSection: {
    marginHorizontal: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  modalBio: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalPrompts: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  modalPromptCard: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },
  modalPromptQuestion: {
    fontSize: 13,
    marginBottom: spacing[1],
  },
  modalPromptAnswer: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaftaBadge: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modalSaftaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[6],
    paddingTop: spacing[4],
    paddingHorizontal: spacing[6],
  },
  modalActionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  modalPassButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.white,
    borderWidth: 2,
    borderColor: colors.semantic.error,
  },
  modalSuperButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary.white,
    borderWidth: 2,
    borderColor: colors.semantic.info,
  },
  modalLikeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.gold,
  },
});
