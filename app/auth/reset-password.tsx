/**
 * Reset Password Screen
 *
 * Landing screen for the `mazal://auth/reset-password` deep link in the password
 * reset email sent by app/(auth)/forgot-password.tsx.
 *
 * The link carries a one-time recovery session in the URL fragment. We turn that
 * into a real session, let the user choose a new password, then sign them out so
 * they prove the new password on the login screen — a recovery session should not
 * become a long-lived logged-in session.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/api/supabase/client';
import { establishSessionFromAuthLink } from '@/lib/auth/authDeepLink';
import { useAuthLink } from '@/lib/auth/useAuthLink';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const MIN_PASSWORD_LENGTH = 8;

type Status = 'verifying' | 'ready' | 'saving' | 'invalid';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { link, resolved } = useAuthLink();

  const [status, setStatus] = useState<Status>('verifying');
  const [linkExpired, setLinkExpired] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The recovery link is single-use; never hand it to GoTrue twice.
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current || !resolved) return;

    if (!link) {
      consumed.current = true;
      setLinkExpired(false);
      setLinkMessage('Open the link in the password reset email we sent you.');
      setStatus('invalid');
      return;
    }

    consumed.current = true;

    (async () => {
      const result = await establishSessionFromAuthLink(link);

      if (!result.ok) {
        setLinkExpired(result.expired);
        setLinkMessage(result.message);
        setStatus('invalid');
        return;
      }

      setStatus('ready');
    })();
  }, [link, resolved]);

  const handleSave = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      // No `current_password` here, unlike Settings → Change Password: the
      // whole point of this screen is that the user does not know it. GoTrue
      // skips the `security_update_password_require_current_password` check on
      // a recovery session (`internal/api/user.go:175`), and the session this
      // screen runs on carries `amr: ['otp']`, so the check does not apply.
      // Verified live against the flag on — see MEXA-272. Do not "fix" this by
      // adding the field; it would break password reset.
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        setStatus('ready');
        return;
      }

      // Sign the recovery session out so the new password is what gets them in.
      await supabase.auth.signOut();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Password updated',
        'Sign in with your new password.',
        [{ text: 'Sign in', onPress: () => router.replace('/(auth)/login') }],
        { cancelable: false }
      );
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('ready');
    }
  };

  if (status === 'verifying') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
        <Text style={styles.centeredNote}>Checking your reset link…</Text>
      </View>
    );
  }

  if (status === 'invalid') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={32} color={colors.primary.gold} />
        </View>
        <Text style={styles.title}>
          {linkExpired ? 'This link has expired' : "This link didn't work"}
        </Text>
        <Text style={styles.centeredSubtitle}>
          {linkMessage} Reset links can only be used once, and they expire an hour
          after we send them.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace('/(auth)/forgot-password')}
        >
          <Text style={styles.primaryButtonText}>Request a new link</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.secondaryButtonText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  const isSaving = status === 'saving';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing[8] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>
            You're signed in from your reset link. Pick a new password to finish.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>New password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.transparent.white30}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
                textContentType="newPassword"
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() => setShowPassword((value) => !value)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.transparent.white50}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your new password"
              placeholderTextColor={colors.transparent.white30}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              textContentType="newPassword"
            />
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.primary.navy} />
            ) : (
              <Text style={styles.primaryButtonText}>Save new password</Text>
            )}
          </Pressable>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  centeredNote: {
    marginTop: spacing[4],
    fontSize: 15,
    color: colors.transparent.white70,
  },
  centeredSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.transparent.white70,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    marginBottom: spacing[8],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.transparent.white70,
    textAlign: 'center',
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
  primaryButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing[2],
    alignSelf: 'stretch',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.transparent.white70,
  },
});
