/**
 * Shidduch Onboarding Store
 *
 * Stores all data collected during the shidduch resume building process
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for shidduch profile data
export interface ShidduchReference {
  type: string;
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  contactMethod?: string;
}

export interface Sibling {
  name: string;
  age: number;
  married: boolean;
  spouseOccupation?: string;
  children?: number;
}

// Creator type for who is creating the profile
export type CreatorType = 'self' | 'parent' | 'grandparent' | 'uncle' | 'aunt' | 'shadchan';

export interface ShidduchOnboardingData {
  // Step 1: Creator Type (NEW)
  creatorType?: CreatorType;
  // If not 'self', store the single's contact info separately
  singleFirstName?: string;
  singleLastName?: string;
  singleEmail?: string;
  singlePhone?: string;

  // Step 2: Basics (formerly Step 1)
  firstName?: string;
  lastName?: string;
  hebrewName?: string;
  birthDate?: string;
  gender?: string;
  age?: number;

  // Step 2: Family Background
  fatherName?: string;
  fatherOccupation?: string;
  fatherOrigin?: string;
  motherName?: string;
  motherMaidenName?: string;
  motherOccupation?: string;
  motherOrigin?: string;
  parentsStatus?: string;
  numSiblings?: number;
  siblings?: Sibling[];
  birthOrder?: number;
  grandfatherPaternal?: string;
  grandfatherMaternal?: string;
  notableRabbanim?: string;
  familyMinhagim?: string;

  // Step 3: Education
  elementarySchool?: string;
  highSchool?: string;
  seminaryYeshiva?: string;
  seminaryYeshivaYears?: number;
  collegeUniversity?: string;
  highestDegree?: string;
  occupation?: string;
  company?: string;

  // Step 4: Hashkafa (Religious Outlook)
  community?: string;
  chassidus?: string;
  hashkafaDetails?: string;
  minyanFrequency?: string;
  learningSchedule?: string;
  kollelInterest?: string;
  observanceLevel?: string;
  keepsShabbat?: string;
  keepsKosher?: string;

  // Step 5: Looking For
  lookingForDescription?: string;
  ageRangeMin?: number;
  ageRangeMax?: number;
  preferredCommunities?: string[];
  preferredBackground?: string;
  mustHaves?: string[];
  niceToHaves?: string[];
  dealbreakers?: string[];
  marriageTimeline?: string;
  childrenPlans?: string;
  wifeWorking?: string; // For men
  husbandLearning?: string; // For women

  // Step 6: References
  references?: ShidduchReference[];

  // Step 7: Photos
  photos?: { uri: string; order: number }[];
  photosVisibleTo?: string;

  // Step 8: Additional
  personalityDescription?: string;
  hobbiesInterests?: string[];
  parentDescription?: string;
  parentContactFirst?: boolean;
  livingSituation?: string;
  willingToRelocate?: boolean;
  preferredLocations?: string[];

  // Location
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;

  // Health (sensitive)
  geneticTestingComplete?: boolean;
  geneticTestingOrg?: string;
  geneticTestingId?: string;
}

interface ShidduchOnboardingState {
  data: ShidduchOnboardingData;
  currentStep: number;
  totalSteps: number;

  // Actions
  updateData: (updates: Partial<ShidduchOnboardingData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
  isStepComplete: (step: number) => boolean;
}

const initialData: ShidduchOnboardingData = {};

export const useShidduchOnboardingStore = create<ShidduchOnboardingState>()(
  persist(
    (set, get) => ({
      data: initialData,
      currentStep: 1,
      totalSteps: 9, // Increased to 9 (added creator-type step)

      updateData: (updates) => {
        set((state) => ({
          data: { ...state.data, ...updates },
        }));
      },

      setStep: (step) => {
        set({ currentStep: step });
      },

      nextStep: () => {
        const { currentStep, totalSteps } = get();
        if (currentStep < totalSteps) {
          set({ currentStep: currentStep + 1 });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 });
        }
      },

      reset: () => {
        set({
          data: initialData,
          currentStep: 1,
        });
      },

      isStepComplete: (step) => {
        const { data } = get();
        switch (step) {
          case 1: // Creator Type (NEW)
            return !!data.creatorType;
          case 2: // Basics
            return !!(data.firstName && data.lastName && data.gender && data.birthDate);
          case 3: // Family
            return !!(data.fatherName || data.motherName);
          case 4: // Education
            return !!(data.highSchool || data.seminaryYeshiva);
          case 5: // Hashkafa
            return !!(data.community);
          case 6: // Looking For
            return !!(data.lookingForDescription || data.marriageTimeline);
          case 7: // References
            return !!(data.references && data.references.length >= 2);
          case 8: // Photos
            return true; // Photos are optional
          case 9: // Complete
            return true;
          default:
            return false;
        }
      },
    }),
    {
      name: 'shidduch-onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
