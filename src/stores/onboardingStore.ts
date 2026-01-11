/**
 * Onboarding Store
 *
 * Manages onboarding flow state and profile draft
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingData, PhotoUpload, PromptAnswer } from '@/types/user.types';
import type { Gender, JewishBackground, ObservanceLevel, LookingFor, WantsChildren } from '@/types/database.types';

interface OnboardingState {
  // Current step
  currentStep: number;
  totalSteps: number;

  // Draft profile data
  data: OnboardingData;

  // Validation
  stepErrors: Record<number, string[]>;
  isSubmitting: boolean;

  // Actions - Navigation
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;

  // Actions - Data updates
  updateBasics: (data: {
    first_name?: string;
    date_of_birth?: Date | null;
    gender?: Gender | null;
    gender_preference?: Gender[];
  }) => void;

  updatePhotos: (photos: PhotoUpload[]) => void;
  addPhoto: (photo: PhotoUpload) => void;
  removePhoto: (id: string) => void;
  reorderPhotos: (photos: PhotoUpload[]) => void;
  updatePhotoProgress: (id: string, progress: number, uploadedUrl?: string) => void;

  updateJewishIdentity: (data: {
    jewish_background?: JewishBackground | null;
    additional_backgrounds?: JewishBackground[];
    observance_level?: ObservanceLevel | null;
    keeps_shabbat?: string | null;
    keeps_kosher?: string | null;
    synagogue_attendance?: string | null;
    jewish_education?: string | null;
  }) => void;

  updateLocation: (data: {
    current_latitude?: number | null;
    current_longitude?: number | null;
    current_city?: string | null;
    current_state?: string | null;
    current_country?: string | null;
  }) => void;

  updateEducation: (data: {
    education?: string | null;
    school?: string | null;
    occupation?: string | null;
    company?: string | null;
  }) => void;

  updateLifestyle: (data: {
    height_cm?: number | null;
  }) => void;

  updateRelationshipGoals: (data: {
    looking_for?: LookingFor | null;
    wants_children?: WantsChildren | null;
    partner_must_be_jewish?: boolean;
    raise_children_jewish?: boolean;
    willing_to_relocate?: boolean;
  }) => void;

  updateBioPrompts: (data: {
    bio?: string;
    prompts?: PromptAnswer[];
  }) => void;

  updateBadges: (badges: string[]) => void;

  // Validation
  setStepErrors: (step: number, errors: string[]) => void;
  clearStepErrors: (step: number) => void;
  validateStep: (step: number) => boolean;

  // Submission
  setSubmitting: (isSubmitting: boolean) => void;

  // Reset
  reset: () => void;
}

const initialData: OnboardingData = {
  // Basics
  first_name: '',
  date_of_birth: null,
  gender: null,
  gender_preference: [],

  // Photos
  photos: [],

  // Jewish Identity
  jewish_background: null,
  additional_backgrounds: [],
  observance_level: null,
  keeps_shabbat: null,
  keeps_kosher: null,
  synagogue_attendance: null,
  jewish_education: null,

  // Location
  current_latitude: null,
  current_longitude: null,
  current_city: null,
  current_state: null,
  current_country: null,

  // Education & Career
  education: null,
  school: null,
  occupation: null,
  company: null,

  // Lifestyle
  height_cm: null,

  // Relationship Goals
  looking_for: null,
  wants_children: null,
  partner_must_be_jewish: true,
  raise_children_jewish: true,
  willing_to_relocate: false,

  // Bio & Prompts
  bio: '',
  prompts: [],

  // Badges
  selectedBadges: [],
};

const initialState = {
  currentStep: 0,
  totalSteps: 13,
  data: initialData,
  stepErrors: {},
  isSubmitting: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, state.totalSteps - 1),
        })),

      previousStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),

      goToStep: (step) =>
        set({
          currentStep: Math.max(0, Math.min(step, get().totalSteps - 1)),
        }),

      updateBasics: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),

      updatePhotos: (photos) =>
        set((state) => ({
          data: { ...state.data, photos },
        })),

      addPhoto: (photo) =>
        set((state) => ({
          data: {
            ...state.data,
            photos: [...(state.data.photos || []), photo],
          },
        })),

      removePhoto: (id) =>
        set((state) => ({
          data: {
            ...state.data,
            photos: (state.data.photos || []).filter((p) => p.id !== id),
          },
        })),

      reorderPhotos: (photos) =>
        set((state) => ({
          data: { ...state.data, photos },
        })),

      updatePhotoProgress: (id, progress, uploadedUrl) =>
        set((state) => ({
          data: {
            ...state.data,
            photos: (state.data.photos || []).map((p) =>
              p.id === id
                ? { ...p, uploadProgress: progress, uploadedUrl: uploadedUrl ?? p.uploadedUrl }
                : p
            ),
          },
        })),

      updateJewishIdentity: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),

      updateLocation: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),

      updateEducation: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),

      updateLifestyle: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),

      updateRelationshipGoals: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),

      updateBioPrompts: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),

      updateBadges: (selectedBadges) =>
        set((state) => ({
          data: { ...state.data, selectedBadges },
        })),

      setStepErrors: (step, errors) =>
        set((state) => ({
          stepErrors: { ...state.stepErrors, [step]: errors },
        })),

      clearStepErrors: (step) =>
        set((state) => {
          const { [step]: _, ...rest } = state.stepErrors;
          return { stepErrors: rest };
        }),

      validateStep: (step) => {
        const { data } = get();
        const errors: string[] = [];

        switch (step) {
          case 0: // Welcome - no validation
            break;
          case 1: // Basics
            if (!data.first_name?.trim()) errors.push('Name is required');
            if (!data.date_of_birth) errors.push('Birthday is required');
            if (!data.gender) errors.push('Gender is required');
            if ((data.gender_preference || []).length === 0) errors.push('Select who you\'re interested in');
            break;
          case 2: // Photos
            if ((data.photos || []).length < 2) errors.push('Add at least 2 photos');
            break;
          case 3: // Jewish Identity
            if (!data.jewish_background) errors.push('Select your Jewish background');
            break;
          case 4: // Location
            if (!data.current_city) errors.push('Location is required');
            break;
          // Other steps are optional
        }

        if (errors.length > 0) {
          set((state) => ({
            stepErrors: { ...state.stepErrors, [step]: errors },
          }));
          return false;
        }

        return true;
      },

      setSubmitting: (isSubmitting) => set({ isSubmitting }),

      reset: () => set(initialState),
    }),
    {
      name: 'mazal-onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        data: state.data,
      }),
    }
  )
);

// Selectors
export const selectProgress = (state: OnboardingState) =>
  ((state.currentStep + 1) / state.totalSteps) * 100;

export const selectIsLastStep = (state: OnboardingState) =>
  state.currentStep === state.totalSteps - 1;

export const selectIsFirstStep = (state: OnboardingState) =>
  state.currentStep === 0;
