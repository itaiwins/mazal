/**
 * Paywall Prompt Modal
 *
 * A global modal that shows when premium features are accessed
 * without a subscription. Prompts user to upgrade.
 */

import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { usePremiumStore } from '@/stores/premiumStore';
import { StarOfDavid } from '@/components/icons/StarOfDavid';
import { FEATURE_WHO_LIKES_YOU } from '@/lib/config/features';

// Feature icons and descriptions for common paywall triggers
const FEATURE_INFO: Record<string, { icon: string; title: string; description: string }> = {
  see_likes: {
    icon: 'heart',
    title: 'See Who Likes You',
    description: 'Unlock the ability to see everyone who has liked your profile.',
  },
  super_likes: {
    icon: 'star',
    title: 'Super Likes',
    description: 'Stand out from the crowd and let them know you\'re interested.',
  },
  rewind: {
    icon: 'refresh',
    title: 'Rewind',
    description: 'Accidentally swiped left? Go back and give them another chance.',
  },
  boost: {
    icon: 'rocket',
    title: 'Profile Boost',
    description: 'Get seen by more people and increase your chances of matching.',
  },
  map_profiles: {
    icon: 'map',
    title: 'Map Discovery',
    description: 'Browse and interact with profiles directly on the map.',
  },
  unlimited_swipes: {
    icon: 'infinite',
    title: 'Unlimited Swipes',
    description: 'Remove daily limits and swipe as much as you want.',
  },
};

export function PaywallPromptModal() {
  const showPaywall = usePremiumStore((s) => s.showPaywall);
  const paywallReason = usePremiumStore((s) => s.paywallReason);
  const selectedPlan = usePremiumStore((s) => s.selectedPlan);
  const hidePaywallModal = usePremiumStore((s) => s.hidePaywallModal);

  // Get feature info based on reason if available.
  //
  // `super` is tested before `like`, which is a fix rather than tidying (MEXA-315). Every
  // Super Like prompt in the app reads "You've used all your Super Likes this week!", which
  // contains "like" - so the old order matched `see_likes` first and this modal offered
  // "See Who Likes You / Unlock the ability to see everyone who has liked your profile" to
  // somebody who had simply run out of Super Likes. The modal's one job is to name the
  // feature the user just hit, and it was naming a different one.
  //
  // `see_likes` also has to clear the feature flag: it is the only entry here whose feature
  // can be switched off, and offering to unlock something the build cannot deliver is the
  // thing MEXA-315 was filed about.
  const reason = paywallReason?.toLowerCase();
  const featureKey = !reason
    ? null
    : reason.includes('super') ? 'super_likes'
    : reason.includes('rewind') ? 'rewind'
    : reason.includes('boost') ? 'boost'
    : reason.includes('map') ? 'map_profiles'
    : reason.includes('swipe') ? 'unlimited_swipes'
    : reason.includes('like') && FEATURE_WHO_LIKES_YOU ? 'see_likes'
    : null;

  const featureInfo = featureKey ? FEATURE_INFO[featureKey] : null;

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    hidePaywallModal();
    // Navigate to premium with pre-selected plan if available
    router.push({
      pathname: '/premium',
      params: selectedPlan ? { plan: selectedPlan } : undefined,
    });
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    hidePaywallModal();
  };

  if (!showPaywall) return null;

  return (
    <Modal
      visible={showPaywall}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <Animated.View
          entering={SlideInDown.springify().damping(15)}
          exiting={SlideOutDown.springify()}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={[colors.dark.elevated, colors.dark.card]}
            style={styles.modal}
          >
            {/* Close button */}
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.transparent.white60} />
            </Pressable>

            {/* Icon */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[colors.primary.gold, '#B8860B']}
                style={styles.iconGradient}
              >
                <Ionicons
                  name={featureInfo?.icon as any || 'diamond'}
                  size={36}
                  color={colors.primary.navy}
                />
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={styles.title}>
              {featureInfo?.title || 'Premium Feature'}
            </Text>

            {/* Description */}
            <Text style={styles.description}>
              {paywallReason || featureInfo?.description || 'Upgrade to unlock this premium feature and get the most out of Mazal.'}
            </Text>

            {/* Plan badge */}
            <View style={styles.planBadge}>
              <StarOfDavid size={14} color={colors.primary.gold} />
              <Text style={styles.planBadgeText}>
                {selectedPlan === 'platinum' ? 'Mazal Platinum' : 'Mazal Gold+'}
              </Text>
            </View>

            {/* Upgrade button */}
            <Pressable
              style={({ pressed }) => [
                styles.upgradeButton,
                pressed && styles.upgradeButtonPressed,
              ]}
              onPress={handleUpgrade}
            >
              <LinearGradient
                colors={[colors.primary.gold, '#B8860B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeButtonGradient}
              >
                <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.primary.navy} />
              </LinearGradient>
            </Pressable>

            {/* Maybe later button */}
            <Pressable style={styles.laterButton} onPress={handleClose}>
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 340,
  },
  modal: {
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    padding: spacing[1],
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: spacing[4],
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 15,
    color: colors.transparent.white70,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[4],
    paddingHorizontal: spacing[2],
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.transparent.gold10,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    marginBottom: spacing[4],
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  upgradeButton: {
    width: '100%',
    marginBottom: spacing[3],
  },
  upgradeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
  },
  upgradeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  laterButton: {
    paddingVertical: spacing[2],
  },
  laterButtonText: {
    fontSize: 15,
    color: colors.transparent.white50,
  },
});

export default PaywallPromptModal;
