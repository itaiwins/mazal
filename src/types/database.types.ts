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
 * carries display columns only - no `email`, `phone`, `auth_id`, `last_name`, coordinates
 * or `date_of_birth` - and computes `distance_miles` and `age` in the database, so neither
 * the coordinates nor the birthdate they are derived from ever reaches a client
 * (00013/MEXA-261 and 00030/MEXA-320).
 *
 * Spelled as a Pick of the generated `users` row on purpose: the view's plain columns are a
 * subset of the table's, so this stays tied to src/types/supabase.generated.ts and stops
 * compiling if one is renamed. Adding a field here means adding it to the view in a
 * migration first. The two computed columns are declared after the Pick, because there is
 * no column on the table to pick them from.
 */
export type PublicProfile = Pick<
  GeneratedUserRow,
  | 'id'
  | 'first_name'
  | 'display_name'
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
> & {
  /**
   * Age in completed years, computed by the view with `public.profile_age()` (00030,
   * MEXA-320). It replaced `date_of_birth`, which the view no longer publishes: the app
   * only ever rendered and filtered on an age, and an exact birthdate is a strong identity
   * element to be handing to every signed-in caller. Not null - `users.date_of_birth` is
   * `NOT NULL`, so the expression always has an input.
   *
   * Your own age does not come from here (the view excludes you); it comes from
   * `calculateAge(users.date_of_birth)` on your own row - see `useUserProfile`.
   */
  age: number;
  /**
   * Great-circle distance in miles from the signed-in user, computed by the view.
   * Null when either side has no location on file.
   */
  distance_miles: number | null;
};

// ============================================================================
// Safta display details (migration 00022, MEXA-302)
// ============================================================================

type GeneratedSaftaAccountRow = GeneratedDatabase['public']['Tables']['safta_accounts']['Row'];

/**
 * A row from the `public.safta_public_profiles` view (migration 00022, MEXA-302).
 *
 * `safta_accounts` is owner-scoped - its one SELECT policy is `auth_id = auth.uid()` - so a
 * grandchild reading a connection got no account row back at all, and a `!inner` embed
 * therefore dropped the connection itself. This view is what she reads instead: three
 * display columns, and only for a Safta she holds an `accepted` connection to.
 *
 * `email` and the `subscription_*` columns are deliberately absent and must not be added
 * here without adding them to the view first - which is a Guts review, not a type edit.
 *
 * Spelled as a Pick of the generated `safta_accounts` row for the same reason
 * `PublicProfile` is: the view's columns are a subset of the table's, so this stops
 * compiling if one is renamed.
 */
export type SaftaPublicProfile = Pick<
  GeneratedSaftaAccountRow,
  'id' | 'display_name' | 'relationship'
>;

// ============================================================================
// Rewind (migration 00025, MEXA-314)
// ============================================================================

/**
 * Why a rewind was refused. `null` on success.
 *
 * These strings are the contract with `public.undo_last_swipe()` in
 * supabase/migrations/00025_rewind_undo_last_swipe.sql - keep the two in step.
 *
 *  - `not_entitled` Rewind is a Gold/Platinum feature and the caller holds neither. Added by
 *                00035 (MEXA-373): before it, the only thing standing between a free client
 *                and the paid feature was `useCanRewind()` on the device. Checked first, so
 *                it is the same answer whether or not there is a recent swipe and it
 *                discloses nothing about the caller's history.
 *  - `no_swipe`  the caller has no swipe to undo, or lost a race for it
 *  - `too_old`   outside the 30-second window, measured server-side
 *  - `matched`   the pair has already matched, so deleting the swipe would strand the
 *                match row; unmatching is the way out of a match, rewind is not
 */
export type UndoSwipeRefusal = 'not_entitled' | 'no_swipe' | 'too_old' | 'matched';

/**
 * The single row `public.undo_last_swipe()` returns.
 *
 * It reports a refusal as data (`ok: false` plus a `reason`) rather than raising, so the
 * client does not have to read anything into PostgREST's SQLSTATE-to-HTTP mapping. The
 * swipe's identity comes back in the refusal cases too, except `no_swipe`, where there is
 * no swipe to name.
 *
 * (`SwipeAction` is declared further down this file; type declarations do not care about
 * order.)
 */
export interface UndoLastSwipeResult {
  ok: boolean;
  reason: UndoSwipeRefusal | null;
  swipe_id: string | null;
  swiped_id: string | null;
  action: SwipeAction | null;
  swiped_at: string | null;
}

// ============================================================================
// Unmatch (migration 00036, MEXA-418)
// ============================================================================

/**
 * Why an unmatch was refused. `null` on success.
 *
 * This string is the contract with `public.unmatch(uuid)` in
 * supabase/migrations/00036_unmatch_is_one_way.sql - keep the two in step.
 *
 *  - `not_found` no match with that id, or the caller is not in it. Deliberately one answer
 *                for both: telling a caller "that match exists but is not yours" would
 *                confirm the existence of a row they cannot see.
 */
export type UnmatchRefusal = 'not_found';

/**
 * The single row `public.unmatch(uuid)` returns.
 *
 * The function is SECURITY DEFINER and decides the side (`user1_unmatched` vs
 * `user2_unmatched`) from `current_app_user_id()`, because a column grant cannot express
 * "you may only set *your* side's flag". It is one-way - nothing in its body sets
 * `is_active` back to true - and idempotent, so a second call on the same match still
 * answers `ok: true`.
 *
 * Before 00036 this was a plain `UPDATE` from the client on a table where `authenticated`
 * held UPDATE on every column, and the person who had been unmatched could set `is_active`
 * back to true and resume the thread (MEXA-418).
 */
