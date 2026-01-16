/**
 * Haptic Feedback Patterns
 *
 * Consistent haptic feedback for interactions across the app.
 * Each action type has its own distinct feel.
 */

import * as Haptics from 'expo-haptics';

/**
 * Standard haptic patterns for common interactions
 */
export const HapticPatterns = {
  /**
   * Light tap for UI feedback (button press, toggle)
   */
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /**
   * Medium feedback for selections and confirmations
   */
  select: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /**
   * Heavy feedback for destructive or important actions
   */
  impact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

  /**
   * Rigid feedback for threshold reached (swipe trigger point)
   */
  threshold: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),

  /**
   * Soft feedback for subtle interactions
   */
  soft: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),

  /**
   * Success notification for positive outcomes (match, like accepted)
   */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /**
   * Warning notification for attention-needed situations
   */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),

  /**
   * Error notification for failures
   */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  /**
   * Match celebration - custom pattern for that "Mazal Tov!" moment
   * Heavy impact → pause → medium → pause → success
   */
  celebration: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(100);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(100);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /**
   * Like action - satisfying feedback when liking someone
   */
  like: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(50);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /**
   * Super like (Bashert) - extra special feedback
   */
  superLike: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(80);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(80);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /**
   * Pass action - subtle dismissal feedback
   */
  pass: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /**
   * Card swipe in progress - light feedback during drag
   */
  swipeProgress: () => Haptics.selectionAsync(),

  /**
   * Message sent - satisfying send confirmation
   */
  messageSent: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /**
   * Message received - subtle notification
   */
  messageReceived: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),

  /**
   * Tab change - light selection feedback
   */
  tabChange: () => Haptics.selectionAsync(),

  /**
   * Modal open - medium impact
   */
  modalOpen: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /**
   * Modal close - soft dismissal
   */
  modalClose: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /**
   * Button long press - escalating feedback
   */
  longPress: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(200);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * Undo action - reverse pattern
   */
  undo: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(50);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /**
   * Safta recommendation sent - special pattern for matchmakers
   */
  saftaRecommend: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(100);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /**
   * Shidduch suggestion received - respectful notification
   */
  shidduchSuggestion: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    await delay(150);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },
};

/**
 * Helper to add delay between haptic events
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trigger haptic with error handling (graceful degradation on unsupported devices)
 */
export async function triggerHaptic(
  pattern: keyof typeof HapticPatterns
): Promise<void> {
  try {
    await HapticPatterns[pattern]();
  } catch (error) {
    // Silently fail on devices without haptic support
    console.debug('[Haptics] Not supported:', error);
  }
}

export default HapticPatterns;
