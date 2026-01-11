/**
 * Root Index - Entry Point
 *
 * Handles initial routing based on auth and onboarding state
 */

import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';

export default function Index() {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);

  // Debug logging
  useEffect(() => {
    console.log('[Router] State:', { isInitialized, isAuthenticated, isOnboardingComplete });
  }, [isInitialized, isAuthenticated, isOnboardingComplete]);

  // Show loading while initializing
  if (!isInitialized) {
    console.log('[Router] Waiting for initialization...');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
    );
  }

  // Route based on state
  if (!isAuthenticated) {
    console.log('[Router] Not authenticated, redirecting to auth/welcome');
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!isOnboardingComplete) {
    console.log('[Router] Onboarding not complete, redirecting to onboarding/welcome');
    return <Redirect href="/(onboarding)/welcome" />;
  }

  console.log('[Router] All good, redirecting to tabs');
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary.navy,
  },
});
