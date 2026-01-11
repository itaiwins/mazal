/**
 * Push Notification Service
 *
 * Handles push notification registration, handling, and configuration
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/api/supabase/client';
import Constants from 'expo-constants';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Notification types
export type NotificationType =
  | 'new_match'
  | 'new_message'
  | 'super_like'
  | 'profile_view'
  | 'daily_picks'
  | 'safta_like'
  | 'match_expired';

export interface NotificationData {
  type: NotificationType;
  matchId?: string;
  userId?: string;
  senderName?: string;
  message?: string;
}

/**
 * Request notification permissions and get push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not determined
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || 'your-eas-project-id',
    });
    return token.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Register push token with Supabase
 * Note: Requires push_tokens table from migration 00003_push_tokens.sql
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    // Use type assertion since push_tokens may not be in generated types yet
    const { error } = await (supabase as any).from('push_tokens').upsert(
      {
        user_id: userId,
        token: token,
        platform: Platform.OS,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

    if (error) {
      console.error('Error saving push token:', error);
    } else {
      console.log('Push token saved successfully');
    }
  } catch (err) {
    console.error('Failed to save push token:', err);
  }
}

/**
 * Remove push token when user logs out
 * Note: Requires push_tokens table from migration 00003_push_tokens.sql
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    // Use type assertion since push_tokens may not be in generated types yet
    const { error } = await (supabase as any)
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing push token:', error);
    } else {
      console.log('Push token deactivated successfully');
    }
  } catch (err) {
    console.error('Failed to remove push token:', err);
  }
}

/**
 * Handle notification received while app is foregrounded
 */
export function handleForegroundNotification(
  notification: Notifications.Notification
): void {
  const data = notification.request.content.data as unknown as NotificationData;
  console.log('Foreground notification:', data);

  // You could show an in-app alert or toast here
  // The notification will still appear based on setNotificationHandler config
}

/**
 * Handle notification tap (when user interacts with notification)
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as unknown as NotificationData;
  console.log('Notification tapped:', data);

  // Navigate based on notification type
  switch (data.type) {
    case 'new_match':
      if (data.matchId) {
        router.push(`/(tabs)/messages/${data.matchId}`);
      } else {
        router.push('/(tabs)/matches');
      }
      break;

    case 'new_message':
      if (data.matchId) {
        router.push(`/(tabs)/messages/${data.matchId}`);
      }
      break;

    case 'super_like':
      // Navigate to discovery or likes screen
      router.push('/(tabs)');
      break;

    case 'profile_view':
      // Navigate to who viewed (premium feature)
      router.push('/(tabs)/matches');
      break;

    case 'daily_picks':
      // Navigate to discovery
      router.push('/(tabs)');
      break;

    case 'safta_like':
      // Navigate to profile that was liked by safta
      if (data.userId) {
        router.push(`/(tabs)/messages/${data.matchId}`);
      }
      break;

    default:
      router.push('/(tabs)');
  }
}

/**
 * Set badge count on app icon
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await setBadgeCount(0);
}

/**
 * Schedule a local notification (for testing or reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  seconds: number = 5
): Promise<string> {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as unknown as Record<string, unknown>,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });

  return identifier;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(
  identifier: string
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  return Notifications.getAllScheduledNotificationsAsync();
}