export interface UnmatchResult {
  ok: boolean;
  reason: UnmatchRefusal | null;
  match_id: string;
  /** The person you are no longer matched with. `null` in the `not_found` case. */
  other_user_id: string | null;
}

// ============================================================================
// See who likes you (migration 00026, MEXA-315)
// ============================================================================

/**
 * One row from `public.get_who_liked_me()`: somebody who liked or super-liked you and is
 * still waiting on an answer.
 *
 * Spelled as a Pick of {@link PublicProfile} on purpose - the function selects a subset of
 * `public.user_public_profiles`, so this stays tied to the view and stops compiling if a
 * column is renamed out from under it. The profile columns are the ones the Likes card
 * draws and no more; widening this means widening the function in
 * supabase/migrations/00026_who_liked_me.sql first.
 *
 * A `pass` is never in this list, and that is enforced in the database rather than here:
 * the only SELECT policy on `swipes` is own-swiper-only, so "who rejected you" has no path
 * to a client at all. It is why the feature is a pair of SECURITY DEFINER functions and
 * not a cross-side policy.
 */
export type WhoLikedMeRow = Pick<
  PublicProfile,
  | 'id'
  | 'first_name'
  | 'display_name'
  | 'age'
  | 'bio'
  | 'occupation'
  | 'current_city'
  | 'current_state'
  | 'is_verified'
  | 'is_photo_verified'
  | 'distance_miles'
> & {
  /** When they swiped on you - `swipes.created_at`, as an ISO timestamp. */
  liked_at: string;
  /** True for a Super Like. Derived from `swipes.action`; no column stores it. */
  is_super_like: boolean;
};

/**
 * The generated schema plus the `user_public_profiles` view added by migration 00013, the
 * `undo_last_swipe` function added by migration 00025, the two who-liked-me functions added
 * by migration 00026, the `unmatch` function added by migration 00036, and
 * `get_discovery_deck` added by migration 00039.
 *
 * The view is declared here by hand. `supabase gen types` needs Docker, which this machine
 * lacks, but the Management API serves the same output
 * (`GET /v1/projects/<ref>/types/typescript?included_schemas=public`), and that is how
 * src/types/supabase.generated.ts was rebuilt from live on MEXA-434. Its view and function
 * entries have every column nullable, so the hand declarations here still win. Two things follow:
 *
 *  - Keep this in step with the view, which is defined in
 *    supabase/migrations/00013_users_column_privacy.sql and rebuilt by
 *    supabase/migrations/00030_public_profiles_publish_age_not_dob.sql - read 00030 for the
 *    current column list.
 *  - If the generated file is ever rebuilt on a machine that does have Docker, the
 *    generator will emit its own `Views` entry with every column nullable, because Postgres
 *    reports no NOT NULL information through a view. The nullability in `PublicProfile` is
 *    the truthful one, read off the base columns; prefer it and delete the generated entry.
 *
 * `safta_public_profiles` (migration 00022) is declared here for the same reasons.
 *
 * `Relationships: []` on both is not a placeholder: PostgREST can embed a view, but the
 * generator has no relationship to emit for one, so `.select('…, view!inner(…)')` does not
 * typecheck. Every caller reads these views as a second query keyed on an id list and
 * merges client-side, which is the shape MEXA-279 settled on.
 */
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Views' | 'Functions'> & {
    Views: {
      user_public_profiles: {
        Row: PublicProfile;
        Relationships: [];
      };
      safta_public_profiles: {
        Row: SaftaPublicProfile;
        Relationships: [];
      };
    };
    // Omit, not intersect: since the MEXA-434 regen the generator emits these too, with
    // every returned column nullable, and an intersection of the two row types does not
    // typecheck. The hand declarations below are the truthful ones.
    Functions: Omit<
      GeneratedDatabase['public']['Functions'],
      'get_discovery_deck' | 'undo_last_swipe' | 'unmatch' | 'count_who_liked_me' | 'get_who_liked_me'
    > & {
      /**
       * The caller's discovery deck, filtered, ranked and then limited on the server (00039,
       * MEXA-435). Rows of `user_public_profiles`, in rank order; the server clamps
       * `p_limit` to 1..100. Empty arrays mean "any".
       */
      get_discovery_deck: {
        Args: {
          p_age_min?: number;
          p_age_max?: number;
          p_distance_max_miles?: number;
          p_genders?: string[];
          p_backgrounds?: string[];
          p_limit?: number;
        };
        Returns: PublicProfile[];
      };
      undo_last_swipe: {
        Args: Record<PropertyKey, never>;
        Returns: UndoLastSwipeResult[];
      };
      /**
       * Ends a match, one way. The argument is the match id and nothing else; the caller
       * and therefore the side come from the server - see 00036.
       */
      unmatch: {
        Args: { p_match_id: string };
        Returns: UnmatchResult[];
      };
      /**
       * The free teaser: how many unanswered likes you have, naming nobody. Deliberately
       * not entitlement-gated - see the header of 00026.
       */
      count_who_liked_me: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      /**
       * The paid list. Both arguments are paging only and neither names a user; the server
       * clamps them to 1..100 and >= 0, so a caller cannot ask for the whole table.
       */
      get_who_liked_me: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: WhoLikedMeRow[];
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
