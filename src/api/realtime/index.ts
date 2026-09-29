/**
 * Realtime Subscriptions Index
 *
 * Export all Supabase realtime subscription hooks
 */

export {
  useMessagesSubscription,
  useAllMessagesSubscription,
  useTypingIndicator,
  useTypingSubscription,
} from './useMessagesSubscription';

// `useLikesSubscription` was removed in MEXA-294; see the note in the file for why.
export {
  useMatchesSubscription,
  usePresenceSubscription,
} from './useMatchesSubscription';
