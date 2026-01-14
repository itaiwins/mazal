/**
 * Safta Signup Screen
 *
 * Create a matchmaker account (email + password only, no phone)
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
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
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';

// Required for web browser auth to close properly
WebBrowser.maybeCompleteAuthSession();

export default function SaftaSignupScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const setSession = useAuthStore((s) => s.setSession);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);

  const isValid = email.includes('@') && password.length >= 8 && password === confirmPassword;

  const handleSignup = async () => {
    if (!isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            account_type: 'safta', // Mark this as a Safta account
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        // Session available immediately (email confirmation disabled)
        setSession(data.session);
        setCurrentMode('safta'); // Set to Safta mode
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(safta-auth)/profile-setup');
      } else if (data.user) {
        // Email confirmation required
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Please verify your email to continue.',
          [{ text: 'OK', onPress: () => router.replace('/(safta-auth)/login') }]
        );
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Could not create account. Please try again.');
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
          console.log('[Safta Signup] Apple Sign In successful');
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
      console.log('[Safta Signup] Google redirect URL:', redirectUrl);

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

        console.log('[Safta Signup] Google OAuth result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('[Safta Signup] Callback URL:', result.url);

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
            console.log('[Safta Signup] Google Sign In successful, setting session...');

            // Fire setSession without awaiting
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            // Set mode and navigate after delay
            setCurrentMode('safta');
            setTimeout(() => {
              console.log('[Safta Signup] Navigating after delay...');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setIsLoading(false);
              router.replace('/(safta-auth)/profile-setup');
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
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.headerSection}>
          <Text style={styles.title}>Create Your Account</Text>
          <Text style={styles.subtitle}>
            Sign up to start helping your family find love
          </Text>
        </Animated.View>

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
                placeholder="At least 8 characters"
                placeholderTextColor={colors.transparent.white30}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
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

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.transparent.white50} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (error) setError(null);
                }}
                placeholder="Re-enter password"
                placeholderTextColor={colors.transparent.white30}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
              {password && confirmPassword && password === confirmPassword && (
                <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
              )}
            </View>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </Animated.View>

        {/* Sign up button */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.buttonSection}>
          <Pressable
            style={[styles.signupButton, (!isValid || isLoading) && styles.signupButtonDisabled]}
            onPress={handleSignup}
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primary.navy} />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social signup buttons */}
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

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Pressable onPress={() => router.push('/(safta-auth)/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
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
    backgroundColor: colors.primary.navy,
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
    marginBottom: spacing[8],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white70,
    lineHeight: 22,
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
  errorText: {
    color: colors.semantic.error,
    fontSize: 14,
    textAlign: 'center',
  },
  buttonSection: {
    gap: spacing[4],
  },
  signupButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonDisabled: {
    opacity: 0.5,
  },
  signupButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: colors.transparent.white50,
    fontSize: 15,
  },
  loginLink: {
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
