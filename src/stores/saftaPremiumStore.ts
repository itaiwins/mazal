/**
 * Safta Premium Store
 *
 * Manages Safta Pro subscription state and usage limits
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAFTA_FEATURE_LIMITS, DEV_BYPASS_PREMIUM } from '@/lib/config/revenuecat';

export type SaftaPlan = 'free' | 'safta_pro';

interface SaftaPremiumState {
  // Subscription state
  plan: SaftaPlan;
  isProSubscriber: boolean;

  // Daily usage tracking
  dailyRecommendationsRemaining: number;
  lastResetDate: string; // ISO date

  // Connection count (for free tier limit)
  connectionCount: number;

  // UI state
  showPaywall: boolean;
  paywallReason: string | null;

  // Actions
  setPlan: (plan: SaftaPlan) => void;
  useRecommendation: () => boolean;
  canRecommend: () => boolean;
  canAddConnection: () => boolean;
  incrementConnectionCount: () => void;
  setConnectionCount: (count: number) => void;
  resetDailyLimits: () => void;
  checkAndResetLimits: () => void;
  showPaywallModal: (reason?: string) => void;
  hidePaywallModal: () => void;
  getFeatureLimit: <K extends keyof typeof SAFTA_FEATURE_LIMITS.free>(feature: K) => typeof SAFTA_FEATURE_LIMITS.free[K];
  hasFeature: (feature: keyof typeof SAFTA_FEATURE_LIMITS.safta_pro) => boolean;
  reset: () => void;
}

const getDayStart = (): string => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
};

const initialState = {
  plan: (DEV_BYPASS_PREMIUM ? 'safta_pro' : 'free') as SaftaPlan,
  isProSubscriber: DEV_BYPASS_PREMIUM,
  dailyRecommendationsRemaining: DEV_BYPASS_PREMIUM ? Infinity : SAFTA_FEATURE_LIMITS.free.dailyRecommendations,
  lastResetDate: getDayStart(),
  connectionCount: 0,
  showPaywall: false,
  paywallReason: null,
};

export const useSaftaPremiumStore = create<SaftaPremiumState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPlan: (plan) => {
        const isPro = plan === 'safta_pro';
        const limits = isPro ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
        set({
          plan,
          isProSubscriber: isPro,
          dailyRecommendationsRemaining: limits.dailyRecommendations,
        });
      },

      useRecommendation: () => {
        const { dailyRecommendationsRemaining, isProSubscriber } = get();

        // Unlimited for pro users
        if (isProSubscriber) {
          return true;
        }

        if (dailyRecommendationsRemaining > 0) {
          set({ dailyRecommendationsRemaining: dailyRecommendationsRemaining - 1 });
          return true;
        }

        return false;
      },

      canRecommend: () => {
        const { dailyRecommendationsRemaining, isProSubscriber } = get();
        return isProSubscriber || dailyRecommendationsRemaining > 0;
      },

      canAddConnection: () => {
        const { connectionCount, isProSubscriber } = get();
        const limits = isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
        return limits.maxConnections === Infinity || connectionCount < limits.maxConnections;
      },

      incrementConnectionCount: () => {
        const { connectionCount } = get();
        set({ connectionCount: connectionCount + 1 });
      },

      setConnectionCount: (count) => set({ connectionCount: count }),

      resetDailyLimits: () => {
        const { isProSubscriber } = get();
        const limits = isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
        set({
          dailyRecommendationsRemaining: limits.dailyRecommendations,
          lastResetDate: getDayStart(),
        });
      },

      checkAndResetLimits: () => {
        const { lastResetDate } = get();
        const currentDayStart = getDayStart();

        // Check if we're in a new day
        if (lastResetDate !== currentDayStart) {
          get().resetDailyLimits();
        }
      },

      showPaywallModal: (reason) =>
        set({
          showPaywall: true,
          paywallReason: reason ?? null,
        }),

      hidePaywallModal: () =>
        set({
          showPaywall: false,
          paywallReason: null,
        }),

      getFeatureLimit: (feature) => {
        const { isProSubscriber } = get();
        const limits = isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
        return limits[feature] as any;
      },

      hasFeature: (feature) => {
        const { isProSubscriber } = get();
        const limits = isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
        return Boolean(limits[feature]);
      },

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-safta-premium-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        plan: state.plan,
        isProSubscriber: state.isProSubscriber,
        dailyRecommendationsRemaining: state.dailyRecommendationsRemaining,
        lastResetDate: state.lastResetDate,
        connectionCount: state.connectionCount,
      }),
    }
  )
);

// Selectors
export const selectIsSaftaPro = (state: SaftaPremiumState) => state.isProSubscriber;
export const selectCanRecommend = (state: SaftaPremiumState) =>
  state.isProSubscriber || state.dailyRecommendationsRemaining > 0;
export const selectRecommendationsRemaining = (state: SaftaPremiumState) =>
  state.isProSubscriber ? Infinity : state.dailyRecommendationsRemaining;
export const selectCanAddConnection = (state: SaftaPremiumState) => {
  const limits = state.isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
  return limits.maxConnections === Infinity || state.connectionCount < limits.maxConnections;
};
export const selectHasNotes = (state: SaftaPremiumState) => {
  const limits = state.isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
  return limits.canAddNotes;
};
export const selectHasAdvancedSearch = (state: SaftaPremiumState) => {
  const limits = state.isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
  return limits.hasAdvancedSearch;
};
export const selectHasAnalytics = (state: SaftaPremiumState) => {
  const limits = state.isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
  return limits.hasAnalytics;
};
export const selectHasVerifiedBadge = (state: SaftaPremiumState) => {
  const limits = state.isProSubscriber ? SAFTA_FEATURE_LIMITS.safta_pro : SAFTA_FEATURE_LIMITS.free;
  return limits.hasVerifiedBadge;
};
