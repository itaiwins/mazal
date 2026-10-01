/**
 * Login Screen
 *
 * Sign in with email and password. Apple and Google are not offered here:
 * the providers are off in Supabase, so the buttons came out for the first
 * TestFlight (MEXA-387). Turning them back on is MEXA-389.
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
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/api/supabase/client';
import { EMAIL_CONFIRM_REDIRECT_URL } from '@/lib/auth/authDeepLink';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { FEATURE_ORTHODOX_MODE } from '@/lib/config/features';
import { authErrorMessage } from '@/lib/auth/authErrorMessage';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  // Register hands the address over when it already has an account (MEXA-504).
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when sign-in failed only because the email isn't confirmed yet (MEXA-504).
  const [unconfirmed, setUnconfirmed] = useState<{ email: string; password: string } | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotice(null);
    setUnconfirmed(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(authErrorMessage(authError.message, 'signIn'));
        if (authError.code === 'email_not_confirmed') {
          setUnconfirmed({ email: normalizedEmail, password });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (data.session) {
        console.log('[Login] Login successful');
        setSession(data.session);
        setCurrentMode('user'); // Explicitly set to user mode
        setOrthodoxMode(false); // Ensure Orthodox mode is off for regular login
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Let the main router handle navigation based on onboarding state
        router.replace('/');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Send the confirmation email again (MEXA-504).
   *
   * Not `supabase.auth.resend()`: it sends no PKCE code challenge, so GoTrue mails an
   * implicit-flow link that lands as `mazal://auth/confirm#access_token=...`, which
   * `establishSessionFromAuthLink` refuses outright (MEXA-264). The user would see
   * "This link has expired" for a link that had in fact confirmed them. Calling
   * `signUp` again for an unconfirmed address re-sends the confirmation through the
   * PKCE flow instead (measured live: `pkce_` token, `?code=` redirect, exchange ok).
   *
   * This reveals nothing. GoTrue only answers `email_not_confirmed` once the password
   * has checked out, so whoever reaches this button already proved they own the account.
   */
  const handleResendConfirmation = async () => {
    if (!unconfirmed) return;

    setIsResending(true);
    setError(null);
    setNotice(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: unconfirmed.email,
        password: unconfirmed.password,
        options: { emailRedirectTo: EMAIL_CONFIRM_REDIRECT_URL },
      });

      if (authError) {
        setError(authErrorMessage(authError.message, 'signUp'));
        return;
      }

      if (data.user && data.user.identities?.length === 0) {
        // Confirmed in the meantime (another device, an older link): GoTrue sent nothing.
        setUnconfirmed(null);
        setNotice('Your email is already confirmed. Try signing in again.');
        return;
      }

      setNotice(`We sent a new confirmation link to ${unconfirmed.email}. Check your spam folder if it is not there.`);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsResending(false);
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setUnconfirmed(null);
              }}
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
                onChangeText={(text) => {
                  setPassword(text);
                  setUnconfirmed(null);
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
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

          {/* Forgot password link */}
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>
          </Link>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {notice && (
            <View style={styles.noticeContainer}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          {unconfirmed && (
            <Pressable
              style={styles.resendButton}
              onPress={handleResendConfirmation}
              disabled={isResending}
            >
              {isResending ? (
                <ActivityIndicator color={colors.primary.gold} />
              ) : (
                <Text style={styles.resendButtonText}>Resend confirmation email</Text>
              )}
            </Pressable>
          )}

          {/* Sign in button */}
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
        </View>

        {/* Sign in with Apple and Google were here. Both providers are disabled on the
            live project — `GET /auth/v1/settings` returns `apple: false, google: false` —
            so each button only produced an error, and the Apple one showed Apple's own
            system sheet first, which made it look like Mazal broke after taking the user's
            Apple ID. Removed for the first TestFlight on Lelouch's call (MEXA-387).

            Turning them on is MEXA-389, and they go back together: guideline 4.8 requires
            Sign in with Apple if any other third-party login is offered. The buttons and
            both handlers are in this commit's parent — `git show` rather than a rewrite. */}

        {/* Sign up link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={styles.signUpLink}>Sign up</Text>
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
    backgroundColor: colors.dark.background,
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
    marginTop: spacing[6],
    marginBottom: spacing[8],
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
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary.gold,
    fontWeight: '500',
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
  noticeContainer: {
    backgroundColor: colors.transparent.white10,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.gold,
  },
  noticeText: {
    color: colors.primary.white,
    fontSize: 14,
  },
  resendButton: {
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.primary.gold,
    alignItems: 'center',
  },
  resendButtonText: {
    color: colors.primary.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing[4],
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: spacing[8],
  },
  signUpText: {
    fontSize: 15,
    color: colors.transparent.white60,
  },
  signUpLink: {
    fontSize: 15,
    color: colors.primary.gold,
    fontWeight: '600',
  },
});
