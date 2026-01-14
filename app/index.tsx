/**
 * Root Index - Entry Point
 *
 * Handles initial routing based on auth and onboarding state
 */

import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);
  const hasSaftaProfile = useAuthStore((s) => s.hasSaftaProfile);
  const currentMode = useAuthStore((s) => s.currentMode);

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
    isSaftaMode: currentMode === 'safta',
  });

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
    backgroundColor: colors.primary.navy,
  },
});
