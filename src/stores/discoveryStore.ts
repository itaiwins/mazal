/**
 * Discovery Store
 *
 * Manages discovery/swiping state and filters
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiscoveryUser } from '@/types/user.types';
import type { DiscoveryFilters } from '@/types';

interface DiscoveryState {
  // Card deck
  profiles: DiscoveryUser[];
  currentIndex: number;
  isAnimating: boolean;

  // Filters
  filters: DiscoveryFilters;

  // Usage tracking
  likesUsedToday: number;
  superLikesUsedToday: number;
  lastLikeReset: string;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setProfiles: (profiles: DiscoveryUser[]) => void;
  addProfiles: (profiles: DiscoveryUser[]) => void;
  nextCard: () => void;
  previousCard: () => void;
  setCurrentIndex: (index: number) => void;
  setAnimating: (isAnimating: boolean) => void;
  setFilters: (filters: Partial<DiscoveryFilters>) => void;
  resetFilters: () => void;
  incrementLike: () => void;
  incrementSuperLike: () => void;
  resetDailyLimits: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultFilters: DiscoveryFilters = {
  age_min: 22,
  age_max: 35,
  distance_max_miles: 25,
  gender_preference: [],
  jewish_backgrounds: [],
  observance_levels: [],
  partner_must_be_jewish: null,
};

const initialState = {
  profiles: [],
  currentIndex: 0,
  isAnimating: false,
  filters: defaultFilters,
  likesUsedToday: 0,
  superLikesUsedToday: 0,
  lastLikeReset: new Date().toDateString(),
  isLoading: false,
  error: null,
};

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProfiles: (profiles) => set({ profiles, currentIndex: 0 }),

      addProfiles: (newProfiles) =>
        set((state) => ({
          profiles: [...state.profiles, ...newProfiles],
        })),

      nextCard: () =>
        set((state) => ({
          currentIndex: Math.min(state.currentIndex + 1, state.profiles.length),
        })),

      previousCard: () =>
        set((state) => ({
          currentIndex: Math.max(state.currentIndex - 1, 0),
        })),

      setCurrentIndex: (currentIndex) => set({ currentIndex }),

      setAnimating: (isAnimating) => set({ isAnimating }),

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      resetFilters: () => set({ filters: defaultFilters }),

      incrementLike: () => {
        const today = new Date().toDateString();
        set((state) => ({
          likesUsedToday: state.lastLikeReset === today ? state.likesUsedToday + 1 : 1,
          lastLikeReset: today,
        }));
      },

      incrementSuperLike: () => {
        const today = new Date().toDateString();
        set((state) => ({
          superLikesUsedToday: state.lastLikeReset === today ? state.superLikesUsedToday + 1 : 1,
          lastLikeReset: today,
        }));
      },

      resetDailyLimits: () =>
        set({
          likesUsedToday: 0,
          superLikesUsedToday: 0,
          lastLikeReset: new Date().toDateString(),
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-discovery-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        filters: state.filters,
        likesUsedToday: state.likesUsedToday,
        superLikesUsedToday: state.superLikesUsedToday,
        lastLikeReset: state.lastLikeReset,
      }),
    }
  )
);

// Selectors
export const selectCurrentProfile = (state: DiscoveryState) =>
  state.profiles[state.currentIndex];
export const selectHasMoreProfiles = (state: DiscoveryState) =>
  state.currentIndex < state.profiles.length;
export const selectRemainingProfiles = (state: DiscoveryState) =>
  state.profiles.length - state.currentIndex;
