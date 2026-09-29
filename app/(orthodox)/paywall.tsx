/**
 * Orthodox Mode Paywall
 *
 * Subscription required to access Orthodox/Hasidic dating mode
 *
 * ## This is the second Orthodox paywall (MEXA-345)
 *
 * `app/(orthodox-auth)/paywall.tsx` is the one the live funnel uses — welcome → login /
 * register → paywall → onboarding → `(orthodox-tabs)`. This screen belongs to the older
 * `app/(orthodox)/` group, which nothing in the app navigates to any more: the only
 * reference to the group outside itself is its `Stack.Screen` registration in
 * `app/_layout.tsx`, so it is reachable by route but not by tapping. Both groups redirect
 * to `/` while `FEATURE_ORTHODOX_MODE` is off, which is why this never shipped.
 *
 * Whether the group should exist at all is Gojo's call. Until it is answered the screen
 * gets the same gate as the live one rather than being left as a bypass around it: before
 * this, Subscribe waited 1500ms and set the persisted `hasOrthodoxSubscription` flag with
 * no store call anywhere, and Restore always answered "No Purchases".
 *
 * Prices come from StoreKit now, never from a constant in the app (Lelouch's rule on
 * MEXA-387) — this file used to carry its own `ORTHODOX_PRICING` of $24.99/$199.99, which
 * also disagreed with every other price in the repo.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import {
  PREMIUM_FEATURES,
  ENTITLEMENTS,
  PRODUCTS,
  getAllPackages,
} from '@/lib/config/revenuecat';
import { useEntitlement } from '@/features/premium/hooks';
import { entitlementNotice } from '@/lib/purchases/entitlementMessages';
import type { EntitlementOutcome } from '@/lib/purchases/entitlements';
import {
  planPricesFromPackages,
  paywallAvailability,
  PRICES_UNAVAILABLE_MESSAGE,
  type BillingPeriod,
  type OfferingsState,
  type PlanPrices,
} from '@/lib/premium/storePricing';
import { useUIStore } from '@/stores/uiStore';
import { StarOfDavid } from '@/components/icons/StarOfDavid';

const NO_PRICES: PlanPrices = { yearly: null, monthly: null, savingsPercent: null };

const ORTHODOX_PRODUCT_IDS: Record<BillingPeriod, string> = {
  monthly: PRODUCTS.ORTHODOX_MONTHLY,
  yearly: PRODUCTS.ORTHODOX_YEARLY,
};

const HASHKAFOS = [
  'Yeshivish',
  'Modern Orthodox Machmir',
  'Modern Orthodox',
  'Chassidish',
  'Sephardic',
  'Litvish',
];

export default function OrthodoxPaywallScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const setOrthodoxSubscription = useUIStore((s) => s.setOrthodoxSubscription);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);
  const { isBusy, checkEntitlement, purchase, restore } = useEntitlement(
    ENTITLEMENTS.ORTHODOX
  );

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [offeringsState, setOfferingsState] = useState<OfferingsState>('loading');
  const [prices, setPrices] = useState<PlanPrices>(NO_PRICES);

  const orthodoxFeatures = PREMIUM_FEATURES[ENTITLEMENTS.ORTHODOX];

  // Ask the store what Orthodox mode costs. Until it answers the screen shows a spinner
  // where the prices go; if it never does, it says so and Subscribe stays disabled.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const packages: PurchasesPackage[] = await getAllPackages();
      if (cancelled) return;
      setPrices(planPricesFromPackages(packages, 'orthodox'));
      setOfferingsState(packages.length ? 'ready' : 'unavailable');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const availability = paywallAvailability(offeringsState, prices, billingPeriod);
  const selectedPrice = billingPeriod === 'yearly' ? prices.yearly : prices.monthly;

  const announce = useCallback(
    (outcome: EntitlementOutcome, context: 'purchase' | 'restore') => {
      const notice = entitlementNotice(outcome, context, 'Orthodox Mode');
      if (notice) Alert.alert(notice.title, notice.message);
    },
    []
  );

  const grantAccess = useCallback(() => {
    setOrthodoxSubscription(true);
    setOrthodoxMode(true);
    router.replace('/(orthodox)/shidduch');
  }, [setOrthodoxMode, setOrthodoxSubscription]);

  const handlePurchase = async () => {
    // Buy the period the user actually chose. Passing both ids would let the store sell
    // the other one, at a price this screen never showed.
    const outcome = (await checkEntitlement())
      ? ({ status: 'granted' } as EntitlementOutcome)
      : await purchase([ORTHODOX_PRODUCT_IDS[billingPeriod]]);

    if (outcome.status !== 'granted') {
      announce(outcome, 'purchase');
      return;
    }

    Alert.alert(
      'Welcome to Orthodox Mode',
      'Your subscription is now active. You can now access the Orthodox dating pool.',
      [{ text: 'Set Up Profile', onPress: grantAccess }]
    );
  };

  const handleRestore = async () => {
    const outcome = await restore();
    if (outcome.status !== 'granted') {
      announce(outcome, 'restore');
      return;
    }
    grantAccess();
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.dark.background,
          paddingTop: insets.top + spacing[2],
        },
      ]}
    >
      {/* Close Button */}
      <Pressable style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={28} color={colors.primary.white} />
      </Pressable>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInUp.delay(100).springify()}
          style={styles.header}
        >
          <View style={styles.iconBadge}>
            <StarOfDavid size={40} color={colors.primary.gold} />
          </View>
          <Text style={styles.title}>Orthodox Mode</Text>
          <Text style={styles.subtitle}>
            A dedicated, private space for shomer shabbos singles with hashkafa-based matching
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.features}
        >
          {orthodoxFeatures.features.map((feature, index) => (
            <View key={feature.id} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                {feature.icon === 'star-of-david' ? (
                  <StarOfDavid size={20} color={colors.primary.gold} />
                ) : (
                  <Ionicons
                    name={feature.icon as any}
                    size={20}
                    color={colors.primary.gold}
                  />
                )}
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Hashkafa Preview */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.hashkafaSection}
        >
          <Text style={styles.hashkafaLabel}>Match by Hashkafa</Text>
          <View style={styles.hashkafaList}>
            {HASHKAFOS.map((hashkafa) => (
              <View key={hashkafa} style={styles.hashkafaChip}>
                <Text style={styles.hashkafaText}>{hashkafa}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Privacy Notice */}
        <Animated.View
          entering={FadeInDown.delay(350).springify()}
          style={styles.privacyCard}
        >
          <Ionicons name="lock-closed" size={20} color={colors.primary.gold} />
          <Text style={styles.privacyText}>
            Orthodox Mode is completely separate from regular Mazal. Your profile is only visible to other Orthodox Mode subscribers.
          </Text>
        </Animated.View>

        {/* Billing Period */}
        <Animated.View
          entering={FadeInDown.delay(400).springify()}
          style={styles.billingSection}
        >
          <Text style={styles.billingLabel}>Choose your plan</Text>
          <View style={styles.billingOptions}>
            <Pressable
              style={[
                styles.billingOption,
                billingPeriod === 'yearly' && styles.billingOptionActive,
              ]}
              onPress={() => setBillingPeriod('yearly')}
            >
              {prices.savingsPercent !== null && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>
                    Save {prices.savingsPercent}%
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.billingPeriodText,
                  billingPeriod === 'yearly' && styles.billingPeriodTextActive,
                ]}
              >
                Yearly
              </Text>
              {prices.yearly && (
                <Text
                  style={[
                    styles.billingPrice,
                    billingPeriod === 'yearly' && styles.billingPriceActive,
                  ]}
                >
                  {prices.yearly.displayPrice}
                </Text>
              )}
              {prices.yearly?.monthlyEquivalent && (
                <Text style={styles.billingPerMonth}>
                  {prices.yearly.monthlyEquivalent}/month
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.billingOption,
                billingPeriod === 'monthly' && styles.billingOptionActive,
              ]}
              onPress={() => setBillingPeriod('monthly')}
            >
              <Text
                style={[
                  styles.billingPeriodText,
                  billingPeriod === 'monthly' && styles.billingPeriodTextActive,
                ]}
              >
                Monthly
              </Text>
              {prices.monthly && (
                <Text
                  style={[
                    styles.billingPrice,
                    billingPeriod === 'monthly' && styles.billingPriceActive,
                  ]}
                >
                  {prices.monthly.displayPrice}
                </Text>
              )}
            </Pressable>
          </View>

          {availability.showSpinner && (
            <ActivityIndicator
              style={styles.pricesSpinner}
              color={colors.primary.gold}
            />
          )}
          {availability.showUnavailable && (
            <Text style={styles.pricesUnavailable}>{PRICES_UNAVAILABLE_MESSAGE}</Text>
          )}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Pressable
            style={[
              styles.ctaButton,
              (isBusy || !availability.canPurchase) && styles.ctaButtonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={isBusy || !availability.canPurchase}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.primary.navy} />
            ) : (
              <Text style={styles.ctaText}>
                {selectedPrice
                  ? `Subscribe for ${selectedPrice.displayPrice}/${billingPeriod === 'yearly' ? 'year' : 'month'}`
                  : 'Subscribe'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isBusy}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>

          <Text style={styles.legalText}>
            Payment will be charged to your{' '}
            {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account.
            Subscription automatically renews unless cancelled at least 24
            hours before the end of the current period. Cancel anytime in your account settings.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    left: spacing[4],
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[16],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 15,
    color: colors.transparent.white80,
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    color: colors.primary.white,
    flex: 1,
  },
  hashkafaSection: {
    marginBottom: spacing[5],
  },
  hashkafaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.transparent.white60,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  hashkafaList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  hashkafaChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.transparent.white10,
  },
  hashkafaText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.transparent.white80,
  },
  privacyCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.transparent.gold10,
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: colors.transparent.white80,
    lineHeight: 18,
  },
  billingSection: {
    marginBottom: spacing[6],
  },
  billingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.transparent.white60,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  billingOptions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  billingOption: {
    flex: 1,
    backgroundColor: colors.transparent.white10,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  billingOptionActive: {
    borderColor: colors.primary.gold,
    backgroundColor: colors.transparent.gold20,
  },
  savingsBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: colors.semantic.success,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.white,
  },
  billingPeriodText: {
    fontSize: 14,
    color: colors.transparent.white60,
    marginBottom: spacing[1],
  },
  billingPeriodTextActive: {
    color: colors.primary.white,
  },
  billingPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.transparent.white80,
  },
  billingPriceActive: {
    color: colors.primary.gold,
  },
  billingPerMonth: {
    fontSize: 11,
    color: colors.transparent.white50,
    marginTop: spacing[1],
  },
  pricesSpinner: {
    marginTop: spacing[4],
  },
  pricesUnavailable: {
    marginTop: spacing[4],
    fontSize: 13,
    textAlign: 'center',
    color: colors.transparent.white60,
  },
  ctaButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    marginBottom: spacing[4],
  },
  restoreText: {
    fontSize: 14,
    color: colors.transparent.white60,
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 11,
    color: colors.transparent.white40,
    textAlign: 'center',
    lineHeight: 16,
  },
});
