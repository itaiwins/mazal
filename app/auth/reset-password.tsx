/**
 * Reset Password Screen
 *
 * Landing screen for the `mazal://auth/reset-password` deep link in the password
 * reset email sent by app/(auth)/forgot-password.tsx.
 *
 * The link carries a one-time authorization code. We exchange it for a real
 * session, let the user choose a new password, then sign them out so they prove
 * the new password on the login screen — a recovery session should not become a
 * long-lived logged-in session.
 *
 * That session is the reason for the `AppState` listener below. It is a full
 * auto-refreshing session on the device, and before MEXA-264 it was only torn
 * down on a *successful* save: background or kill the app on this screen and it
 * stayed live indefinitely with the password never changed. So leaving the app
 * before saving ends it, and the user has to request a fresh link.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  AppState,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/api/supabase/client';
import { establishSessionFromAuthLink } from '@/lib/auth/authDeepLink';
import {
  createRecoverySessionGuard,
  type AppStateValue,
  type RecoverySessionGuard,
} from '@/lib/auth/recoverySession';
import { useAuthLink } from '@/lib/auth/useAuthLink';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants/app';

type Status = 'verifying' | 'ready' | 'saving' | 'invalid';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { link, resolved } = useAuthLink();

  const [status, setStatus] = useState<Status>('verifying');
  const [linkExpired, setLinkExpired] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [abandoned, setAbandoned] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The recovery link is single-use; never hand it to GoTrue twice.
  const consumed = useRef(false);

  // Every decision about when this session ends lives in the guard, so that
  // scripts/check-recovery-session.mjs can drive it. See that module's header for
  // why — each previous version of this was wrong in a way only a read caught.
  const guardRef = useRef<RecoverySessionGuard | null>(null);
  if (!guardRef.current) {
    guardRef.current = createRecoverySessionGuard({
      signOut: () => supabase.auth.signOut(),
      getAppState: () => AppState.currentState as AppStateValue,
    });
  }
  const guard = guardRef.current;

  // The AppState listener is subscribed once; this is how it reads the current
  // status without re-subscribing on every keystroke-driven render.
  const statusRef = useRef<Status>(status);
  statusRef.current = status;

  const showAbandoned = useCallback(() => {
    setAbandoned(true);
    setLinkExpired(false);
    setLinkMessage(null);
    setStatus('invalid');
  }, []);

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

      // Backgrounded mid-exchange: the guard's sign-out ran while there was still no
      // session to end, so it ends this one instead of leaving it live.
      if (await guard.afterExchange(result.ok)) return;

      if (!result.ok) {
        setLinkExpired(result.expired);
        setLinkMessage(result.message);
        setStatus('invalid');
        return;
      }

      setStatus('ready');
    })();
  }, [link, resolved, guard]);

  // Bound the recovery session to this visit of this screen (MEXA-264).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      void (async () => {
        if (await guard.onAppStateChange(next as AppStateValue, statusRef.current)) {
          showAbandoned();
        }
      })();
    });

    return () => subscription.remove();
  }, [guard, showAbandoned]);

  /**
   * A failed save is the one moment we know the password did **not** change and no
   * write is in flight, so it is where a session the background listener had to
   * leave alone gets closed. Without it the screen returns to `ready` with the
   * session live, and if the app is still backgrounded no further `AppState` event
   * is coming to catch it (Guts, re-review of `00b5ce0`).
   */
  const settleFailedSave = async (message: string) => {
    const outcome = await guard.settleFailedSave(message);

    if (outcome.render === 'abandoned') {
      showAbandoned();
      return;
    }

    setError(outcome.message);
    setStatus('ready');
  };

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
        await settleFailedSave(updateError.message);
        return;
      }

      // Sign the recovery session out so the new password is what gets them in.
      await guard.endSession();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Password updated',
        'Sign in with your new password.',
        [{ text: 'Sign in', onPress: () => router.replace('/(auth)/login') }],
        { cancelable: false }
      );
    } catch {
      await settleFailedSave('Something went wrong. Please try again.');
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
          <Ionicons
            name={abandoned ? 'lock-closed-outline' : 'time-outline'}
            size={32}
            color={colors.primary.gold}
          />
        </View>
        <Text style={styles.title}>
          {abandoned
            ? 'You left before saving'
            : linkExpired
              ? 'This link has expired'
              : "This link didn't work"}
        </Text>
        <Text style={styles.centeredSubtitle}>
          {abandoned
            ? "Your password hasn't changed. Reset links can only be used once, so request a new one when you're ready to finish."
            : `${linkMessage} Reset links can only be used once, and they expire an hour after we send them.`}
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
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
