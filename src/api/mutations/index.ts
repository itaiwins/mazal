/**
 * Mutations Index
 *
 * Export all React Query mutation hooks
 */

export { useSwipe, useUndoSwipe } from './useSwipe';
export { useSendMessage, useMarkMessagesAsRead, useDeleteMessage } from './useMessage';
export {
  useCreateProfile,
  useUpdateProfile,
  useUpdatePhotos,
  useUpdatePrompts,
  useUpdateLocation,
  useDeactivateAccount,
} from './useProfile';
export { useUnmatch, useBlockUser, useUnblockUser, useReportUser } from './useMatch';
