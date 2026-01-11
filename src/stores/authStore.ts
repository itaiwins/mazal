/**
 * Auth Store
 *
 * Manages authentication state, session, and user data
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User as AuthUser } from '@supabase/supabase-js';
import type { User } from '@/types/database.types';

interface AuthState {
  // Auth state
  session: Session | null;
  authUser: AuthUser | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Computed
  isAuthenticated: boolean;
  isOnboardingComplete: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  setAuthUser: (user: AuthUser | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
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
  isAuthenticated: false,
  isOnboardingComplete: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSession: (session) =>
        set({
          session,
          authUser: session?.user ?? null,
          isAuthenticated: !!session,
        }),

      setAuthUser: (authUser) =>
        set({
          authUser,
          isAuthenticated: !!authUser,
        }),

      setUser: (user) =>
        set({
          user,
          isOnboardingComplete: user?.onboarding_complete ?? false,
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
        user: state.user,
        isOnboardingComplete: state.isOnboardingComplete,
      }),
    }
  )
);

// Selectors for common derived state
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectIsOnboardingComplete = (state: AuthState) => state.isOnboardingComplete;
export const selectIsLoading = (state: AuthState) => state.isLoading;
