/**
 * Profile Story Component
 *
 * Main scrollable profile experience combining all sections
 */

import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

import { HeroPhoto, HERO_HEIGHT } from './HeroPhoto';
import { PhotoGallery } from './PhotoGallery';
import { PromptCard } from './PromptCard';
import { AboutSection } from './AboutSection';
import { JewishLife } from './JewishLife';
import { SaftaBadge } from './SaftaBadge';
import { ActionFooter } from './ActionFooter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Type for profile data
interface ProfilePhoto {
  id?: string;
  photo_url: string;
  photo_order?: number;
}

interface ProfilePrompt {
  id?: string;
  prompt_id: string;
  question?: string;
  answer: string;
}

interface ProfileData {
  id: string;
  first_name: string;
  age: number;
  current_city?: string;
  current_state?: string;
  distance?: number;
  bio?: string;
  height_cm?: number;
  occupation?: string;
  company?: string;
  education?: string;
  school?: string;
  jewish_background?: string;
  observance_level?: string;
  keeps_shabbat?: string;
  keeps_kosher?: string;
  synagogue_attendance?: string;
  wants_children?: string;
  partner_must_be_jewish?: boolean;
  raise_children_jewish?: boolean;
  is_verified?: boolean;
  photos: ProfilePhoto[];
  prompts: ProfilePrompt[];
  safta_approved_count?: number;
  safta_likes?: number;
}

interface LikedContent {
  type: 'photo' | 'prompt' | 'profile';
  id?: string;
  photoIndex?: number;
  promptId?: string;
  message?: string;
}

interface ProfileStoryProps {
  profile: ProfileData;
  onPass: () => void;
  onLike: (likedContent: LikedContent[]) => void;
  onSuperLike: () => void;
}

// Prompt question mapping
const PROMPT_QUESTIONS: Record<string, string> = {
  shabbat_looks_like: 'My Shabbat looks like...',
  jewish_food_take: 'Best Jewish food take:',
  bubbe_describes: 'My bubbe would describe me as...',
  favorite_holiday: 'Favorite Jewish holiday because...',
  hebrew_name: 'My Hebrew name is...',
  jewish_tradition: 'A Jewish tradition I love is...',
  geek_out_on: 'I geek out on...',
  friends_describe: 'My friends would say I\'m...',
  unusual_skill: 'An unusual skill I have:',
  controversial_opinion: 'My most controversial opinion:',
  way_to_heart: 'The way to my heart is...',
  ideal_date: 'My ideal first date:',
  looking_for: 'I\'m looking for someone who...',
  sunday_looks_like: 'A typical Sunday looks like...',
  cant_live_without: 'I can\'t live without...',
  currently_obsessed: 'Currently obsessed with:',
  after_work: 'After work you\'ll find me...',
  fun_fact: 'A fun fact about me:',
  most_spontaneous: 'Most spontaneous thing I\'ve done:',
  hidden_talent: 'My hidden talent:',
  weirdly_good_at: 'I\'m weirdly good at:',
};

