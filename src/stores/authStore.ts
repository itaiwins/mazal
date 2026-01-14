/**
 * Auth Store
 *
 * Manages authentication state, session, and user data
 * Supports dual-mode: users can be both regular users AND Safta matchmakers
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User as AuthUser } from '@supabase/supabase-js';
import type { User } from '@/types/database.types';

// App mode - which view the user is currently in
export type AppMode = 'user' | 'safta';

interface AuthState {
  // Auth state
  session: Session | null;
  authUser: AuthUser | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Dual-mode support
  currentMode: AppMode; // Which mode they're currently viewing
  hasSaftaProfile: boolean; // Have they completed Safta onboarding?

  // Computed
  isAuthenticated: boolean;
  isOnboardingComplete: boolean;
  isSaftaMode: boolean; // Convenience getter for currentMode === 'safta'

  // Actions
  setSession: (session: Session | null) => void;
  setAuthUser: (user: AuthUser | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setCurrentMode: (mode: AppMode) => void;
  toggleMode: () => void;
  setHasSaftaProfile: (has: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  signOut: () => void;
  logout: () => void; // Alias for signOut
  reset: () => void;
}

const initialState = {
  session: null,
  authUser: null,
  user: null,
  isLoading: true,
  isInitialized: false,
  currentMode: 'user' as AppMode,
  hasSaftaProfile: false,
  isAuthenticated: false,
  isOnboardingComplete: false, // Default to false - user must complete onboarding
  isSaftaMode: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSession: (session) => {
        // Check if user has completed Safta onboarding from metadata
        const hasSaftaProfile = session?.user?.user_metadata?.safta_onboarding_complete === true;
        set({
          session,
          authUser: session?.user ?? null,
          isAuthenticated: !!session,
          hasSaftaProfile,
        });
      },

      setAuthUser: (authUser) => {
        const hasSaftaProfile = authUser?.user_metadata?.safta_onboarding_complete === true;
        set({
          authUser,
          isAuthenticated: !!authUser,
          hasSaftaProfile,
        });
      },

      setCurrentMode: (currentMode) =>
        set({
          currentMode,
          isSaftaMode: currentMode === 'safta',
        }),

      toggleMode: () => {
        const current = get().currentMode;
        const newMode = current === 'user' ? 'safta' : 'user';
        set({
          currentMode: newMode,
          isSaftaMode: newMode === 'safta',
        });
      },

      setHasSaftaProfile: (hasSaftaProfile) => set({ hasSaftaProfile }),

      setUser: (user) =>
        set({
          user,
          isOnboardingComplete: user?.onboarding_complete ?? false, // Must complete onboarding
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setInitialized: (isInitialized) => set({ isInitialized }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
          isOnboardingComplete: updates.onboarding_complete ?? state.isOnboardingComplete,
        })),

      signOut: () =>
        set({
          ...initialState,
          isLoading: false,
          isInitialized: true,
        }),

      // Alias for signOut
      logout: () =>
        set({
          ...initialState,
          isLoading: false,
          isInitialized: true,
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist these fields
        // Note: currentMode and isSaftaMode are NOT persisted
        // so the app always starts in 'user' mode
        user: state.user,
        isOnboardingComplete: state.isOnboardingComplete,
        hasSaftaProfile: state.hasSaftaProfile,
      }),
    }
  )
);

// Selectors for common derived state
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectIsOnboardingComplete = (state: AuthState) => state.isOnboardingComplete;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectCurrentMode = (state: AuthState) => state.currentMode;
export const selectIsSaftaMode = (state: AuthState) => state.isSaftaMode;
export const selectHasSaftaProfile = (state: AuthState) => state.hasSaftaProfile;
