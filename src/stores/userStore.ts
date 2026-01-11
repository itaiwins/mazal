/**
 * User Store
 *
 * Manages user profile data and preferences
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, UserPreferences } from '@/types/user.types';
import type { UserPhoto, UserPrompt, UserBadge } from '@/types/database.types';

interface UserState {
  // Profile data
  profile: UserProfile | null;
  photos: UserPhoto[];
  prompts: UserPrompt[];
  badges: UserBadge[];

  // Preferences
  preferences: UserPreferences;

  // UI state
  isProfileLoading: boolean;
  profileError: string | null;

  // Actions
  setProfile: (profile: UserProfile | null) => void;
  setPhotos: (photos: UserPhoto[]) => void;
  setPrompts: (prompts: UserPrompt[]) => void;
  setBadges: (badges: UserBadge[]) => void;
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addPhoto: (photo: UserPhoto) => void;
  removePhoto: (photoId: string) => void;
  reorderPhotos: (photos: UserPhoto[]) => void;
  setProfileLoading: (loading: boolean) => void;
  setProfileError: (error: string | null) => void;
  reset: () => void;
}

const defaultPreferences: UserPreferences = {
  age_min: 22,
  age_max: 35,
  distance_max_miles: 25,
  gender_preference: [],
  jewish_backgrounds: [],
  observance_levels: [],
  partner_must_be_jewish: true,
  raise_children_jewish: true,
};

const initialState = {
  profile: null,
  photos: [],
  prompts: [],
  badges: [],
  preferences: defaultPreferences,
  isProfileLoading: false,
  profileError: null,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProfile: (profile) =>
        set({
          profile,
          photos: profile?.photos ?? [],
          prompts: profile?.prompts ?? [],
          badges: profile?.badges ?? [],
        }),

      setPhotos: (photos) => set({ photos }),

      setPrompts: (prompts) => set({ prompts }),

      setBadges: (badges) => set({ badges }),

      setPreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      updateProfile: (updates) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
        })),

      addPhoto: (photo) =>
        set((state) => ({
          photos: [...state.photos, photo].sort((a, b) => a.photo_order - b.photo_order),
        })),

      removePhoto: (photoId) =>
        set((state) => ({
          photos: state.photos.filter((p) => p.id !== photoId),
        })),

      reorderPhotos: (photos) => set({ photos }),

      setProfileLoading: (isProfileLoading) => set({ isProfileLoading }),

      setProfileError: (profileError) => set({ profileError }),

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);