export function ProfileStory({ profile, onPass, onLike, onSuperLike }: ProfileStoryProps) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [likedContent, setLikedContent] = useState<LikedContent[]>([]);

  // Get primary photo URL
  const primaryPhotoUrl = useMemo(() => {
    if (!profile.photos || profile.photos.length === 0) return null;
    const primary = profile.photos.find((p) => p.photo_order === 0) || profile.photos[0];
    return primary.photo_url;
  }, [profile.photos]);

  // Format photos for gallery
  const galleryPhotos = useMemo(() => {
    if (!profile.photos) return [];
    return profile.photos.map((p) => ({
      id: p.id,
      photo_url: p.photo_url,
      photo_order: p.photo_order,
    }));
  }, [profile.photos]);

  // Format prompts with questions
  const formattedPrompts = useMemo(() => {
    if (!profile.prompts) return [];
    return profile.prompts.map((p) => ({
      ...p,
      question: p.question || PROMPT_QUESTIONS[p.prompt_id] || 'My answer:',
    }));
  }, [profile.prompts]);

  // Location string
  const locationString = useMemo(() => {
    const parts = [profile.current_city, profile.current_state].filter(Boolean);
    return parts.join(', ') || 'Nearby';
  }, [profile.current_city, profile.current_state]);

  // Safta count
  const saftaCount = profile.safta_approved_count || profile.safta_likes || 0;

  // Check if user has liked something
  const hasLikedSomething = likedContent.length > 0;

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Like handlers
  const handleLikePhoto = useCallback((photoIndex: number) => {
    setLikedContent((prev) => {
      // Check if already liked
      if (prev.some((l) => l.type === 'photo' && l.photoIndex === photoIndex)) {
        return prev;
      }
      return [...prev, { type: 'photo', photoIndex }];
    });
  }, []);

  const handleLikeHeroPhoto = useCallback(() => {
    handleLikePhoto(0);
  }, [handleLikePhoto]);

  const handleLikePrompt = useCallback((promptId: string) => {
    setLikedContent((prev) => {
      if (prev.some((l) => l.type === 'prompt' && l.promptId === promptId)) {
        return prev;
      }
      return [...prev, { type: 'prompt', promptId }];
    });
  }, []);

  const handleReplyToPrompt = useCallback((promptId: string, message: string) => {
    setLikedContent((prev) => {
      // Update existing prompt like with message, or add new
      const existing = prev.find((l) => l.type === 'prompt' && l.promptId === promptId);
      if (existing) {
        return prev.map((l) =>
          l.type === 'prompt' && l.promptId === promptId
            ? { ...l, message }
            : l
        );
      }
      return [...prev, { type: 'prompt', promptId, message }];
    });
  }, []);

  const handlePass = useCallback(() => {
    setLikedContent([]);
    onPass();
  }, [onPass]);

  const handleLike = useCallback(() => {
    // If nothing specific was liked, like the profile
    const contentToSend = likedContent.length > 0
      ? likedContent
      : [{ type: 'profile' as const }];
    onLike(contentToSend);
    setLikedContent([]);
  }, [likedContent, onLike]);

  const handleSuperLike = useCallback(() => {
    // Bashert = "the one" - super like
    setLikedContent([]);
    onSuperLike();
  }, [onSuperLike]);

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 200 + insets.bottom }, // Space for action footer
        ]}
      >
        {/* Hero Photo */}
        <HeroPhoto
          photoUrl={primaryPhotoUrl}
          name={profile.first_name}
          age={profile.age}
          location={locationString}
          distance={profile.distance}
          jewishBackground={profile.jewish_background}
          isVerified={profile.is_verified}
          scrollY={scrollY}
          onLikePhoto={handleLikeHeroPhoto}
          onDoubleTap={handleLikeHeroPhoto}
          profileId={profile.id}
        />

        {/* Photo Gallery */}
        {galleryPhotos.length > 1 && (
          <PhotoGallery
            photos={galleryPhotos}
            onLikePhoto={handleLikePhoto}
          />
        )}

        {/* Prompts */}
        {formattedPrompts.map((prompt, index) => (
          <PromptCard
            key={prompt.id || prompt.prompt_id}
            promptId={prompt.prompt_id}
            question={prompt.question!}
            answer={prompt.answer}
            index={index}
            profileName={profile.first_name}
            onLike={handleLikePrompt}
            onReply={handleReplyToPrompt}
          />
        ))}

        {/* About Section */}
        <AboutSection
          bio={profile.bio}
          location={locationString}
          height={profile.height_cm}
          occupation={profile.occupation}
          company={profile.company}
          education={profile.education}
          school={profile.school}
        />

        {/* Jewish Life */}
        <JewishLife
          jewishBackground={profile.jewish_background}
          observanceLevel={profile.observance_level}
          keepsShabbat={profile.keeps_shabbat}
          keepsKosher={profile.keeps_kosher}
          synagogueAttendance={profile.synagogue_attendance}
          wantsChildren={profile.wants_children}
          partnerMustBeJewish={profile.partner_must_be_jewish}
          raiseChildrenJewish={profile.raise_children_jewish}
        />

        {/* Safta Badge */}
        <SaftaBadge
          approvalCount={saftaCount}
          // recommendation and saftaName would come from actual data
        />

        {/* Bottom padding indicator */}
        <View style={styles.endIndicator}>
          {/* Empty space to show profile end */}
        </View>
      </Animated.ScrollView>

      {/* Sticky Action Footer */}
      <ActionFooter
        scrollY={scrollY}
        onPass={handlePass}
        onLike={handleLike}
        onSuperLike={handleSuperLike}
        profileName={profile.first_name}
        hasLikedSomething={hasLikedSomething}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  endIndicator: {
    height: spacing[10],
  },
});
