/**
 * Root Index - Entry Point
 *
 * Handles initial routing based on auth and onboarding state
 * Supports three modes: Regular User, Safta (matchmaker), Orthodox/Shidduch
 */

import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/theme/colors';
import { FEATURE_ORTHODOX_MODE, FEATURE_SAFTA_MODE } from '@/lib/config/features';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isProfileLoading = useAuthStore((s) => s.isProfileLoading);
  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);
  const hasSaftaProfile = useAuthStore((s) => s.hasSaftaProfile);
  const hasShidduchProfile = useAuthStore((s) => s.hasShidduchProfile);
  const currentMode = useAuthStore((s) => s.currentMode);

  // Orthodox mode from UI store. Forced off while the feature is flagged off, so a
  // stale persisted `true` can never route a returning user into the hidden flow.
  const isOrthodoxMode = useUIStore((s) => s.isOrthodoxMode) && FEATURE_ORTHODOX_MODE;
  const isSaftaMode = currentMode === 'safta' && FEATURE_SAFTA_MODE;

  // Show loading while initializing, and while the signed-in user's profile is still on
  // its way. `setSession` makes `isAuthenticated` true immediately, but the profile —
  // and with it `isOnboardingComplete` — lands a tick later, because loading it inside
  // the auth callback deadlocks supabase-js (MEXA-335). Routing during that gap sends a
  // fully onboarded user to `/(onboarding)/welcome`.
  if (!isInitialized || (isAuthenticated && isProfileLoading)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  // Not authenticated - go to welcome/login
  if (!isAuthenticated) {
    console.log('[Router] Not authenticated, redirecting to auth/welcome');
    return <Redirect href="/(auth)/welcome" />;
  }

  // Authenticated - route based on mode and onboarding state
  console.log('[Router] State:', {
    isAuthenticated,
    isInitialized,
    isOnboardingComplete,
    hasSaftaProfile,
    hasShidduchProfile,
    isOrthodoxMode,
    isSaftaMode,
  });

  // Orthodox/Shidduch mode takes priority
  if (isOrthodoxMode) {
    if (hasShidduchProfile) {
      console.log('[Router] Orthodox mode, has shidduch profile, going to shidduch-tabs');
      return <Redirect href="/(shidduch-tabs)" />;
    } else {
      console.log('[Router] Orthodox mode, needs shidduch onboarding');
      return <Redirect href="/(shidduch-onboarding)/welcome" />;
    }
  }

  if (isSaftaMode) {
    // Safta mode
    if (hasSaftaProfile) {
      console.log('[Router] Safta mode, has profile, going to safta-tabs');
      return <Redirect href="/(safta-tabs)" />;
    } else {
      console.log('[Router] Safta mode, no profile, going to safta-auth');
      return <Redirect href="/(safta-auth)/welcome" />;
    }
  } else {
    // User mode
    if (isOnboardingComplete) {
      console.log('[Router] User mode, onboarding complete, going to tabs');
      return <Redirect href="/(tabs)" />;
    } else {
      console.log('[Router] User mode, needs onboarding');
      return <Redirect href="/(onboarding)/welcome" />;
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.background,
  },
});
