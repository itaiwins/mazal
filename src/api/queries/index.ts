/**
 * Queries Index
 *
 * Export all React Query hooks for easy importing
 */

export { useUserProfile, useProfileById } from './useUserProfile';
export { useDiscoveryProfiles } from './useDiscoveryProfiles';
export { useMatches, useMatchById, useUnreadMatchesCount, type MatchWithPreview } from './useMatches';
export { useMessages, useInfiniteMessages, useUnreadCount } from './useMessages';
export { useSaftaConnections, useSaftaLikesCount, type SaftaConnectionWithPreview } from './useSaftaConnections';
export { useSaftaMessages, useSaftaConnectionById, useSaftaUnreadCount, type SaftaMessage } from './useSaftaMessages';
