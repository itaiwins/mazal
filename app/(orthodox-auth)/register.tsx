/**
 * Orthodox Register Screen
 *
 * Create an Orthodox account with email verification
 * Emails used here are locked to Orthodox mode only
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
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { DEV_BYPASS_PREMIUM } from '@/lib/config/revenuecat';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

WebBrowser.maybeCompleteAuthSession();

export default function OrthodoxRegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);
  const setOrthodoxSubscription = useUIStore((s) => s.setOrthodoxSubscription);

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

    return true;
  };

  // There used to be a checkEmailNotInUse() here that asked, before sign-up, whether an
  // address was already taken - by selecting from `orthodox_emails` and from `users` as
  // `anon`. MEXA-279 removed it, for two reasons:
  //
  //   * It never worked. Both tables' SELECT policies are scoped to the signed-in owner
  //     (`auth.uid()`), so a caller with no session matched nothing and the check always
  //     concluded "address is free". Since 00013 (MEXA-261) `anon` holds no privilege on
  //     `users` at all, so the same call now raises 42501 instead - which the `catch` also
  //     read as "address is free".
  //   * It should not be made to work. An endpoint that answers "is this address
  //     registered?" to an unauthenticated caller is an account-enumeration primitive, and
  //     on a dating app the answer is sensitive on its own.
  //
  // supabase.auth.signUp() below already rejects a duplicate address, and its error is
  // surfaced to the user, so nothing is lost but the wrong answer.

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Create the account. signUp() is where a duplicate address is caught now.
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            is_orthodox_user: true,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.session) {
        // Register email as Orthodox-only
        // Note: register_orthodox_email function created via migration
        await (supabase as any).rpc('register_orthodox_email', {
          user_email: email.trim().toLowerCase(),
          user_uuid: data.session.user.id,
        });

        // Update user record
        // Note: session.user.id is the Supabase Auth ID, must match users.auth_id
        await (supabase as any)
          .from('users')
          .update({ is_orthodox_user: true })
          .eq('auth_id', data.session.user.id);

        setSession(data.session);

        // DEV: Skip paywall and go directly to onboarding
        if (DEV_BYPASS_PREMIUM) {
          setOrthodoxMode(true);
          setOrthodoxSubscription(true);
          router.replace('/(shidduch-onboarding)/welcome');
        } else {
          // Navigate to paywall
          router.replace('/(orthodox-auth)/paywall');
        }
      } else if (data.user) {
        // Email confirmation required
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Please verify your email to continue.',
          [{ text: 'OK', onPress: () => router.replace('/(orthodox-auth)/login') }]
        );
      }
    } catch (e) {
      console.error('Registration error:', e);
      setError('Something went wrong. Please try again.');
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
          Alert.alert('Error', error.message);
          return;
        }

        if (data.session) {
          // Mark as Orthodox user
          // Note: session.user.id is the Supabase Auth ID, must match users.auth_id
          await (supabase as any)
            .from('users')
            .update({ is_orthodox_user: true })
            .eq('auth_id', data.session.user.id);

          // Register email as Orthodox-only
          // Note: register_orthodox_email function created via migration
          const userEmail = data.session.user.email;
          if (userEmail) {
            await (supabase as any).rpc('register_orthodox_email', {
              user_email: userEmail.toLowerCase(),
              user_uuid: data.session.user.id,
            });
          }

          setSession(data.session);

          // DEV: Skip paywall and go directly to onboarding
          if (DEV_BYPASS_PREMIUM) {
            setOrthodoxMode(true);
            setOrthodoxSubscription(true);
            router.replace('/(shidduch-onboarding)/welcome');
          } else {
            router.replace('/(orthodox-auth)/paywall');
          }
        }
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', 'Failed to sign in with Apple');
      }
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
        colors={['#0a1628', '#0f1d36', '#1a2d52', '#0f1d36', '#0a1628']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.hebrewTitle}>הצטרפות</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Begin your journey to find your bashert
          </Text>
        </View>

        {/* Important notice */}
        <View style={styles.noticeContainer}>
          <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
          <Text style={styles.noticeText}>
            This email will be exclusively for Orthodox Shidduch and cannot be used for the regular Mazal app.
          </Text>
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

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.semantic.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Create account button */}
          <Pressable
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.primary.gold, '#e6c358']}
              style={styles.createButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary.navy} />
              ) : (
                <>
                  <Text style={styles.createButtonText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
                </>
              )}
            </LinearGradient>
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
          <Pressable onPress={() => router.push('/(orthodox-auth)/login')}>
            <Text style={styles.signInLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
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
    marginTop: spacing[2],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  hebrewTitle: {
    fontSize: 28,
    color: colors.primary.gold,
    marginBottom: spacing[1],
    letterSpacing: 4,
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
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[6],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.transparent.gold70,
    lineHeight: 18,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    fontSize: 16,
    color: colors.primary.white,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    padding: spacing[3],
    borderRadius: borderRadius.md,
    gap: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  errorText: {
    flex: 1,
    color: colors.semantic.error,
    fontSize: 14,
  },
  createButton: {
    marginTop: spacing[2],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  createButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[6],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  dividerText: {
    color: colors.transparent.white50,
    paddingHorizontal: spacing[4],
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[4],
  },
  socialButton: {
    flex: 1,
    maxWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
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
