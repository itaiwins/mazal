/**
 * RevenueCat Configuration
 *
 * Setup and configuration for in-app purchases
 */

// DEV MODE: Set to true to bypass all premium restrictions for testing
export const DEV_BYPASS_PREMIUM = true;

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
  ORTHODOX: 'mazal_orthodox',
  SAFTA_PRO: 'safta_pro',
} as const;

// Product identifiers
export const PRODUCTS = {
  GOLD_MONTHLY: 'mazal_gold_monthly',
  GOLD_YEARLY: 'mazal_gold_yearly',
  PLATINUM_MONTHLY: 'mazal_platinum_monthly',
  PLATINUM_YEARLY: 'mazal_platinum_yearly',
  ORTHODOX_MONTHLY: 'mazal_orthodox_monthly',
  ORTHODOX_YEARLY: 'mazal_orthodox_yearly',
  SAFTA_PRO_MONTHLY: 'safta_pro_monthly',
  SAFTA_PRO_YEARLY: 'safta_pro_yearly',
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
 * Pricing configuration
 */
export const PRICING = {
  gold: {
    monthly: {
      price: 14.99,
      displayPrice: '$14.99',
      period: 'month',
    },
    yearly: {
      price: 119.99,
      displayPrice: '$119.99',
      monthlyEquivalent: '$10',
      period: 'year',
      savings: '33%',
    },
  },
  platinum: {
    monthly: {
      price: 29.99,
      displayPrice: '$29.99',
      period: 'month',
    },
    yearly: {
      price: 239.99,
      displayPrice: '$239.99',
      monthlyEquivalent: '$20',
      period: 'year',
      savings: '33%',
    },
  },
  safta_pro: {
    monthly: {
      price: 14.99,
      displayPrice: '$14.99',
      period: 'month',
    },
    yearly: {
      price: 119.99,
      displayPrice: '$119.99',
      monthlyEquivalent: '$10',
      period: 'year',
      savings: '33%',
    },
  },
} as const;

/**
 * Feature limits by tier
 */
export const FEATURE_LIMITS = {
  free: {
    dailySwipes: 25,
    superLikesPerWeek: 1,
    boostsPerWeek: 0,
    canSeeLikes: false,
    canRewind: false,
    hasReadReceipts: false,
    hasAdvancedFilters: false,
    hasPriorityLikes: false,
    canMessageBeforeMatch: false,
    hasIncognitoMode: false,
    canSeeActiveUsers: false,
  },
  mazal_gold: {
    dailySwipes: Infinity,
    superLikesPerWeek: 5,
    boostsPerWeek: 0,
    canSeeLikes: true,
    canRewind: true,
    hasReadReceipts: true,
    hasAdvancedFilters: true,
    hasPriorityLikes: false,
    canMessageBeforeMatch: false,
    hasIncognitoMode: false,
    canSeeActiveUsers: false,
  },
  mazal_platinum: {
    dailySwipes: Infinity,
    superLikesPerWeek: 5,
    boostsPerWeek: 1,
    canSeeLikes: true,
    canRewind: true,
    hasReadReceipts: true,
    hasAdvancedFilters: true,
    hasPriorityLikes: true,
    canMessageBeforeMatch: true,
    hasIncognitoMode: true,
    canSeeActiveUsers: true,
  },
} as const;

/**
 * Safta feature limits by tier
 */
export const SAFTA_FEATURE_LIMITS = {
  free: {
    dailyRecommendations: 10,
    maxConnections: 1,
    canAddNotes: false,
    hasAdvancedSearch: false,
    hasAnalytics: false,
    hasVerifiedBadge: false,
    hasPriorityRecommendations: false,
  },
  safta_pro: {
    dailyRecommendations: Infinity,
    maxConnections: Infinity,
    canAddNotes: true,
    hasAdvancedSearch: true,
    hasAnalytics: true,
    hasVerifiedBadge: true,
    hasPriorityRecommendations: true,
  },
} as const;

/**
 * Premium features by tier
 */
export const PREMIUM_FEATURES = {
  [ENTITLEMENTS.GOLD]: {
    name: 'Mazal Gold',
    tagline: 'More chances to find your match',
    monthlyPrice: PRICING.gold.monthly.displayPrice,
    yearlyPrice: PRICING.gold.yearly.displayPrice,
    yearlyMonthly: PRICING.gold.yearly.monthlyEquivalent,
    yearlySavings: PRICING.gold.yearly.savings,
    features: [
      { id: 'unlimited_swipes', label: 'Unlimited daily swipes', icon: 'infinite', included: true },
      { id: 'see_likes', label: 'See who likes you', icon: 'heart', included: true },
      { id: 'super_likes', label: '5 Super Likes per week', icon: 'star', included: true },
      { id: 'rewind', label: 'Rewind last swipe', icon: 'refresh', included: true },
      { id: 'advanced_filters', label: 'Advanced filters', icon: 'options', included: true },
      { id: 'read_receipts', label: 'Read receipts', icon: 'checkmark-done', included: true },
      { id: 'no_ads', label: 'Ad-free experience', icon: 'ban', included: true },
    ],
  },
  [ENTITLEMENTS.PLATINUM]: {
    name: 'Mazal Platinum',
    tagline: 'For those serious about finding the one',
    monthlyPrice: PRICING.platinum.monthly.displayPrice,
    yearlyPrice: PRICING.platinum.yearly.displayPrice,
    yearlyMonthly: PRICING.platinum.yearly.monthlyEquivalent,
    yearlySavings: PRICING.platinum.yearly.savings,
    features: [
      { id: 'everything_gold', label: 'Everything in Gold', icon: 'checkmark-circle', included: true },
      { id: 'boost', label: '1 Boost per week', icon: 'rocket', included: true },
      { id: 'priority_likes', label: 'Priority in discovery', icon: 'flash', included: true },
      { id: 'message_before_match', label: 'Message before matching', icon: 'chatbubble', included: true },
      { id: 'incognito', label: 'Incognito mode', icon: 'eye-off', included: true },
      { id: 'active_users', label: 'See who\'s online', icon: 'ellipse', included: true },
      { id: 'safta_insights', label: 'Safta recommendation insights', icon: 'sparkles', included: true },
    ],
  },
  [ENTITLEMENTS.ORTHODOX]: {
    name: 'Orthodox Mode',
    tagline: 'Dedicated matching for observant Jews',
    monthlyPrice: '$49.99',
    yearlyPrice: '$399.99',
    yearlyMonthly: '$33',
    yearlySavings: '33%',
    features: [
      { id: 'orthodox_pool', label: 'Orthodox-only dating pool', icon: 'people', included: true },
      { id: 'shadchan_directory', label: 'Shadchan directory access', icon: 'book', included: true },
      { id: 'shabbat_mode', label: 'Automatic Shabbat mode', icon: 'moon', included: true },
      { id: 'no_ads', label: 'No advertisements', icon: 'ban', included: true },
      { id: 'unlimited_matches', label: 'Unlimited matches', icon: 'infinite', included: true },
      { id: 'privacy', label: 'Enhanced privacy', icon: 'shield-checkmark', included: true },
    ],
  },
  [ENTITLEMENTS.SAFTA_PRO]: {
    name: 'Safta Pro',
    tagline: 'For dedicated matchmakers',
    monthlyPrice: PRICING.safta_pro.monthly.displayPrice,
    yearlyPrice: PRICING.safta_pro.yearly.displayPrice,
    yearlyMonthly: PRICING.safta_pro.yearly.monthlyEquivalent,
    yearlySavings: PRICING.safta_pro.yearly.savings,
    features: [
      { id: 'unlimited_recommendations', label: 'Unlimited daily recommendations', icon: 'infinite', included: true },
      { id: 'unlimited_connections', label: 'Connect with unlimited family members', icon: 'people', included: true },
      { id: 'notes_crm', label: 'Add notes & track each person', icon: 'document-text', included: true },
      { id: 'advanced_search', label: 'Advanced search filters', icon: 'search', included: true },
      { id: 'analytics', label: 'Success rate analytics', icon: 'analytics', included: true },
      { id: 'verified_badge', label: 'Verified Matchmaker badge', icon: 'checkmark-circle', included: true },
      { id: 'priority_recommendations', label: 'Priority visibility on recommendations', icon: 'flash', included: true },
    ],
  },
};

/**
 * Comparison table for paywall
 */
export const PLAN_COMPARISON = [
  { feature: 'Daily swipes', free: '25', gold: 'Unlimited', platinum: 'Unlimited' },
  { feature: 'Super Likes', free: '1/week', gold: '5/week', platinum: '5/week' },
  { feature: 'See who likes you', free: false, gold: true, platinum: true },
  { feature: 'Rewind last swipe', free: false, gold: true, platinum: true },
  { feature: 'Advanced filters', free: false, gold: true, platinum: true },
  { feature: 'Read receipts', free: false, gold: true, platinum: true },
  { feature: 'Weekly Boost', free: false, gold: false, platinum: true },
  { feature: 'Priority in discovery', free: false, gold: false, platinum: true },
  { feature: 'Message before match', free: false, gold: false, platinum: true },
  { feature: 'Incognito mode', free: false, gold: false, platinum: true },
  { feature: 'See active users', free: false, gold: false, platinum: true },
];

/**
 * Safta plan comparison table for paywall
 */
export const SAFTA_PLAN_COMPARISON = [
  { feature: 'Daily recommendations', free: '10', pro: 'Unlimited' },
  { feature: 'Family connections', free: '1', pro: 'Unlimited' },
  { feature: 'Add notes to profiles', free: false, pro: true },
  { feature: 'Advanced search filters', free: false, pro: true },
  { feature: 'Success analytics', free: false, pro: true },
  { feature: 'Verified Matchmaker badge', free: false, pro: true },
  { feature: 'Priority recommendations', free: false, pro: true },
];
