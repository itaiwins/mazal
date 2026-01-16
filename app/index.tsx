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

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);
  const hasSaftaProfile = useAuthStore((s) => s.hasSaftaProfile);
  const hasShidduchProfile = useAuthStore((s) => s.hasShidduchProfile);
  const currentMode = useAuthStore((s) => s.currentMode);

  // Orthodox mode from UI store
  const isOrthodoxMode = useUIStore((s) => s.isOrthodoxMode);

  // Show loading while initializing
  if (!isInitialized) {
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
    isSaftaMode: currentMode === 'safta',
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

  if (currentMode === 'safta') {
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
