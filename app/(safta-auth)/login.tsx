/**
 * Safta Login Screen
 *
 * Sign in for existing Safta (parent/grandparent) accounts
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

// Required for web browser auth to close properly
WebBrowser.maybeCompleteAuthSession();

export default function SaftaLoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (data.session) {
        const saftaOnboardingComplete = data.session.user?.user_metadata?.safta_onboarding_complete;
        console.log('[Safta Login] Onboarding complete:', saftaOnboardingComplete);

        // Set session and switch to Safta mode
        setSession(data.session);
        setCurrentMode('safta');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Route based on Safta onboarding status
        if (saftaOnboardingComplete) {
          // Go to Safta tabs
          router.replace('/(safta-tabs)');
        } else {
          // Go to Safta onboarding
          router.replace('/(safta-auth)/profile-setup');
        }
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Apple Sign In is not available on this device');
        return;
      }

      setIsLoading(true);

      const rawNonce = Crypto.getRandomBytes(16).reduce(
        (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
        ''
      );
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });

        if (error) {
          console.error('Supabase Apple auth error:', error);
          Alert.alert('Error', error.message);
          return;
        }

        if (data.session) {
          console.log('[Safta Login] Apple Sign In successful');
          setSession(data.session);
          setCurrentMode('safta');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          const saftaOnboardingComplete = data.session.user?.user_metadata?.safta_onboarding_complete;
          setTimeout(() => {
            if (saftaOnboardingComplete) {
              router.replace('/(safta-tabs)');
            } else {
              router.replace('/(safta-auth)/profile-setup');
            }
          }, 100);
        }
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        console.log('Apple Sign In cancelled');
      } else {
        console.error('Apple Sign In error:', e);
        Alert.alert('Error', 'Failed to sign in with Apple');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);

      const redirectUrl = 'mazal://auth/callback';
      console.log('[Safta Login] Google redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        Alert.alert('Error', error.message);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
          { showInRecents: true }
        );

        console.log('[Safta Login] Google OAuth result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('[Safta Login] Callback URL:', result.url);

          const url = new URL(result.url);
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          if (url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1));
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }

          if (!accessToken) {
            accessToken = url.searchParams.get('access_token');
            refreshToken = url.searchParams.get('refresh_token');
          }

          if (accessToken) {
            console.log('[Safta Login] Google Sign In successful, setting session...');

            // Set session and get user data
            const { data: sessionData } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            const saftaOnboardingComplete = sessionData?.user?.user_metadata?.safta_onboarding_complete;
            console.log('[Safta Login] Safta onboarding complete:', saftaOnboardingComplete);

            // Set mode and navigate after delay
            setCurrentMode('safta');
            setTimeout(() => {
              console.log('[Safta Login] Navigating after delay...');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setIsLoading(false);
              if (saftaOnboardingComplete) {
                router.replace('/(safta-tabs)');
              } else {
                router.replace('/(safta-auth)/profile-setup');
              }
            }, 500);
            return;
          } else {
            console.error('No access token in callback URL');
            Alert.alert('Error', 'Authentication failed. Please try again.');
          }
        } else if (result.type === 'cancel') {
          console.log('Google Sign In cancelled by user');
        }
      }
    } catch (e) {
      console.error('Google Sign In error:', e);
      Alert.alert('Error', 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d52', colors.primary.navy]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Back button */}
      <Pressable
        style={[styles.backButton, { top: insets.top + spacing[2] }]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 80, paddingBottom: insets.bottom + spacing[4] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.headerSection}>
          <Text style={styles.heroEmoji}>👵💛👴</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to your Safta account
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.formSection}>
          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={colors.transparent.white50} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                placeholder="your@email.com"
                placeholderTextColor={colors.transparent.white30}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.transparent.white50} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError(null);
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.transparent.white30}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={colors.transparent.white50}
                />
              </Pressable>
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </Animated.View>

        {/* Sign in button */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.buttonSection}>
          <Pressable
            style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primary.navy} />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social login buttons */}
          <View style={styles.socialButtons}>
            {Platform.OS === 'ios' && (
              <Pressable
                style={styles.socialButton}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={24} color={colors.primary.white} />
                <Text style={styles.socialButtonText}>Apple</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.socialButton}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={22} color={colors.primary.white} />
              <Text style={styles.socialButtonText}>Google</Text>
            </Pressable>
          </View>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <Pressable onPress={() => router.push('/(safta-auth)/signup')}>
              <Text style={styles.signUpLink}>Create Account</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  backButton: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[6],
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white70,
    textAlign: 'center',
  },
  formSection: {
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  inputContainer: {
    gap: spacing[2],
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.transparent.white70,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  input: {
    flex: 1,
    paddingVertical: spacing[4],
    fontSize: 16,
    color: colors.primary.white,
  },
  errorContainer: {
    backgroundColor: colors.transparent.white10,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.semantic.error,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: 14,
  },
  buttonSection: {
    gap: spacing[4],
  },
  signInButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    color: colors.transparent.white50,
    fontSize: 15,
  },
  signUpLink: {
    color: colors.primary.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[4],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.transparent.white20,
  },
  dividerText: {
    color: colors.transparent.white50,
    paddingHorizontal: spacing[4],
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.transparent.white10,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white20,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary.white,
  },
});
