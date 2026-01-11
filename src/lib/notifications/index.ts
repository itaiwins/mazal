/**
 * Notifications Module Index
 *
 * Export all notification-related functionality
 */

export {
  registerForPushNotifications,
  savePushToken,
  removePushToken,
  handleForegroundNotification,
  handleNotificationResponse,
  setBadgeCount,
  clearAllNotifications,
  scheduleLocalNotification,
  cancelScheduledNotification,
  getScheduledNotifications,
  type NotificationType,
  type NotificationData,
} from './notificationService';

export {
  useNotificationHandler,
  useNotificationPermissions,
  useNotificationNavigation,
  useUnreadNotificationCount,
} from './useNotifications';
