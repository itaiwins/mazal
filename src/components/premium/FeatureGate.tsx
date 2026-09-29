/**
 * Feature Gate Component
 *
 * Wraps content that requires premium access
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useFeatureGate } from '@/features/premium/hooks/usePremium';
import { FEATURE_WHO_LIKES_YOU } from '@/lib/config/features';
import type { PremiumFeature } from '@/types';

/**
 * The upgrade banner's one-line pitch.
 *
 * It led with "See who likes you" while nothing behind that feature had ever been built
 * (MEXA-315), so the headline claim on the most-seen premium surface in the app was the one
 * thing Gold did not do. It goes behind the same flag as the feature; with the flag off the
 * banner sells what the build actually ships.
 */
const UPGRADE_BANNER_SUBTITLE = FEATURE_WHO_LIKES_YOU
  ? 'See who likes you, unlimited swipes & more'
  : 'Unlimited swipes, Super Likes & more';

interface FeatureGateProps {
  feature: PremiumFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * Wraps content that requires premium access
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const hasAccess = useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return <UpgradePrompt feature={feature} />;
  }

  return null;
}

interface UpgradePromptProps {
  feature: PremiumFeature;
}

function UpgradePrompt({ feature }: UpgradePromptProps) {
  const theme = useTheme();

  const handleUpgrade = () => {
    router.push('/premium');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={24} color={colors.primary.gold} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Premium Feature
      </Text>
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
        Upgrade to Mazal Gold to unlock this feature
      </Text>
      <Pressable style={styles.button} onPress={handleUpgrade}>
        <Ionicons name="star" size={16} color={colors.primary.navy} />
        <Text style={styles.buttonText}>Upgrade</Text>
      </Pressable>
    </View>
  );
}

/**
 * Premium badge component
 */
export function PremiumBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Ionicons
        name="star"
        size={compact ? 10 : 12}
        color={colors.primary.navy}
      />
      {!compact && <Text style={styles.badgeText}>Premium</Text>}
    </View>
  );
}

/**
 * Upgrade banner for screens
 */
export function UpgradeBanner({ onPress }: { onPress?: () => void }) {
  const theme = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/premium');
    }
  };

  return (
    <Pressable
      style={[styles.banner, { backgroundColor: colors.dark.background }]}
      onPress={handlePress}
    >
      <View style={styles.bannerContent}>
        <Ionicons name="star" size={24} color={colors.primary.gold} />
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>Upgrade to Mazal Gold</Text>
          <Text style={styles.bannerSubtitle}>{UPGRADE_BANNER_SUBTITLE}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
    </Pressable>
  );
}

/**
 * Lock overlay for premium content
 */
export function PremiumLock({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature: PremiumFeature;
}) {
  const hasAccess = useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <View style={styles.lockContainer}>
      {children}
      <View style={styles.lockOverlay}>
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={20} color={colors.primary.white} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[6],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    gap: spacing[2],
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    gap: spacing[1],
  },
  badgeCompact: {
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[0.5],
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.navy,
    textTransform: 'uppercase',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: colors.transparent.white80,
    marginTop: spacing[0.5],
  },
  lockContainer: {
    position: 'relative',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.transparent.black40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.black60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
