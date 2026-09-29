/**
 * Safta Pro Paywall Screen
 *
 * Premium subscription for dedicated matchmakers
 *
 * ## Why this screen no longer writes the database (MEXA-345)
 *
 * Subscribe used to `update safta_accounts set subscription_status = 'active',
 * subscription_plan = 'safta_pro'` straight from the client, with no store call anywhere,
 * and Restore Purchases read the same two columns back. That was not a stub that would
 * fail in production — measured on the live project (`tayiyczmacvhokdxfqvm`) on
 * 2026-09-29, `authenticated` holds column-level UPDATE on both, and the
 * `Safta can update own account` policy is `USING (auth_id = auth.uid())` with **no**
 * `WITH CHECK`. So the write lands, and any Safta account could have given itself Safta
 * Pro by issuing it directly. This is the Safta twin of the `users.orthodox_subscription_status`
 * defect MEXA-292 found.
 *
 * The paid state is the RevenueCat `safta_pro` entitlement now, the way MEXA-293 did it
 * for Orthodox. The columns are left in place and simply never written from here; taking
 * the grant away is a schema change and is tracked separately.
 *
 * Prices come from StoreKit, never from the app's own `PRICING` constant (Lelouch's rule
 * on MEXA-387).
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useSaftaPremiumStore } from '@/stores/saftaPremiumStore';
import {
  PREMIUM_FEATURES,
  ENTITLEMENTS,
  PRODUCTS,
  SAFTA_PLAN_COMPARISON,
  getAllPackages,
} from '@/lib/config/revenuecat';
import { useEntitlement } from '@/features/premium/hooks';
import { entitlementNotice } from '@/lib/purchases/entitlementMessages';
import type { EntitlementOutcome } from '@/lib/purchases/entitlements';
import {
  pricesFromProductIds,
  paywallAvailability,
  PRICES_UNAVAILABLE_MESSAGE,
  type BillingPeriod,
  type OfferingsState,
  type PlanPrices,
} from '@/lib/premium/storePricing';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const NO_PRICES: PlanPrices = { yearly: null, monthly: null, savingsPercent: null };

/**
 * Safta Pro's store products. Note these are `safta_pro_*`, not `mazal_safta_pro_*` —
 * they predate the `mazal_<plan>_<period>` convention `productIdFor()` encodes, which is
 * why this screen passes the ids outright instead of a plan name.
 */
const SAFTA_PRODUCT_IDS = {
  monthly: PRODUCTS.SAFTA_PRO_MONTHLY,
  yearly: PRODUCTS.SAFTA_PRO_YEARLY,
} as const;

