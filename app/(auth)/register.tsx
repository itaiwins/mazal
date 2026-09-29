/**
 * Register Screen
 *
 * Create a new account with email and password. Apple and Google are not
 * offered here: the providers are off in Supabase, so the buttons came out
 * for the first TestFlight (MEXA-387). Turning them back on is MEXA-389.
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
import { supabase } from '@/api/supabase/client';
import { EMAIL_CONFIRM_REDIRECT_URL } from '@/lib/auth/authDeepLink';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants/app';
import { authErrorMessage } from '@/lib/auth/authErrorMessage';

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
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);

  const validateForm = (): boolean => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
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
          // Without this the confirmation link falls back to the project's
          // `site_url`, which opens the app with nothing to show for it.
          emailRedirectTo: EMAIL_CONFIRM_REDIRECT_URL,
          data: {
            // Will be updated during onboarding
          },
        },
      });

      if (authError) {
        // Not `authError.message`: a domain that cannot receive mail returns a 500 and
        // GoTrue's own "Error sending confirmation email", which reads like a server fault
        // rather than a typo — and the account is rolled back (MEXA-338, finding 11).
        setError(authErrorMessage(authError.message, 'signUp'));
        return;
      }

      if (data.session) {
        setSession(data.session);
        setOrthodoxMode(false); // Ensure Orthodox mode is off for regular registration
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
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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

        {/* Sign in with Apple and Google were here. Both providers are disabled on the
            live project — `GET /auth/v1/settings` returns `apple: false, google: false` —
            so each button only produced an error, and the Apple one showed Apple's own
            system sheet first, which made it look like Mazal broke after taking the user's
            Apple ID. Removed for the first TestFlight on Lelouch's call (MEXA-387).

            Turning them on is MEXA-389, and they go back together: guideline 4.8 requires
            Sign in with Apple if any other third-party login is offered. The buttons and
            both handlers are in this commit's parent — `git show` rather than a rewrite. */}

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
