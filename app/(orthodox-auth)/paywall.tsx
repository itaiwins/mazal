/**
 * Orthodox Paywall Screen
 *
 * Premium subscription required for Orthodox Shidduch
 * $49.99/month for exclusive features
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
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

// In production, this would integrate with RevenueCat
// For now, we'll simulate the subscription flow

function AnimatedGoldBorder() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.goldBorderOuter, animatedStyle]}>
      <LinearGradient
        colors={[colors.primary.gold, 'transparent', colors.primary.gold, 'transparent']}
        style={styles.goldBorderGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

export default function OrthodoxPaywallScreen() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const setOrthodoxSubscription = useUIStore((s) => s.setOrthodoxSubscription);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);

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

      // For development, simulate subscription.
      //
      // This used to also set `orthodox_subscription_status: 'active'` - a client writing
      // its own paid-subscription state, with no purchase behind it (steps 1-4 above are
      // all still TODO). Since 00015 (MEXA-276) that column is not in `authenticated`'s
      // UPDATE grant, and it stays that way: whatever verifies the RevenueCat receipt
      // writes it as `service_role`. `is_orthodox_user` is a UI mode flag, not an
      // entitlement, so it is still written here.
      if (user?.id) {
        // Note: is_orthodox_user column added via migration
        const { error } = await (supabase as any)
          .from('users')
          .update({
            is_orthodox_user: true,
          })
          .eq('id', user.id);

        if (error) {
          Alert.alert('Error', 'Failed to activate subscription. Please try again.');
          return;
        }

        setOrthodoxSubscription(true);
        setOrthodoxMode(true);

        // Navigate to Orthodox onboarding or main app
        router.replace('/(orthodox-onboarding)/welcome');
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
      // In production, this would check RevenueCat for existing purchases
      // For now, check the database

      if (user?.id) {
        // Note: orthodox_subscription_status column added via migration
        const { data } = await (supabase as any)
          .from('users')
          .select('orthodox_subscription_status')
          .eq('id', user.id)
          .single();

        if (data?.orthodox_subscription_status === 'active') {
          setOrthodoxSubscription(true);
          setOrthodoxMode(true);
          router.replace('/(orthodox-tabs)');
        } else {
          Alert.alert('No Subscription Found', 'We couldn\'t find an active subscription for this account.');
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0f1d36', '#1a2d52', '#0f1d36', '#0a1628']}
        style={StyleSheet.absoluteFill}
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
          onPress={() => {
            Alert.alert(
              'Leave Orthodox Shidduch?',
              'You need a premium subscription to access Orthodox Shidduch features.',
              [
                { text: 'Stay', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: () => router.replace('/(auth)/welcome'),
                },
              ]
            );
          }}
        >
          <Ionicons name="close" size={28} color={colors.primary.white} />
        </Pressable>

        {/* Hero Section */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <AnimatedGoldBorder />
            <Animated.View style={[styles.iconInner, glowStyle]}>
              <Text style={styles.starIcon}>✡</Text>
            </Animated.View>
          </View>

          <Text style={styles.hebrewTitle}>שידוך פרימיום</Text>
          <Text style={styles.title}>Orthodox Shidduch</Text>
          <Text style={styles.subtitle}>
            A premium, dedicated experience for observant Jewish singles
          </Text>
        </Animated.View>

        {/* Price Card */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.priceCard}>
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']}
            style={styles.priceCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.priceHeader}>
              <Ionicons name="diamond" size={24} color={colors.primary.gold} />
              <Text style={styles.priceLabel}>Premium Membership</Text>
            </View>
            <Text style={styles.priceAmount}>$49.99</Text>
            <Text style={styles.pricePeriod}>per month</Text>
            <Text style={styles.priceNote}>Cancel anytime</Text>
          </LinearGradient>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What's Included</Text>

          <View style={styles.feature}>
            <View style={styles.featureIconContainer}>
              <Text style={styles.featureIcon}>✡</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Orthodox-Only Pool</Text>
              <Text style={styles.featureDescription}>
                Match exclusively with verified observant singles
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="people" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Shadchan Connect</Text>
              <Text style={styles.featureDescription}>
                Work with verified matchmakers from your community
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="moon" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Automatic Shabbat Mode</Text>
              <Text style={styles.featureDescription}>
                Profile pauses from candle lighting to havdalah
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="close-circle" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>No Advertisements</Text>
              <Text style={styles.featureDescription}>
                Clean, distraction-free experience
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="infinite" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Unlimited Matches</Text>
              <Text style={styles.featureDescription}>
                No daily limits on profile views or matches
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary.gold} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Privacy Protection</Text>
              <Text style={styles.featureDescription}>
                Only visible to other Orthodox members
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
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
              colors={[colors.primary.gold, '#e6c358', colors.primary.gold]}
              style={styles.subscribeButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary.navy} size="small" />
              ) : (
                <>
                  <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
                  <Text style={styles.subscribeButtonPrice}>$49.99/month</Text>
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
            By subscribing, you agree to our{' '}
            <Text style={styles.footerLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
          <Text style={styles.hebrewBlessing}>בהצלחה רבה</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
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
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  goldBorderOuter: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  goldBorderGradient: {
    flex: 1,
  },
  iconInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary.gold,
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
    elevation: 10,
  },
  starIcon: {
    fontSize: 40,
    color: colors.primary.gold,
  },
  hebrewTitle: {
    fontSize: 28,
    color: colors.primary.gold,
    marginBottom: spacing[1],
    letterSpacing: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 15,
    color: colors.transparent.white70,
    textAlign: 'center',
    lineHeight: 22,
  },
  priceCard: {
    marginBottom: spacing[6],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  priceCardGradient: {
    padding: spacing[5],
    alignItems: 'center',
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary.white,
  },
  pricePeriod: {
    fontSize: 16,
    color: colors.transparent.white60,
    marginBottom: spacing[1],
  },
  priceNote: {
    fontSize: 13,
    color: colors.transparent.white50,
  },
  featuresContainer: {
    marginBottom: spacing[6],
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[4],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    fontSize: 20,
    color: colors.primary.gold,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: colors.transparent.white50,
  },
  buttonContainer: {
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  subscribeButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
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
    color: colors.primary.navy,
  },
  subscribeButtonPrice: {
    fontSize: 13,
    color: colors.primary.navy,
    opacity: 0.8,
    marginTop: 2,
  },
  restoreButton: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 15,
    color: colors.transparent.white60,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  footerText: {
    fontSize: 12,
    color: colors.transparent.white40,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing[3],
  },
  footerLink: {
    color: colors.primary.gold,
  },
  hebrewBlessing: {
    fontSize: 18,
    color: colors.primary.gold,
    letterSpacing: 2,
  },
});
