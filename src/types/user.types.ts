/**
 * User Type Re-exports
 *
 * Re-exports user-related types from database.types
 */

export type {
  User,
  UserPhoto,
  UserPrompt,
  UserBadge,
  DiscoveryUser,
  Gender,
  JewishBackground,
  KosherLevel,
  ShabbatObservance,
  RelationshipGoal,
} from './database.types';

import type { User, UserPhoto, UserPrompt, UserBadge } from './database.types';

/**
 * User Profile with photos and prompts
 */
export interface UserProfile extends User {
  photos: UserPhoto[];
  prompts: UserPrompt[];
  badges: UserBadge[];
  age?: number;
}

/**
 * User Preferences
 */
export interface UserPreferences {
  age_min: number;
  age_max: number;
  distance_max_miles: number;
  gender_preference: string[];
  jewish_backgrounds?: string[];
  observance_levels?: string[];
  show_verified_only?: boolean;
  notifications_enabled?: boolean;
  partner_must_be_jewish?: boolean;
  raise_children_jewish?: boolean;
}

/**
 * Photo Upload State
 */
export interface PhotoUpload {
  id: string;
  uri: string;
  order: number;
  isPrimary: boolean;
  uploadProgress?: number;
  uploadedUrl?: string;
  error?: string;
}

/**
 * Prompt Answer
 */
export interface PromptAnswer {
  prompt_id: string;
  prompt_text: string;
  answer: string;
  display_order: number;
}

/**
 * Onboarding Data
 */
export interface OnboardingData {
  // Basic info
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | Date | null;
  gender?: string | null;

  // Photos
  photos?: PhotoUpload[];

  // Jewish Identity
  jewish_background?: string | null;
  kosher_level?: string | null;
  shabbat_observance?: string | null;
  observance_level?: string | null;
  keeps_shabbat?: string | null;
  keeps_kosher?: string | null;
  synagogue_attendance?: string | null;
  jewish_education?: string | null;
  additional_backgrounds?: string[];

  // Location
  current_city?: string | null;
  current_state?: string | null;
  current_country?: string | null;
  current_latitude?: number | null;
  current_longitude?: number | null;

  // Bio & Prompts
  bio?: string | null;
  prompts?: PromptAnswer[];

  // Education & Work
  school?: string | null;
  education?: string | null;
  occupation?: string | null;
  company?: string | null;

  // Lifestyle
  height_cm?: number | null;
  has_children?: boolean;
  wants_children?: string | null;
  looking_for?: string | null;
  relationship_goal?: string | null;

  // Relationship Goals
  partner_must_be_jewish?: boolean;
  raise_children_jewish?: boolean;
  willing_to_relocate?: boolean;

  // Preferences
  age_preference_min?: number;
  age_preference_max?: number;
  distance_preference_km?: number;
  gender_preference?: string[];

  // Badges
  selectedBadges?: string[];
}

/**
 * Discovery Filters
 */
export interface DiscoveryFilters {
  age_min: number;
  age_max: number;
  distance_max_miles: number;
  gender_preference: string[];
  jewish_backgrounds?: string[];
  kosher_levels?: string[];
  shabbat_observance?: string[];
  has_children?: boolean;
  wants_children?: boolean;
  show_verified_only?: boolean;
  [key: string]: unknown; // Allow indexing
}

/**
 * Default filters
 */
export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  age_min: 18,
  age_max: 99,
  distance_max_miles: 100,
  gender_preference: [],
  jewish_backgrounds: [],
};
