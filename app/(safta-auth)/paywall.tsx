/**
 * Safta Pro Paywall Screen
 *
 * Premium subscription for dedicated matchmakers
 * $14.99/month or $119.99/year
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
} from 'react-native';
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
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useSaftaPremiumStore } from '@/stores/saftaPremiumStore';
import {
  PRICING,
  PREMIUM_FEATURES,
  ENTITLEMENTS,
  SAFTA_PLAN_COMPARISON,
} from '@/lib/config/revenuecat';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

// In production, this would integrate with RevenueCat

export default function SaftaProPaywallScreen() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const user = useAuthStore((s) => s.user);
  const setPlan = useSaftaPremiumStore((s) => s.setPlan);

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

  const handleSubscribe = async () => {
    setIsLoading(true);

    try {
      // In production, this would:
      // 1. Call RevenueCat to initiate purchase
      // 2. Handle the payment flow
      // 3. Verify the purchase on the backend
      // 4. Update the user's subscription status

      // For development, simulate subscription
      if (user?.id) {
        const { error } = await (supabase as any)
          .from('safta_accounts')
          .update({
            subscription_status: 'active',
            subscription_plan: 'safta_pro',
          })
          .eq('user_id', user.id);

        if (error) {
          Alert.alert('Error', 'Failed to activate subscription. Please try again.');
          return;
        }

        setPlan('safta_pro');

        Alert.alert(
          'Welcome to Safta Pro!',
          'Your subscription is now active. Enjoy unlimited matchmaking!',
          [{ text: 'Start Matching', onPress: () => router.replace('/(safta-tabs)') }]
        );
      }
    } catch (e) {
      console.error('Subscription error:', e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);

    try {
      if (user?.id) {
        const { data } = await (supabase as any)
          .from('safta_accounts')
          .select('subscription_status, subscription_plan')
          .eq('user_id', user.id)
          .single();

        if (data?.subscription_status === 'active' && data?.subscription_plan === 'safta_pro') {
          setPlan('safta_pro');
          router.replace('/(safta-tabs)');
        } else {
          Alert.alert('No Subscription Found', "We couldn't find an active Safta Pro subscription for this account.");
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPrice = billingPeriod === 'monthly'
    ? PRICING.safta_pro.monthly.displayPrice
    : PRICING.safta_pro.yearly.displayPrice;

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
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>Save 33%</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Price Card */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.priceCard}>
          <Text style={styles.priceAmount}>{selectedPrice}</Text>
          <Text style={styles.pricePeriod}>
            per {billingPeriod === 'monthly' ? 'month' : 'year'}
          </Text>
          {billingPeriod === 'yearly' && (
            <Text style={styles.priceNote}>
              Just {PRICING.safta_pro.yearly.monthlyEquivalent}/month
            </Text>
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
            style={[styles.subscribeButton, isLoading && styles.subscribeButtonDisabled]}
            onPress={handleSubscribe}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.primary.coral, '#ff8a80', colors.primary.coral]}
              style={styles.subscribeButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary.white} size="small" />
              ) : (
                <>
                  <Text style={styles.subscribeButtonText}>Start Safta Pro</Text>
                  <Text style={styles.subscribeButtonPrice}>{selectedPrice}/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={isLoading}>
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
