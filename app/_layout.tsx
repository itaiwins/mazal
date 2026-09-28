/**
 * Root Layout
 *
 * The main entry point that wraps the entire app with providers
 */

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet, View, Text } from 'react-native';

// Providers
import { ThemeProvider } from '@/theme';
import { QueryProvider } from '@/lib/config/queryClient';

// Environment
import { validateEnv, env } from '@/lib/config/env';
import { FEATURE_ORTHODOX_MODE } from '@/lib/config/features';

// Stores
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useShidduchOnboardingStore } from '@/stores/shidduchOnboardingStore';

// Supabase
import { supabase, onAuthStateChange } from '@/api/supabase/client';

// Notifications
import { useNotificationHandler, useNotificationNavigation } from '@/lib/notifications';

// Premium
import { PaywallPromptModal } from '@/components/premium/PaywallPromptModal';
import { initializeRevenueCat } from '@/lib/config/revenuecat';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Font loading map (placeholder - fonts need to be downloaded)
const fontsToLoad = {
  // These are system fonts that work without custom font files
  // In production, replace with actual font files
};

// Notification handler component (hooks must be called inside a component)
function NotificationSetup() {
  useNotificationHandler();
  useNotificationNavigation();
  return null;
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme state from UI store (defaults to dark)
  const isDarkMode = useUIStore((s) => s.isDarkMode);

  // Auth store actions
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setHasShidduchProfile = useAuthStore((s) => s.setHasShidduchProfile);

  useEffect(() => {
    async function prepare() {
      try {
        // Clear old SecureStore session data (migrating to AsyncStorage)
        // This fixes the 2048 byte limit issue that prevented sessions from persisting
        try {
          await SecureStore.deleteItemAsync('supabase-auth-token');
          await SecureStore.deleteItemAsync('supabase.auth.token');
          console.log('[Layout] Cleared old SecureStore session data');
        } catch (e) {
          // Ignore errors - keys may not exist
        }

        // Validate environment configuration
        const envValidation = validateEnv();
        if (!envValidation.isValid && env.isProduction) {
          throw new Error(envValidation.errors.join(', '));
        }

        // Load fonts (skip for now if no custom fonts)
        if (Object.keys(fontsToLoad).length > 0) {
          await Font.loadAsync(fontsToLoad);
        }

        // Initialize RevenueCat for in-app purchases
        console.log('[Layout] Initializing RevenueCat...');
        await initializeRevenueCat();

        console.log('[Layout] Initializing auth...');

        // Initialize auth state
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Layout] Got session:', !!session);

        if (session?.user) {
          // Verify the auth user still exists with timeout
          try {
            const verifyPromise = supabase.auth.getUser();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            );

            const { data: verifyUser, error: verifyError } = await Promise.race([
              verifyPromise,
              timeoutPromise
            ]) as any;

            if (verifyError || !verifyUser?.user) {
              // Auth user was deleted - sign out and clear the stale session
              console.log('[Layout] Auth user no longer exists, signing out... Error:', verifyError);
              console.log('[Layout] SIGN_OUT_REASON: verification_failed');
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
            } else {
              // User exists, proceed normally
              console.log('[Layout] Auth user verified');
              setSession(session);

              // Fetch user profile
              const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', session.user.id)
                .single();

              setUser(profile);

              // Also check if user has a shidduch profile in database
              // (in case metadata wasn't saved correctly). Skipped while Orthodox mode
              // is hidden behind a flag (docs/ROADMAP.md).
              if (profile && FEATURE_ORTHODOX_MODE) {
                const { data: shidduchProfile } = await supabase
                  .from('shidduch_profiles')
                  .select('id')
                  .eq('user_id', profile.id)
                  .single();

                if (shidduchProfile) {
                  console.log('[Layout] Found shidduch profile in database');
                  setHasShidduchProfile(true);
                }
              }
            }
          } catch (verifyErr) {
            // Timeout or error - clear session to be safe
            console.log('[Layout] Verify failed, clearing session:', verifyErr);
            console.log('[Layout] SIGN_OUT_REASON: verification_exception');
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          }
        } else {
          console.log('[Layout] No session');
          setSession(null);
        }

        setInitialized(true);
        setLoading(false);
      } catch (e) {
        console.error('Initialization error:', e);
        setError(e instanceof Error ? e.message : 'Failed to initialize');
      } finally {
        setIsReady(true);
      }
    }

    prepare();

    // Subscribe to auth changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, '| Has session:', !!session);

      // Clear all user data on sign out
      if (event === 'SIGNED_OUT') {
        console.log('[Layout] SIGNED_OUT event received - clearing all stores');
        // Reset onboarding stores to prevent data leaking between accounts
        useOnboardingStore.getState().reset();
        useShidduchOnboardingStore.getState().reset();
        console.log('[Layout] Onboarding stores cleared');
      }

      // Debug: Log token refresh events
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Layout] Token was refreshed successfully');
      }

      setSession(session);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', session.user.id)
          .single();

        setUser(profile);

        // Also check if user has a shidduch profile in database (skipped while
        // Orthodox mode is hidden behind a flag - docs/ROADMAP.md)
        if (profile && FEATURE_ORTHODOX_MODE) {
          const { data: shidduchProfile } = await supabase
            .from('shidduch_profiles')
            .select('id')
            .eq('user_id', profile.id)
            .single();

          if (shidduchProfile) {
            console.log('[Layout] Auth change: Found shidduch profile');
            setHasShidduchProfile(true);
          }
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Something went wrong</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryProvider>
          <ThemeProvider forcedColorScheme={isDarkMode ? 'dark' : 'light'}>
            <NotificationSetup />
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: {
                  backgroundColor: isDarkMode ? '#0A0E1A' : '#FFFFFF',
                },
              }}
            >
              {/* Auth group */}
              <Stack.Screen
                name="(auth)"
                options={{
                  headerShown: false,
                }}
              />

              {/* Auth email deep links (mazal://auth/reset-password, .../confirm) */}
              <Stack.Screen
                name="auth"
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />

              {/* Onboarding group */}
              <Stack.Screen
                name="(onboarding)"
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />

              {/* Safta auth/onboarding group */}
              <Stack.Screen
                name="(safta-auth)"
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />

              {/* Main tabs */}
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                }}
              />

              {/* Orthodox section */}
              <Stack.Screen
                name="(orthodox)"
                options={{
                  headerShown: false,
                }}
              />

              {/* Safta mode (old) */}
              <Stack.Screen
                name="(safta)"
                options={{
                  headerShown: false,
                }}
              />

              {/* Safta mode tabs */}
              <Stack.Screen
                name="(safta-tabs)"
                options={{
                  headerShown: false,
                }}
              />

              {/* Settings */}
              <Stack.Screen
                name="settings"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />

              {/* Profile editing */}
              <Stack.Screen
                name="profile"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />

              {/* Premium paywall */}
              <Stack.Screen
                name="premium"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />

              {/* Legal screens */}
              <Stack.Screen
                name="legal"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
            </Stack>
            <PaywallPromptModal />
          </ThemeProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
