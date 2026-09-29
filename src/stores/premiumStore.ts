/**
 * Premium Store
 *
 * Manages subscription state and premium features
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PremiumEntitlements, PremiumFeature, PremiumPlan } from '@/types';
import { FEATURE_LIMITS, DEV_BYPASS_PREMIUM } from '@/lib/config/revenuecat';

interface PremiumState {
  // Entitlements
  entitlements: PremiumEntitlements;

  // Offerings (from RevenueCat)
  offerings: Record<string, unknown> | null;

  // Weekly usage tracking
  superLikesRemaining: number;
  boostsRemaining: number;
  dailySwipesRemaining: number;
  weekStartDate: string; // ISO date of when the week started
  lastBoostTime: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  showPaywall: boolean;
  paywallReason: string | null;
  selectedPlan: 'gold' | 'platinum' | null;

  // Actions
  setEntitlements: (entitlements: PremiumEntitlements) => void;
  setOfferings: (offerings: Record<string, unknown> | null) => void;
  useSuperLike: () => boolean;
  restoreSuperLike: () => void;
  useBoost: () => boolean;
  useSwipe: () => boolean;
  resetWeeklyLimits: () => void;
  resetDailySwipes: () => void;
  checkAndResetLimits: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  showPaywallModal: (reason?: string, plan?: 'gold' | 'platinum') => void;
  hidePaywallModal: () => void;
  hasFeature: (feature: PremiumFeature) => boolean;
  getFeatureLimit: (feature: keyof typeof FEATURE_LIMITS.free) => number | boolean;
  reset: () => void;
}

const getWeekStart = (): string => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};

const getDayStart = (): string => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
};

// In DEV mode, grant all premium features
const devEntitlements: PremiumEntitlements = {
  isPremium: true,
  plan: 'mazal_platinum',
  features: ['unlimited_swipes', 'see_likes', 'super_likes', 'rewind', 'advanced_filters', 'read_receipts', 'boost', 'priority_likes', 'message_before_match', 'incognito', 'active_users'] as PremiumFeature[],
  superLikesRemaining: 999,
  boostsRemaining: 999,
};

const freeEntitlements: PremiumEntitlements = DEV_BYPASS_PREMIUM ? devEntitlements : {
  isPremium: false,
  plan: 'free',
  features: [],
  superLikesRemaining: 1,
  boostsRemaining: 0,
};

const initialState = {
  entitlements: freeEntitlements,
  offerings: null,
  superLikesRemaining: DEV_BYPASS_PREMIUM ? 999 : FEATURE_LIMITS.free.superLikesPerWeek,
  boostsRemaining: DEV_BYPASS_PREMIUM ? 999 : FEATURE_LIMITS.free.boostsPerWeek,
  dailySwipesRemaining: DEV_BYPASS_PREMIUM ? Infinity : FEATURE_LIMITS.free.dailySwipes,
  weekStartDate: getWeekStart(),
  lastBoostTime: null,
  isLoading: false,
  error: null,
  showPaywall: false,
  paywallReason: null,
  selectedPlan: null as 'gold' | 'platinum' | null,
};

export const usePremiumStore = create<PremiumState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setEntitlements: (entitlements) => {
        const plan = entitlements.plan as keyof typeof FEATURE_LIMITS;
        const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
        set({
          entitlements,
          superLikesRemaining: limits.superLikesPerWeek,
          boostsRemaining: limits.boostsPerWeek,
          dailySwipesRemaining: limits.dailySwipes,
        });
      },

      setOfferings: (offerings) => set({ offerings }),

      useSuperLike: () => {
        const { superLikesRemaining } = get();

        if (superLikesRemaining > 0) {
          set({ superLikesRemaining: superLikesRemaining - 1 });
          return true;
        }

        return false;
      },

      // Rewind gives a Super Like back (MEXA-372). `undo_last_swipe()` deletes the `swipes`
      // row, so the Super Like it was spent on no longer exists - keeping the charge would
      // burn one of Gold/Platinum's five weekly Super Likes on a swipe nobody can see. The
      // daily swipe counter needs no equivalent: Rewind is Gold/Platinum only and both have
      // `dailySwipes: Infinity`, so `useSwipe()` never decremented anything for them.
      //
      // Written as "refuse at the cap" rather than `Math.min(n + 1, cap)` on purpose. A
      // DEV_BYPASS_PREMIUM build starts at 999 with the platinum cap of 5, and clamping
      // would quietly cut it down to 5 on the first rewind. This can only ever raise the
      // counter, never lower it.
      restoreSuperLike: () => {
        const { superLikesRemaining, entitlements } = get();
        const plan = entitlements.plan as keyof typeof FEATURE_LIMITS;
        const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;

        if (superLikesRemaining >= limits.superLikesPerWeek) {
          return;
        }

        set({ superLikesRemaining: superLikesRemaining + 1 });
      },

      useSwipe: () => {
        const { dailySwipesRemaining, entitlements } = get();
        const plan = entitlements.plan as keyof typeof FEATURE_LIMITS;
        const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;

        // Unlimited swipes for premium
        if (limits.dailySwipes === Infinity) {
          return true;
        }

        if (dailySwipesRemaining > 0) {
          set({ dailySwipesRemaining: dailySwipesRemaining - 1 });
          return true;
        }

        return false;
      },

      useBoost: () => {
        const { boostsRemaining, lastBoostTime } = get();

        // Check if boost is on cooldown (can only boost once per 30 min)
        if (lastBoostTime) {
          const timeSinceLastBoost = Date.now() - new Date(lastBoostTime).getTime();
          if (timeSinceLastBoost < 30 * 60 * 1000) {
            return false;
          }
        }

        if (boostsRemaining > 0) {
          set({
            boostsRemaining: boostsRemaining - 1,
            lastBoostTime: new Date().toISOString(),
          });
          return true;
        }

        return false;
      },

      resetWeeklyLimits: () => {
        const { entitlements } = get();
        const plan = entitlements.plan as keyof typeof FEATURE_LIMITS;
        const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
        set({
          superLikesRemaining: limits.superLikesPerWeek,
          boostsRemaining: limits.boostsPerWeek,
          weekStartDate: getWeekStart(),
        });
      },

      resetDailySwipes: () => {
        const { entitlements } = get();
        const plan = entitlements.plan as keyof typeof FEATURE_LIMITS;
        const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
        set({
          dailySwipesRemaining: limits.dailySwipes,
        });
      },

      checkAndResetLimits: () => {
        const { weekStartDate } = get();
        const currentWeekStart = getWeekStart();

        // Check if we're in a new week
        if (weekStartDate !== currentWeekStart) {
          get().resetWeeklyLimits();
        }
      },

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      showPaywallModal: (reason, plan) =>
        set({
          showPaywall: true,
          paywallReason: reason ?? null,
          selectedPlan: plan ?? null,
        }),

      hidePaywallModal: () =>
        set({
          showPaywall: false,
          paywallReason: null,
          selectedPlan: null,
        }),

      hasFeature: (feature) => {
        const { entitlements } = get();
        return entitlements.features.includes(feature);
      },

      getFeatureLimit: (feature) => {
        const { entitlements } = get();
        const plan = entitlements.plan as keyof typeof FEATURE_LIMITS;
        const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
        return limits[feature] as any;
      },

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-premium-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        superLikesRemaining: state.superLikesRemaining,
        boostsRemaining: state.boostsRemaining,
        dailySwipesRemaining: state.dailySwipesRemaining,
        weekStartDate: state.weekStartDate,
        lastBoostTime: state.lastBoostTime,
      }),
      // A build with DEV_BYPASS_PREMIUM on persists unlimited counters, and JSON turns
      // Infinity into null. Rehydrating those into a build that gates for real would
      // either hand out premium limits (999 Super Likes) or, for null, lock the user out
      // at zero swipes, since `null > 0` is false. Clamp anything persisted to this
      // build's free-tier limits. `entitlements` is not persisted, so a real subscriber
      // is unaffected: RevenueCat reports on launch and setEntitlements raises the caps.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PremiumState>;
        const merged = { ...current, ...saved };

        if (DEV_BYPASS_PREMIUM) {
          return merged;
        }

        const clamp = (value: unknown, max: number) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0
            ? Math.min(value, max)
            : max;

        return {
          ...merged,
          superLikesRemaining: clamp(
            saved.superLikesRemaining,
            FEATURE_LIMITS.free.superLikesPerWeek
          ),
          boostsRemaining: clamp(saved.boostsRemaining, FEATURE_LIMITS.free.boostsPerWeek),
          dailySwipesRemaining: clamp(
            saved.dailySwipesRemaining,
            FEATURE_LIMITS.free.dailySwipes
          ),
        };
      },
    }
  )
);

// Selectors
export const selectIsPremium = (state: PremiumState) => state.entitlements.isPremium;
export const selectPlan = (state: PremiumState) => state.entitlements.plan;
export const selectCanSuperLike = (state: PremiumState) => state.superLikesRemaining > 0;
export const selectCanSwipe = (state: PremiumState) => {
  const plan = state.entitlements.plan as keyof typeof FEATURE_LIMITS;
  const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
  return limits.dailySwipes === Infinity || state.dailySwipesRemaining > 0;
};
export const selectCanBoost = (state: PremiumState) => {
  if (state.boostsRemaining <= 0) return false;
  if (!state.lastBoostTime) return true;
  const timeSinceLastBoost = Date.now() - new Date(state.lastBoostTime).getTime();
  return timeSinceLastBoost >= 30 * 60 * 1000;
};
export const selectCanSeeLikes = (state: PremiumState) => {
  const plan = state.entitlements.plan as keyof typeof FEATURE_LIMITS;
  const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
  return limits.canSeeLikes;
};
export const selectCanRewind = (state: PremiumState) => {
  const plan = state.entitlements.plan as keyof typeof FEATURE_LIMITS;
  const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
  return limits.canRewind;
};
export const selectHasReadReceipts = (state: PremiumState) => {
  const plan = state.entitlements.plan as keyof typeof FEATURE_LIMITS;
  const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
  return limits.hasReadReceipts;
};
export const selectCanMessageBeforeMatch = (state: PremiumState) => {
  const plan = state.entitlements.plan as keyof typeof FEATURE_LIMITS;
  const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.free;
  return limits.canMessageBeforeMatch;
};