export default function SaftaProPaywallScreen() {
  const insets = useSafeAreaInsets();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [offeringsState, setOfferingsState] = useState<OfferingsState>('loading');
  const [prices, setPrices] = useState<PlanPrices>(NO_PRICES);
  const setPlan = useSaftaPremiumStore((s) => s.setPlan);
  const { isBusy, checkEntitlement, purchase, restore } = useEntitlement(
    ENTITLEMENTS.SAFTA_PRO
  );

  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  // Ask the store what Safta Pro costs. Until it answers the screen shows a spinner where
  // the price goes; if it never does, it says so and Subscribe stays disabled.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const packages: PurchasesPackage[] = await getAllPackages();
      if (cancelled) return;
      setPrices(pricesFromProductIds(packages, SAFTA_PRODUCT_IDS));
      setOfferingsState(packages.length ? 'ready' : 'unavailable');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const announce = useCallback(
    (outcome: EntitlementOutcome, context: 'purchase' | 'restore') => {
      const notice = entitlementNotice(outcome, context, 'Safta Pro');
      if (notice) Alert.alert(notice.title, notice.message);
    },
    []
  );

  const grantAccess = useCallback(() => {
    setPlan('safta_pro');
    router.replace('/(safta-tabs)');
  }, [setPlan]);

  const handleSubscribe = async () => {
    // Already entitled? Then this is a second tap, and asking the store again would be a
    // duplicate-subscription attempt.
    const outcome = (await checkEntitlement())
      ? ({ status: 'granted' } as EntitlementOutcome)
      : // Buy exactly the period the screen is advertising - never a fallback to the
        // other one, which would charge a price the user never saw.
        await purchase([SAFTA_PRODUCT_IDS[billingPeriod]]);

    if (outcome.status !== 'granted') {
      announce(outcome, 'purchase');
      return;
    }

    setPlan('safta_pro');
    Alert.alert(
      'Welcome to Safta Pro!',
      'Your subscription is now active. Enjoy unlimited matchmaking!',
      [{ text: 'Start Matching', onPress: () => router.replace('/(safta-tabs)') }]
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

  const availability = paywallAvailability(offeringsState, prices, billingPeriod);
  const selectedPrice = billingPeriod === 'monthly' ? prices.monthly : prices.yearly;

  const features = PREMIUM_FEATURES[ENTITLEMENTS.SAFTA_PRO].features;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.secondary.blush, '#fff5f5', '#ffffff', '#fff5f5', colors.secondary.blush]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
        <Pressable
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color={colors.neutral[600]} />
        </Pressable>

        {/* Hero Section */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.heroSection}>
          <Animated.View style={[styles.iconContainer, glowStyle]}>
            <LinearGradient
              colors={[colors.primary.coral, '#ff8a80']}
              style={styles.iconGradient}
            >
              <Ionicons name="heart" size={40} color={colors.primary.white} />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>Safta Pro</Text>
          <Text style={styles.subtitle}>
            Unlock your full matchmaking potential
          </Text>
        </Animated.View>

        {/* Billing Toggle */}
        <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.billingToggle}>
          <Pressable
            style={[
              styles.billingOption,
              billingPeriod === 'monthly' && styles.billingOptionActive,
            ]}
            onPress={() => setBillingPeriod('monthly')}
          >
            <Text style={[
              styles.billingOptionText,
              billingPeriod === 'monthly' && styles.billingOptionTextActive,
            ]}>Monthly</Text>
          </Pressable>
          <Pressable
            style={[
              styles.billingOption,
              billingPeriod === 'yearly' && styles.billingOptionActive,
            ]}
            onPress={() => setBillingPeriod('yearly')}
          >
            <Text style={[
              styles.billingOptionText,
              billingPeriod === 'yearly' && styles.billingOptionTextActive,
            ]}>Yearly</Text>
            {prices.savingsPercent !== null && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>Save {prices.savingsPercent}%</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Price Card */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.priceCard}>
          {availability.showSpinner && (
            <ActivityIndicator color={colors.primary.coral} />
          )}
          {availability.showUnavailable && (
            <Text style={styles.priceUnavailable}>{PRICES_UNAVAILABLE_MESSAGE}</Text>
          )}
          {availability.showPrices && selectedPrice && (
            <>
              <Text style={styles.priceAmount}>{selectedPrice.displayPrice}</Text>
              <Text style={styles.pricePeriod}>
                per {billingPeriod === 'monthly' ? 'month' : 'year'}
              </Text>
              {billingPeriod === 'yearly' && selectedPrice.monthlyEquivalent && (
                <Text style={styles.priceNote}>
                  Just {selectedPrice.monthlyEquivalent}/month
                </Text>
              )}
            </>
          )}
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Everything you need</Text>

          {features.map((feature, index) => (
            <View key={feature.id} style={styles.feature}>
              <View style={styles.featureIconContainer}>
                <Ionicons
                  name={feature.icon as any}
                  size={20}
                  color={colors.primary.coral}
                />
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
              <Ionicons name="checkmark-circle" size={24} color={colors.semantic.success} />
            </View>
          ))}
        </Animated.View>

        {/* Comparison Table */}
        <Animated.View entering={FadeInUp.delay(350).springify()} style={styles.comparisonContainer}>
          <Text style={styles.comparisonTitle}>Free vs Pro</Text>

          {SAFTA_PLAN_COMPARISON.map((row, index) => (
            <View key={index} style={styles.comparisonRow}>
              <Text style={styles.comparisonFeature}>{row.feature}</Text>
              <Text style={styles.comparisonFree}>
                {typeof row.free === 'boolean'
                  ? (row.free ? '✓' : '—')
                  : row.free}
              </Text>
              <Text style={styles.comparisonPro}>
                {typeof row.pro === 'boolean'
                  ? (row.pro ? '✓' : '—')
                  : row.pro}
              </Text>
            </View>
          ))}

          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonHeaderText}></Text>
            <Text style={styles.comparisonHeaderFree}>Free</Text>
            <Text style={styles.comparisonHeaderPro}>Pro</Text>
          </View>
        </Animated.View>

        {/* Subscribe Button */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.buttonContainer}>
          <Pressable
            style={[
              styles.subscribeButton,
              (isBusy || !availability.canPurchase) && styles.subscribeButtonDisabled,
            ]}
            onPress={handleSubscribe}
            disabled={isBusy || !availability.canPurchase}
          >
            <LinearGradient
              colors={[colors.primary.coral, '#ff8a80', colors.primary.coral]}
              style={styles.subscribeButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              {isBusy ? (
                <ActivityIndicator color={colors.primary.white} size="small" />
              ) : (
                <>
                  <Text style={styles.subscribeButtonText}>Start Safta Pro</Text>
                  {selectedPrice && (
                    <Text style={styles.subscribeButtonPrice}>
                      {selectedPrice.displayPrice}/{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                    </Text>
                  )}
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={isBusy}>
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </Pressable>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.footer}>
          <Text style={styles.footerText}>
            Cancel anytime. By subscribing, you agree to our{' '}
            <Text style={styles.footerLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary.blush,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconContainer: {
    marginBottom: spacing[4],
    shadowColor: colors.primary.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
    elevation: 10,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing[4],
  },
  billingOption: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
  },
  billingOptionActive: {
    backgroundColor: colors.primary.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  billingOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  billingOptionTextActive: {
    color: colors.neutral[800],
  },
  savingsBadge: {
    backgroundColor: colors.semantic.success,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  savingsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary.white,
  },
  priceCard: {
    backgroundColor: colors.primary.white,
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing[6],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary.coral,
  },
  pricePeriod: {
    fontSize: 16,
    color: colors.neutral[500],
  },
  priceNote: {
    fontSize: 14,
    color: colors.semantic.success,
    marginTop: spacing[1],
    fontWeight: '500',
  },
  priceUnavailable: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: spacing[6],
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: colors.neutral[700],
  },
  comparisonContainer: {
    backgroundColor: colors.primary.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  comparisonHeader: {
    flexDirection: 'row',
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    right: spacing[4],
  },
  comparisonHeaderText: {
    flex: 2,
  },
  comparisonHeaderFree: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    textAlign: 'center',
  },
  comparisonHeaderPro: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.coral,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  comparisonFeature: {
    flex: 2,
    fontSize: 13,
    color: colors.neutral[600],
  },
  comparisonFree: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral[400],
    textAlign: 'center',
  },
  comparisonPro: {
    flex: 1,
    fontSize: 13,
    color: colors.primary.coral,
    textAlign: 'center',
    fontWeight: '600',
  },
  buttonContainer: {
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  subscribeButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonGradient: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.white,
  },
  subscribeButtonPrice: {
    fontSize: 13,
    color: colors.primary.white,
    opacity: 0.9,
    marginTop: 2,
  },
  restoreButton: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 15,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  footerText: {
    fontSize: 12,
    color: colors.neutral[400],
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: colors.primary.coral,
  },
});
