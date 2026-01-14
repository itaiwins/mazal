/**
 * Supabase Database Types
 *
 * Re-exports generated types from Supabase and provides convenience types.
 * Generated using: npx supabase gen types typescript --project-id <project-id>
 */

// Re-export all generated types
export type { Database, Json } from './supabase.generated';
export { Constants } from './supabase.generated';

import type { Database } from './supabase.generated';

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

export interface DiscoveryUser extends User {
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
  otherUser: User;
  primaryPhoto: UserPhoto | null;
  lastMessage: Message | null;
  unreadCount: number;
}
