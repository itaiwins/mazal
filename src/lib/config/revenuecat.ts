/**
 * RevenueCat Configuration
 *
 * Setup and configuration for in-app purchases
 */

import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat API keys (replace with your actual keys)
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

// Entitlement identifiers
export const ENTITLEMENTS = {
  GOLD: 'mazal_gold',
  PLATINUM: 'mazal_platinum',
} as const;

// Product identifiers
export const PRODUCTS = {
  GOLD_MONTHLY: 'mazal_gold_monthly',
  GOLD_YEARLY: 'mazal_gold_yearly',
  PLATINUM_MONTHLY: 'mazal_platinum_monthly',
  PLATINUM_YEARLY: 'mazal_platinum_yearly',
} as const;

export type EntitlementId = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];

/**
 * Initialize RevenueCat SDK
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn('RevenueCat API key not configured');
    return;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    await Purchases.configure({ apiKey, appUserID: userId });
    console.log('RevenueCat initialized');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
}

/**
 * Identify user with RevenueCat
 */
export async function identifyUser(userId: string): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.error('Failed to identify user:', error);
    return null;
  }
}

/**
 * Get current customer info
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Failed to get customer info:', error);
    return null;
  }
}

/**
 * Check if user has entitlement
 */
export async function hasEntitlement(
  entitlementId: EntitlementId
): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return (
      customerInfo.entitlements.active[entitlementId]?.isActive ?? false
    );
  } catch (error) {
    console.error('Failed to check entitlement:', error);
    return false;
  }
}

/**
 * Get available packages
 */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current?.availablePackages) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (error) {
    console.error('Failed to get offerings:', error);
    return [];
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('User cancelled purchase');
      return null;
    }
    console.error('Purchase failed:', error);
    throw error;
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    throw error;
  }
}

/**
 * Log out user
 */
export async function logoutUser(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Failed to log out from RevenueCat:', error);
  }
}

/**
 * Premium features by tier
 */
export const PREMIUM_FEATURES = {
  [ENTITLEMENTS.GOLD]: {
    name: 'Mazal Gold',
    features: [
      { id: 'see_likes', label: 'See who likes you', icon: 'heart' },
      { id: 'unlimited_swipes', label: 'Unlimited swipes', icon: 'infinite' },
      { id: 'super_likes', label: '5 Super Likes per day', icon: 'star' },
      { id: 'rewind', label: 'Rewind last swipe', icon: 'refresh' },
      { id: 'no_ads', label: 'Ad-free experience', icon: 'ban' },
    ],
  },
  [ENTITLEMENTS.PLATINUM]: {
    name: 'Mazal Platinum',
    features: [
      { id: 'everything_gold', label: 'Everything in Gold', icon: 'checkmark-circle' },
      { id: 'priority_likes', label: 'Priority in likes queue', icon: 'flash' },
      { id: 'boost', label: '1 free Boost per month', icon: 'rocket' },
      { id: 'advanced_filters', label: 'Advanced filters', icon: 'options' },
      { id: 'read_receipts', label: 'Message read receipts', icon: 'checkmark-done' },
      { id: 'exclusive_badges', label: 'Exclusive profile badges', icon: 'ribbon' },
    ],
  },
};
