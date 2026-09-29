/**
 * Queries Index
 *
 * Export all React Query hooks for easy importing
 */

export { useUserProfile, useProfileById } from './useUserProfile';
export { useDiscoveryProfiles } from './useDiscoveryProfiles';
export {
  useMatches,
  useMatchById,
  useUnreadMatchesCount,
  useMatchesCount,
  type MatchWithPreview,
} from './useMatches';
export { useMessages, useInfiniteMessages, useUnreadCount } from './useMessages';
export {
  useWhoLikedMe,
  useWhoLikedMeCount,
  WHO_LIKED_ME_PAGE_SIZE,
  type LikerProfile,
} from './useWhoLikedMe';
export { useSaftaConnections, useSaftaLikesCount, type SaftaConnectionWithPreview } from './useSaftaConnections';
export { useSaftaMessages, useSaftaConnectionById, useSaftaUnreadCount, type SaftaMessage } from './useSaftaMessages';
export {
  fetchSaftaPublicProfiles,
  UNKNOWN_SAFTA_NAME,
  DEFAULT_SAFTA_RELATIONSHIP,
} from './saftaPublicProfiles';
