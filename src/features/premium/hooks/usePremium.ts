/**
 * Premium Hooks
 *
 * React hooks for premium features and subscriptions
 */

import { useEffect, useCallback } from 'react';
import { PurchasesPackage } from 'react-native-purchases';
import { usePremiumStore } from '@/stores/premiumStore';
import {
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  hasEntitlement,
  ENTITLEMENTS,
} from '@/lib/config/revenuecat';
import type { PremiumFeature, PremiumEntitlements, PremiumPlan } from '@/types';

/**
 * Map RevenueCat entitlements to app entitlements
 */
function mapCustomerToEntitlements(
  hasGold: boolean,
  hasPlatinum: boolean
): PremiumEntitlements {
  if (hasPlatinum) {
    return {
      isPremium: true,
      plan: 'mazal_platinum',
      features: [
        'see_likes',
        'unlimited_swipes',
        'super_likes',
        'rewind',
        'boost',
        'advanced_filters',
        'read_receipts',
        'priority_likes',
      ],
      superLikesRemaining: Infinity,
      boostsRemaining: 1,
    };
  }

  if (hasGold) {
    return {
      isPremium: true,
      plan: 'mazal_gold',
      features: [
        'see_likes',
        'unlimited_swipes',
        'super_likes',
        'rewind',
      ],
      superLikesRemaining: 5,
      boostsRemaining: 0,
    };
  }

  return {
    isPremium: false,
    plan: 'free',
    features: [],
    superLikesRemaining: 1,
    boostsRemaining: 0,
  };
}

/**
 * Hook to access premium state and actions
 */
export function usePremium() {
  const entitlements = usePremiumStore((s) => s.entitlements);
  const offerings = usePremiumStore((s) => s.offerings);
  const isLoading = usePremiumStore((s) => s.isLoading);
  const setEntitlements = usePremiumStore((s) => s.setEntitlements);
  const setOfferings = usePremiumStore((s) => s.setOfferings);
  const setLoading = usePremiumStore((s) => s.setLoading);

  // Load customer info on mount
  useEffect(() => {
    loadCustomerInfo();
  }, []);

  const loadCustomerInfo = useCallback(async () => {
    setLoading(true);
    try {
      const [hasGold, hasPlatinum, availablePackages] = await Promise.all([
        hasEntitlement(ENTITLEMENTS.GOLD),
        hasEntitlement(ENTITLEMENTS.PLATINUM),
        getOfferings(),
      ]);

      const newEntitlements = mapCustomerToEntitlements(hasGold, hasPlatinum);
      setEntitlements(newEntitlements);
      setOfferings({ packages: availablePackages });
    } catch (error) {
      console.error('Failed to load customer info:', error);
    } finally {
      setLoading(false);
    }
  }, [setEntitlements, setOfferings, setLoading]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setLoading(true);
      try {
        const customerInfo = await purchasePackage(pkg);
        if (customerInfo) {
          await loadCustomerInfo();
          return true;
        }
        return false;
      } catch (error) {
        console.error('Purchase failed:', error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, loadCustomerInfo]
  );

  const restore = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      await restorePurchases();
      await loadCustomerInfo();
      return true;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, loadCustomerInfo]);

  // Derived values
  const isGold = entitlements.plan === 'mazal_gold' || entitlements.plan === 'mazal_platinum';
  const isPlatinum = entitlements.plan === 'mazal_platinum';
  const packages = (offerings?.packages as PurchasesPackage[]) || [];

  return {
    // Entitlement state
    entitlements,
    isGold,
    isPlatinum,
    isPremium: entitlements.isPremium,
    plan: entitlements.plan,

    // UI state
    isLoading,
    packages,

    // Actions
    purchase,
    restore,
    refresh: loadCustomerInfo,
  };
}

/**
 * Hook to check if a specific feature is available
 */
export function useFeatureGate(feature: PremiumFeature): boolean {
  const entitlements = usePremiumStore((s) => s.entitlements);
  return entitlements.features.includes(feature);
}

/**
 * Hook to get remaining super likes
 */
export function useSuperLikes() {
  const superLikesRemaining = usePremiumStore((s) => s.superLikesRemaining);
  const useSuperLike = usePremiumStore((s) => s.useSuperLike);
  const entitlements = usePremiumStore((s) => s.entitlements);

  const isPlatinum = entitlements.plan === 'mazal_platinum';
  const isGold = entitlements.plan === 'mazal_gold';

  // Platinum: unlimited, Gold: 5, Free: 1
  const maxSuperLikes = isPlatinum ? Infinity : isGold ? 5 : 1;

  return {
    remaining: isPlatinum ? Infinity : superLikesRemaining,
    max: maxSuperLikes,
    canUseSuperLike: isPlatinum || superLikesRemaining > 0,
    useSuperLike,
  };
}

/**
 * Hook to check swipe limits
 */
export function useSwipeLimits() {
  const entitlements = usePremiumStore((s) => s.entitlements);

  const isPremium = entitlements.isPremium;

  // Premium users have unlimited swipes
  // Free users would need swipe tracking (not currently implemented in store)
  // For now, all users can swipe (free users get limited per day server-side)

  return {
    remaining: isPremium ? Infinity : 50, // Default for free tier
    max: isPremium ? Infinity : 50,
    isUnlimited: isPremium,
    canSwipe: true, // Checked server-side
  };
}

/**
 * Hook to get boost state
 */
export function useBoost() {
  const boostsRemaining = usePremiumStore((s) => s.boostsRemaining);
  const lastBoostTime = usePremiumStore((s) => s.lastBoostTime);
  const useBoostAction = usePremiumStore((s) => s.useBoost);
  const entitlements = usePremiumStore((s) => s.entitlements);

  // Check if boost is on cooldown (30 min)
  const isOnCooldown = lastBoostTime
    ? Date.now() - new Date(lastBoostTime).getTime() < 30 * 60 * 1000
    : false;

  const cooldownRemaining = isOnCooldown && lastBoostTime
    ? Math.max(0, 30 * 60 * 1000 - (Date.now() - new Date(lastBoostTime).getTime()))
    : 0;

  return {
    remaining: boostsRemaining,
    canBoost: boostsRemaining > 0 && !isOnCooldown,
    isOnCooldown,
    cooldownRemaining,
    useBoost: useBoostAction,
    isPlatinum: entitlements.plan === 'mazal_platinum',
  };
}

/**
 * Hook to show paywall
 */
export function usePaywall() {
  const showPaywall = usePremiumStore((s) => s.showPaywall);
  const paywallReason = usePremiumStore((s) => s.paywallReason);
  const showPaywallModal = usePremiumStore((s) => s.showPaywallModal);
  const hidePaywallModal = usePremiumStore((s) => s.hidePaywallModal);

  return {
    isVisible: showPaywall,
    reason: paywallReason,
    show: showPaywallModal,
    hide: hidePaywallModal,
  };
}
