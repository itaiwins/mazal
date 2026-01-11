/**
 * Notifications Hook
 *
 * React hook for managing push notifications
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@/stores/authStore';
import {
  registerForPushNotifications,
  savePushToken,
  removePushToken,
  handleForegroundNotification,
  handleNotificationResponse,
  setBadgeCount,
  clearAllNotifications,
  type NotificationData,
} from './notificationService';

/**
 * Main hook for notification functionality
 * Should be used at the app root level
 */
export function useNotificationHandler() {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const user = useAuthStore((s) => s.user);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (user?.id) {
      setupNotifications();
    }

    return () => {
      // Cleanup listeners
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.id]);

  const setupNotifications = async () => {
    if (!user?.id) return;

    // Register and save token
    const token = await registerForPushNotifications();
    if (token) {
      await savePushToken(user.id, token);
    }

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      handleForegroundNotification
    );

    // Listen for notification interactions
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
  };

  return {
    setBadgeCount,
    clearAllNotifications,
  };
}

/**
 * Hook for getting notification permissions status
 */
export function useNotificationPermissions() {
  const getPermissionStatus = useCallback(async () => {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  }, []);

  const requestPermission = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  }, []);

  return {
    getPermissionStatus,
    requestPermission,
  };
}

/**
 * Hook for handling notification-based navigation on app launch
 */
export function useNotificationNavigation() {
  useEffect(() => {
    // Check if app was opened from a notification
    checkInitialNotification();
  }, []);

  const checkInitialNotification = async () => {
    // Get the notification response that launched the app
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      handleNotificationResponse(response);
    }
  };
}

/**
 * Hook for unread notification count
 */
export function useUnreadNotificationCount() {
  const updateBadge = useCallback(async (count: number) => {
    await setBadgeCount(count);
  }, []);

  return { updateBadge };
}
