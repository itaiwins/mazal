/**
 * Register Screen
 *
 * Create a new account with email
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
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

// Required for web browser auth to close properly
WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);

  const validateForm = (): boolean => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return false;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (!isOver18) {
      setError('You must be 18 or older to use Mazal');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            // Will be updated during onboarding
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.session) {
        setSession(data.session);
        // Navigate to onboarding
        router.replace('/(onboarding)/welcome');
      } else if (data.user) {
        // Email confirmation required
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Please verify your email to continue.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Apple Sign In is not available on this device');
        return;
      }

      setIsLoading(true);

      // Generate nonce for security
      const rawNonce = Crypto.getRandomBytes(16).reduce(
        (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
        ''
      );
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // Request credentials from Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        // Sign in with Supabase using the Apple ID token
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
          console.log('[Register] Apple Sign In successful');
          setSession(data.session);
          router.replace('/');
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

      // Use the app's custom scheme for redirect
      const redirectUrl = 'mazal://auth/callback';

      console.log('[Register] Google redirect URL:', redirectUrl);

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
        // Open the OAuth URL in a web browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
          { showInRecents: true }
        );

        console.log('[Register] Google OAuth result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('[Register] Callback URL:', result.url);

          // Extract the tokens from the URL (could be in hash or query params)
          const url = new URL(result.url);
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          // Check hash fragment first (implicit flow)
          if (url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1));
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }

          // Check query params (PKCE flow)
          if (!accessToken) {
            accessToken = url.searchParams.get('access_token');
            refreshToken = url.searchParams.get('refresh_token');
          }

          if (accessToken) {
            console.log('[Register] Google Sign In successful, setting session...');

            // Fire setSession without awaiting
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            // Wait 500ms for session to be set, then navigate
            setTimeout(() => {
              console.log('[Register] Navigating after delay...');
              setIsLoading(false);
              router.replace('/');
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
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Find your Mazal</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={colors.transparent.white50}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm password input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={colors.transparent.white50}
                />
              </Pressable>
            </View>
          </View>

          {/* Age Verification */}
          <Pressable
            style={styles.ageCheckbox}
            onPress={() => setIsOver18(!isOver18)}
          >
            <View style={[styles.checkbox, isOver18 && styles.checkboxChecked]}>
              {isOver18 && (
                <Ionicons name="checkmark" size={16} color={colors.primary.navy} />
              )}
            </View>
            <Text style={styles.ageCheckboxText}>
              I confirm that I am 18 years or older
            </Text>
          </Pressable>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Create account button */}
          <Pressable
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primary.navy} />
            ) : (
              <Text style={styles.createButtonText}>Create Account</Text>
            )}
          </Pressable>
        </View>

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

        {/* Terms */}
        <Text style={styles.termsText}>
          By creating an account, you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>

        {/* Sign in link */}
        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={styles.signInLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.navy,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: -spacing[2],
  },
  header: {
    marginTop: spacing[4],
    marginBottom: spacing[6],
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
  },
  form: {
    gap: spacing[4],
  },
  inputContainer: {
    gap: spacing[2],
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary.white,
  },
  input: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    fontSize: 16,
    color: colors.primary.white,
    borderWidth: 1,
    borderColor: colors.transparent.white20,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: spacing[12],
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing[4],
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
  ageCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.transparent.white50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  ageCheckboxText: {
    flex: 1,
    fontSize: 14,
    color: colors.transparent.white70,
  },
  createButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[6],
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
  termsText: {
    fontSize: 12,
    color: colors.transparent.white50,
    textAlign: 'center',
    marginTop: spacing[6],
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary.gold,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: spacing[6],
  },
  signInText: {
    fontSize: 15,
    color: colors.transparent.white60,
  },
  signInLink: {
    fontSize: 15,
    color: colors.primary.gold,
    fontWeight: '600',
  },
});
