/**
 * Supabase Database Types
 *
 * Re-exports generated types from Supabase and provides convenience types.
 * Generated using: npx supabase gen types typescript --project-id <project-id>
 */

// Re-export all generated types
export type { Json } from './supabase.generated';
export { Constants } from './supabase.generated';

import type { Database as GeneratedDatabase } from './supabase.generated';

// ============================================================================
// Public Profile Type (everybody who is not the signed-in user)
// ============================================================================

type GeneratedUserRow = GeneratedDatabase['public']['Tables']['users']['Row'];

/**
 * A row from the `public.user_public_profiles` view.
 *
 * Since migration 00013 (MEXA-261), `public.users` is own-row-only: selecting from it
 * returns exactly one row, yours. Anything about anybody else comes from this view, which
 * carries display columns only - no `email`, `phone`, `auth_id`, `last_name` or
 * coordinates - and computes `distance_miles` in the database so coordinates never reach a
 * client.
 *
 * Spelled as a Pick of the generated `users` row on purpose: the view's columns are a
 * subset of the table's, so this stays tied to src/types/supabase.generated.ts and stops
 * compiling if one is renamed. Adding a field here means adding it to the view in a
 * migration first.
 */
export type PublicProfile = Pick<
  GeneratedUserRow,
  | 'id'
  | 'first_name'
  | 'display_name'
  | 'date_of_birth'
  | 'gender'
  | 'bio'
  | 'height_cm'
  | 'occupation'
  | 'company'
  | 'education'
  | 'school'
  | 'jewish_background'
  | 'observance_level'
  | 'keeps_shabbat'
  | 'keeps_kosher'
  | 'synagogue_attendance'
  | 'jewish_education'
  | 'looking_for'
  | 'wants_children'
  | 'partner_must_be_jewish'
  | 'raise_children_jewish'
  | 'willing_to_relocate'
  | 'current_city'
  | 'current_state'
  | 'current_country'
  | 'is_active'
  | 'onboarding_complete'
  | 'is_verified'
  | 'is_photo_verified'
  | 'is_orthodox_only'
  | 'is_orthodox_user'
  | 'elo_score'
> & {
  /**
   * Great-circle distance in miles from the signed-in user, computed by the view.
   * Null when either side has no location on file.
   */
  distance_miles: number | null;
};

/**
 * The generated schema plus the `user_public_profiles` view added by migration 00013.
 *
 * The view is declared here by hand instead of being regenerated into
 * src/types/supabase.generated.ts, because `supabase gen types` shells out to Docker and
 * this machine has none - the same constraint that makes supabase/MIGRATIONS.md a runbook
 * rather than a `db push`. Two things follow:
 *
 *  - Keep this in step with the view in supabase/migrations/00013_users_column_privacy.sql.
 *  - If the generated file is ever rebuilt on a machine that does have Docker, the
 *    generator will emit its own `Views` entry with every column nullable, because Postgres
 *    reports no NOT NULL information through a view. The nullability in `PublicProfile` is
 *    the truthful one, read off the base columns; prefer it and delete the generated entry.
 */
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Views'> & {
    Views: {
      user_public_profiles: {
        Row: PublicProfile;
        Relationships: [];
      };
    };
  };
};

// ============================================================================
// Custom Type Aliases (more descriptive than generated enums)
// ============================================================================

export type SwipeAction = 'like' | 'pass' | 'super_like';

export type MessageType = 'text' | 'image' | 'gif' | 'icebreaker' | 'voice';

export type Gender = 'male' | 'female' | 'non_binary' | 'other';

export type JewishBackground =
  | 'orthodox'
  | 'modern_orthodox'
  | 'conservative'
  | 'reform'
  | 'reconstructionist'
  | 'secular'
  | 'just_jewish'
  | 'other';

export type KosherLevel =
  | 'strict'
  | 'kosher_style'
  | 'kosher_home'
  | 'none';

export type ShabbatObservance =
  | 'fully_observant'
  | 'mostly_observant'
  | 'sometimes'
  | 'rarely'
  | 'not_observant';

export type RelationshipGoal =
  | 'marriage'
  | 'long_term'
  | 'dating'
  | 'casual'
  | 'friends';

export type VerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected';

export type ObservanceLevel =
  | 'very_observant'
  | 'observant'
  | 'somewhat_observant'
  | 'not_observant';

export type LookingFor =
  | 'marriage'
  | 'long_term_relationship'
  | 'dating'
  | 'something_casual'
  | 'new_friends'
  | 'not_sure';

export type WantsChildren =
  | 'yes'
  | 'no'
  | 'maybe'
  | 'already_have';

// ============================================================================
// Helper Types
// ============================================================================

// Get Row type for a table
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

// Get Insert type for a table
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

// Get Update type for a table
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// ============================================================================
// Convenience Types
// ============================================================================

export type User = Tables<'users'>;
export type UserPhoto = Tables<'user_photos'>;
export type UserPrompt = Tables<'user_prompts'>;
export type UserBadge = Tables<'user_badges'>;
export type Swipe = Tables<'swipes'>;
export type Match = Tables<'matches'>;
export type Message = Tables<'messages'>;
export type Block = Tables<'blocks'>;
export type Report = Tables<'reports'>;
export type SaftaAccount = Tables<'safta_accounts'>;
export type SaftaConnection = Tables<'safta_connections'>;
export type SaftaLike = Tables<'safta_likes'>;
export type SavedLocation = Tables<'saved_locations'>;
export type College = Tables<'colleges'>;
export type Subscription = Tables<'subscriptions'>;
export type UserCollege = Tables<'user_colleges'>;
export type UserSaftaStats = Tables<'user_safta_stats'>;

// Shidduch System Types
export type ShidduchProfile = Tables<'shidduch_profiles'>;
export type ShidduchReference = Tables<'shidduch_references'>;
export type ShidduchSuggestion = Tables<'shidduch_suggestions'>;
export type ShidduchMessage = Tables<'shidduch_messages'>;
export type FamilyConnection = Tables<'family_connections'>;
export type ShabbatSchedule = Tables<'shabbat_schedules'>;
export type CommunitySettings = Tables<'community_settings'>;
export type ShadchanNotes = Tables<'shadchan_notes'>;
export type ShidduchDailyActivity = Tables<'shidduch_daily_activity'>;

// Insert types
export type UserInsert = InsertTables<'users'>;
export type UserPhotoInsert = InsertTables<'user_photos'>;
export type SwipeInsert = InsertTables<'swipes'>;
export type MessageInsert = InsertTables<'messages'>;

// Update types
export type UserUpdate = UpdateTables<'users'>;

// ============================================================================
// Discovery Profile Type
// ============================================================================

export interface DiscoveryUser extends PublicProfile {
  photos: UserPhoto[];
  prompts: UserPrompt[];
  badges?: UserBadge[];
  age: number;
  distance?: number;
  distance_km?: number;
  compatibility_score?: number;
  has_liked_me?: boolean;
  safta_approved_count?: number;
}

// ============================================================================
// Match Preview Type
// ============================================================================

export interface MatchPreview {
  match: Match;
  /** The person you matched with, so a public profile - never a full `users` row. */
  otherUser: PublicProfile;
  primaryPhoto: UserPhoto | null;
  lastMessage: Message | null;
  unreadCount: number;
}
