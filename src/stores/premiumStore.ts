/**
 * Premium Store
 *
 * Manages subscription state and premium features
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PremiumEntitlements, PremiumFeature } from '@/types';

interface PremiumState {
  // Entitlements
  entitlements: PremiumEntitlements;

  // Offerings (from RevenueCat)
  offerings: Record<string, unknown> | null;

  // Usage
  superLikesRemaining: number;
  boostsRemaining: number;
  lastBoostTime: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  showPaywall: boolean;
  paywallReason: string | null;

  // Actions
  setEntitlements: (entitlements: PremiumEntitlements) => void;
  setOfferings: (offerings: Record<string, unknown> | null) => void;
  useSuperLike: () => boolean;
  useBoost: () => boolean;
  resetDailyLimits: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  showPaywallModal: (reason?: string) => void;
  hidePaywallModal: () => void;
  hasFeature: (feature: PremiumFeature) => boolean;
  reset: () => void;
}

const freeEntitlements: PremiumEntitlements = {
  isPremium: false,
  plan: 'free',
  features: [],
  superLikesRemaining: 1,
  boostsRemaining: 0,
};

const initialState = {
  entitlements: freeEntitlements,
  offerings: null,
  superLikesRemaining: 1,
  boostsRemaining: 0,
  lastBoostTime: null,
  isLoading: false,
  error: null,
  showPaywall: false,
  paywallReason: null,
};

export const usePremiumStore = create<PremiumState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setEntitlements: (entitlements) =>
        set({
          entitlements,
          superLikesRemaining: entitlements.superLikesRemaining,
          boostsRemaining: entitlements.boostsRemaining,
        }),

      setOfferings: (offerings) => set({ offerings }),

      useSuperLike: () => {
        const { superLikesRemaining, entitlements } = get();

        // Gold users have unlimited
        if (entitlements.plan === 'mazal_gold') {
          return true;
        }

        if (superLikesRemaining > 0) {
          set({ superLikesRemaining: superLikesRemaining - 1 });
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

      resetDailyLimits: () => {
        const { entitlements } = get();
        set({
          superLikesRemaining: entitlements.plan === 'mazal_platinum'
            ? Infinity
            : entitlements.plan === 'mazal_gold'
              ? 5
              : 1,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

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

      hasFeature: (feature) => {
        const { entitlements } = get();
        return entitlements.features.includes(feature);
      },

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-premium-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        superLikesRemaining: state.superLikesRemaining,
        boostsRemaining: state.boostsRemaining,
        lastBoostTime: state.lastBoostTime,
      }),
    }
  )
);

// Selectors
export const selectIsPremium = (state: PremiumState) => state.entitlements.isPremium;
export const selectPlan = (state: PremiumState) => state.entitlements.plan;
export const selectCanSuperLike = (state: PremiumState) =>
  state.entitlements.plan === 'mazal_gold' || state.superLikesRemaining > 0;
export const selectCanBoost = (state: PremiumState) => {
  if (state.boostsRemaining <= 0) return false;
  if (!state.lastBoostTime) return true;
  const timeSinceLastBoost = Date.now() - new Date(state.lastBoostTime).getTime();
  return timeSinceLastBoost >= 30 * 60 * 1000;
};
