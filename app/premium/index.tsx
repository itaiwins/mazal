/**
 * Premium Paywall
 *
 * Subscription screen with tier comparison
 */

import { useState } from 'react';
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PurchasesPackage } from 'react-native-purchases';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { usePremium } from '@/features/premium/hooks/usePremium';
import { PREMIUM_FEATURES, ENTITLEMENTS } from '@/lib/config/revenuecat';

type PlanType = 'gold' | 'platinum';
type BillingPeriod = 'monthly' | 'yearly';

const MOCK_PACKAGES = {
  gold: {
    monthly: { price: '$19.99', period: '/month', savings: null },
    yearly: { price: '$149.99', period: '/year', savings: 'Save 37%' },
  },
  platinum: {
    monthly: { price: '$34.99', period: '/month', savings: null },
    yearly: { price: '$249.99', period: '/year', savings: 'Save 40%' },
  },
};

export default function PremiumPaywallScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { packages, isLoading, purchase, restore } = usePremium();

  const [selectedPlan, setSelectedPlan] = useState<PlanType>('gold');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);

  const currentFeatures = PREMIUM_FEATURES[
    selectedPlan === 'gold' ? ENTITLEMENTS.GOLD : ENTITLEMENTS.PLATINUM
  ];

  const handlePurchase = async () => {
    // In production, find the right package and purchase
    setIsPurchasing(true);
    try {
      // Simulate purchase for demo
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert(
        'Purchase Successful!',
        `Welcome to Mazal ${selectedPlan === 'gold' ? 'Gold' : 'Platinum'}!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Purchase failed. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert('Restored!', 'Your purchases have been restored.');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const pricing = MOCK_PACKAGES[selectedPlan][billingPeriod];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary.navy,
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
          <View style={styles.starBadge}>
            <Ionicons name="star" size={32} color={colors.primary.gold} />
          </View>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.subtitle}>
            Get more matches and find your bashert faster
          </Text>
        </Animated.View>

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
            onPress={() => setSelectedPlan('gold')}
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
            onPress={() => setSelectedPlan('platinum')}
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
          {currentFeatures.features.map((feature, index) => (
            <View key={feature.id} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons
                  name={feature.icon as any}
                  size={20}
                  color={colors.primary.gold}
                />
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
            </View>
          ))}
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
              {MOCK_PACKAGES[selectedPlan].yearly.savings && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>
                    {MOCK_PACKAGES[selectedPlan].yearly.savings}
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
              <Text
                style={[
                  styles.billingPrice,
                  billingPeriod === 'yearly' && styles.billingPriceActive,
                ]}
              >
                {MOCK_PACKAGES[selectedPlan].yearly.price}
              </Text>
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
              <Text
                style={[
                  styles.billingPrice,
                  billingPeriod === 'monthly' && styles.billingPriceActive,
                ]}
              >
                {MOCK_PACKAGES[selectedPlan].monthly.price}
              </Text>
            </Pressable>
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
                  Get {currentFeatures.name} for {pricing.price}
                  {pricing.period}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>

          <Text style={styles.legalText}>
            Payment will be charged to your {' '}
            {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account.
            Subscription automatically renews unless cancelled at least 24
            hours before the end of the current period.
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
    marginBottom: spacing[8],
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
    gap: spacing[4],
    marginBottom: spacing[8],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
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
    fontSize: 16,
    color: colors.primary.white,
    flex: 1,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.transparent.white80,
  },
  billingPriceActive: {
    color: colors.primary.gold,
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
