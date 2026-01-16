/**
 * Premium Paywall
 *
 * Subscription screen with tier comparison
 */

import { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { usePremiumStore } from '@/stores/premiumStore';
import {
  PRICING,
  PREMIUM_FEATURES,
  ENTITLEMENTS,
  PLAN_COMPARISON,
  purchasePackage,
  restorePurchases,
  getOfferings,
} from '@/lib/config/revenuecat';
import type { PurchasesPackage } from 'react-native-purchases';

type PlanType = 'gold' | 'platinum';
type BillingPeriod = 'monthly' | 'yearly';

export default function PremiumPaywallScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ plan?: string; reason?: string }>();

  const hidePaywall = usePremiumStore((s) => s.hidePaywallModal);
  const setEntitlements = usePremiumStore((s) => s.setEntitlements);

  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    (params.plan as PlanType) || 'gold'
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await getOfferings();
      setPackages(offerings);
    } catch (error) {
      console.error('Failed to load offerings:', error);
    }
  };

  const currentFeatures = PREMIUM_FEATURES[
    selectedPlan === 'gold' ? ENTITLEMENTS.GOLD : ENTITLEMENTS.PLATINUM
  ];

  const pricing = selectedPlan === 'gold' ? PRICING.gold : PRICING.platinum;

  const handlePurchase = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPurchasing(true);

    try {
      // Find the right package based on selection
      const productId = `mazal_${selectedPlan}_${billingPeriod}`;
      const pkg = packages.find((p) => p.product.identifier === productId);

      if (!pkg) {
        // For development/testing without RevenueCat configured
        Alert.alert(
          'Demo Mode',
          `In production, this would purchase Mazal ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} (${billingPeriod}).\n\nPrice: ${billingPeriod === 'yearly' ? pricing.yearly.displayPrice : pricing.monthly.displayPrice}`,
          [{ text: 'OK' }]
        );
        setIsPurchasing(false);
        return;
      }

      const customerInfo = await purchasePackage(pkg);

      if (customerInfo) {
        const isGold = customerInfo.entitlements.active[ENTITLEMENTS.GOLD]?.isActive;
        const isPlatinum = customerInfo.entitlements.active[ENTITLEMENTS.PLATINUM]?.isActive;

        if (isPlatinum) {
          setEntitlements({
            isPremium: true,
            plan: 'mazal_platinum',
            features: ['see_likes', 'unlimited_swipes', 'super_likes', 'rewind', 'boost', 'read_receipts', 'advanced_filters', 'message_before_match'],
            superLikesRemaining: 5,
            boostsRemaining: 1,
            expiresAt: customerInfo.entitlements.active[ENTITLEMENTS.PLATINUM]?.expirationDate ?? undefined,
          });
        } else if (isGold) {
          setEntitlements({
            isPremium: true,
            plan: 'mazal_gold',
            features: ['see_likes', 'unlimited_swipes', 'super_likes', 'rewind', 'read_receipts', 'advanced_filters'],
            superLikesRemaining: 5,
            boostsRemaining: 0,
            expiresAt: customerInfo.entitlements.active[ENTITLEMENTS.GOLD]?.expirationDate ?? undefined,
          });
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Welcome to Mazal Premium!',
          'Your subscription is now active. Enjoy all the premium features!',
          [{ text: 'Let\'s Go!', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPurchasing(true);

    try {
      const customerInfo = await restorePurchases();

      if (customerInfo) {
        const isGold = customerInfo.entitlements.active[ENTITLEMENTS.GOLD]?.isActive;
        const isPlatinum = customerInfo.entitlements.active[ENTITLEMENTS.PLATINUM]?.isActive;

        if (isPlatinum || isGold) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Restored!', 'Your subscription has been restored.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
        } else {
          Alert.alert('No Subscription Found', 'We couldn\'t find an active subscription to restore.');
        }
      }
    } catch (error) {
      Alert.alert('Restore Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    hidePaywall();
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color={colors.primary.white} />
        </Pressable>
        <Pressable style={styles.restoreHeaderButton} onPress={handleRestore}>
          <Text style={styles.restoreHeaderText}>Restore</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          entering={FadeInUp.delay(100).springify()}
          style={styles.hero}
        >
          <View style={styles.starBadge}>
            <Ionicons
              name={selectedPlan === 'platinum' ? 'diamond' : 'star'}
              size={32}
              color={colors.primary.gold}
            />
          </View>
          <Text style={styles.title}>{currentFeatures.name}</Text>
          <Text style={styles.subtitle}>{currentFeatures.tagline}</Text>
        </Animated.View>

        {/* Reason Banner */}
        {params.reason && (
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            style={styles.reasonBanner}
          >
            <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
            <Text style={styles.reasonText}>{params.reason}</Text>
          </Animated.View>
        )}

        {/* Plan Selector */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.planSelector}
        >
          <Pressable
            style={[
              styles.planTab,
              selectedPlan === 'gold' && styles.planTabActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedPlan('gold');
            }}
          >
            <Ionicons
              name="star"
              size={18}
              color={selectedPlan === 'gold' ? colors.primary.navy : colors.primary.gold}
            />
            <Text
              style={[
                styles.planTabText,
                selectedPlan === 'gold' && styles.planTabTextActive,
              ]}
            >
              Gold
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.planTab,
              selectedPlan === 'platinum' && styles.planTabActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedPlan('platinum');
            }}
          >
            <Ionicons
              name="diamond"
              size={18}
              color={selectedPlan === 'platinum' ? colors.primary.navy : colors.primary.gold}
            />
            <Text
              style={[
                styles.planTabText,
                selectedPlan === 'platinum' && styles.planTabTextActive,
              ]}
            >
              Platinum
            </Text>
          </Pressable>
        </Animated.View>

        {/* Features */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.features}
        >
          {currentFeatures.features.map((feature) => (
            <View key={feature.id} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons
                  name={feature.icon as any}
                  size={20}
                  color={colors.primary.gold}
                />
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
              <Ionicons name="checkmark-circle" size={22} color={colors.semantic.success} />
            </View>
          ))}
        </Animated.View>

        {/* Billing Period */}
        <Animated.View
          entering={FadeInDown.delay(400).springify()}
          style={styles.billingSection}
        >
          <Text style={styles.billingLabel}>Choose your billing</Text>
          <View style={styles.billingOptions}>
            {/* Yearly Option */}
            <Pressable
              style={[
                styles.billingOption,
                billingPeriod === 'yearly' && styles.billingOptionActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setBillingPeriod('yearly');
              }}
            >
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>SAVE {pricing.yearly.savings}</Text>
              </View>
              <Text
                style={[
                  styles.billingPeriodText,
                  billingPeriod === 'yearly' && styles.billingPeriodTextActive,
                ]}
              >
                Yearly
              </Text>
              <Text
                style={[
                  styles.billingPrice,
                  billingPeriod === 'yearly' && styles.billingPriceActive,
                ]}
              >
                {pricing.yearly.displayPrice}
              </Text>
              <Text style={styles.billingSubtext}>
                {pricing.yearly.monthlyEquivalent}/month
              </Text>
            </Pressable>

            {/* Monthly Option */}
            <Pressable
              style={[
                styles.billingOption,
                billingPeriod === 'monthly' && styles.billingOptionActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setBillingPeriod('monthly');
              }}
            >
              <Text
                style={[
                  styles.billingPeriodText,
                  billingPeriod === 'monthly' && styles.billingPeriodTextActive,
                ]}
              >
                Monthly
              </Text>
              <Text
                style={[
                  styles.billingPrice,
                  billingPeriod === 'monthly' && styles.billingPriceActive,
                ]}
              >
                {pricing.monthly.displayPrice}
              </Text>
              <Text style={styles.billingSubtext}>/month</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Comparison Table */}
        <Animated.View
          entering={FadeInDown.delay(450).springify()}
          style={styles.comparisonSection}
        >
          <Text style={styles.comparisonTitle}>Compare Plans</Text>
          <View style={styles.comparisonTable}>
            {/* Header Row */}
            <View style={styles.comparisonHeader}>
              <Text style={[styles.comparisonHeaderText, { flex: 1.5 }]}>Feature</Text>
              <Text style={styles.comparisonHeaderText}>Free</Text>
              <Text style={[styles.comparisonHeaderText, { color: colors.primary.gold }]}>Gold</Text>
              <Text style={[styles.comparisonHeaderText, { color: colors.semantic.info }]}>Plat</Text>
            </View>
            {/* Rows */}
            {PLAN_COMPARISON.slice(0, 6).map((row, index) => (
              <View
                key={row.feature}
                style={[
                  styles.comparisonRow,
                  index === 5 && styles.comparisonRowLast,
                ]}
              >
                <Text style={[styles.comparisonFeature, { flex: 1.5 }]}>{row.feature}</Text>
                <View style={styles.comparisonValue}>
                  {typeof row.free === 'boolean' ? (
                    <Ionicons
                      name={row.free ? 'checkmark' : 'close'}
                      size={16}
                      color={row.free ? colors.semantic.success : colors.neutral[500]}
                    />
                  ) : (
                    <Text style={styles.comparisonValueText}>{row.free}</Text>
                  )}
                </View>
                <View style={styles.comparisonValue}>
                  {typeof row.gold === 'boolean' ? (
                    <Ionicons
                      name={row.gold ? 'checkmark' : 'close'}
                      size={16}
                      color={row.gold ? colors.semantic.success : colors.neutral[500]}
                    />
                  ) : (
                    <Text style={[styles.comparisonValueText, { color: colors.primary.gold }]}>{row.gold}</Text>
                  )}
                </View>
                <View style={styles.comparisonValue}>
                  {typeof row.platinum === 'boolean' ? (
                    <Ionicons
                      name={row.platinum ? 'checkmark' : 'close'}
                      size={16}
                      color={row.platinum ? colors.semantic.success : colors.neutral[500]}
                    />
                  ) : (
                    <Text style={[styles.comparisonValueText, { color: colors.semantic.info }]}>{row.platinum}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Pressable
            style={[styles.ctaButton, isPurchasing && styles.ctaButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing}
          >
            {isPurchasing ? (
              <ActivityIndicator color={colors.primary.navy} />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  Get {currentFeatures.name}
                </Text>
                <Text style={styles.ctaPrice}>
                  {billingPeriod === 'yearly'
                    ? `${pricing.yearly.displayPrice}/year`
                    : `${pricing.monthly.displayPrice}/month`}
                </Text>
              </>
            )}
          </Pressable>

          <Text style={styles.legalText}>
            Payment will be charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account.
            Subscription automatically renews unless cancelled at least 24
            hours before the end of the current period. Manage subscriptions in your device settings.
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restoreHeaderButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  restoreHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  starBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    fontSize: 16,
    color: colors.transparent.white80,
    textAlign: 'center',
  },
  reasonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.transparent.gold10,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary.white,
  },
  planSelector: {
    flexDirection: 'row',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.full,
    padding: spacing[1],
    marginBottom: spacing[6],
  },
  planTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
  },
  planTabActive: {
    backgroundColor: colors.primary.gold,
  },
  planTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  planTabTextActive: {
    color: colors.primary.navy,
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
  billingSection: {
    marginBottom: spacing[6],
  },
  billingLabel: {
    fontSize: 13,
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
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  billingOptionActive: {
    borderColor: colors.primary.gold,
    backgroundColor: colors.transparent.gold10,
  },
  savingsBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: colors.semantic.success,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  savingsText: {
    fontSize: 10,
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
  billingSubtext: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  comparisonSection: {
    marginBottom: spacing[6],
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[3],
  },
  comparisonTable: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  comparisonHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.transparent.white60,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  comparisonRowLast: {
    borderBottomWidth: 0,
  },
  comparisonFeature: {
    flex: 1,
    fontSize: 12,
    color: colors.primary.white,
  },
  comparisonValue: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonValueText: {
    fontSize: 11,
    color: colors.transparent.white60,
  },
  ctaButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  ctaPrice: {
    fontSize: 14,
    color: colors.primary.navy,
    opacity: 0.8,
    marginTop: spacing[0.5],
  },
  legalText: {
    fontSize: 11,
    color: colors.transparent.white40,
    textAlign: 'center',
    lineHeight: 16,
  },
});
