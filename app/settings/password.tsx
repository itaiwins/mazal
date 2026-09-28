/**
 * Change Password Screen
 *
 * Settings → Change Password. Reauthenticates against the current password,
 * then changes it for real.
 *
 * Why the reauthentication step: `supabase.auth.updateUser({ password })` only
 * needs a valid session, not the old password, and this project has
 * `security_update_password_require_reauthentication` off. Without a check,
 * anyone holding an unlocked phone could take the account over from this
 * screen, so we sign in once with the entered current password first. That call
 * also mints a fresh session, which is what the update then runs against.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/api/supabase/client';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

/**
 * The app asks for 8 everywhere it sets a password (register, reset-password).
 * The project's own minimum is 6, so accounts created before that can have a
 * shorter current password — which is why only the *new* password is held to
 * this, and the current one just has to be non-empty.
 */
const MIN_PASSWORD_LENGTH = 8;

type Status = 'loading' | 'ready' | 'saving' | 'unavailable';

export default function PasswordSettingsScreen() {
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<Status>('loading');
  const [unavailableMessage, setUnavailableMessage] = useState('');
  const [email, setEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We reauthenticate with email + password, so the screen only works for
  // accounts that actually sign in that way (not phone-only accounts).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error: userError } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !data.user) {
        setUnavailableMessage("We couldn't load your account. Sign in again and retry.");
        setStatus('unavailable');
        return;
      }

      const identities = data.user.identities;
      const hasPasswordLogin = identities
        ? identities.some((identity) => identity.provider === 'email')
        : Boolean(data.user.email);

      if (!data.user.email || !hasPasswordLogin) {
        setUnavailableMessage(
          "This account doesn't sign in with an email and password, so there's no password to change."
        );
        setStatus('unavailable');
        return;
      }

      setEmail(data.user.email);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isSaving = status === 'saving';

  const isValid =
    status !== 'loading' &&
    status !== 'unavailable' &&
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword;

  const handleChangePassword = async () => {
    if (isSaving) return;

    if (currentPassword.length === 0) {
      setError('Enter your current password.');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      // 1. Prove the person at the keyboard knows the current password.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setError(
          signInError.code === 'invalid_credentials'
            ? 'That current password is incorrect.'
            : signInError.message
        );
        setStatus('ready');
        return;
      }

      // 2. Now actually change it.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(
          updateError.code === 'same_password'
            ? 'Your new password must be different from your current one.'
            : updateError.message
        );
        setStatus('ready');
        return;
      }

      // 3. Drop every other session. Someone changing their password because
      //    they think the account is compromised expects the other device to
      //    lose access. `others` leaves this device signed in and fires no
      //    SIGNED_OUT event, so it can't bounce us to the login screen. Best
      //    effort: the password did change either way, so a failure here must
      //    not be reported as a failed password change.
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
      if (signOutError) {
        console.warn('[password] could not revoke other sessions:', signOutError.message);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus('ready');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Password changed',
        'Your password has been updated. Any other devices signed in to this account have been signed out.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('ready');
    }
  };

  /* Premium Header with Gradient */
  const header = (
    <LinearGradient
      colors={[colors.primary.navy, colors.dark.background]}
      style={[styles.headerGradient, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerRight} />
      </View>
    </LinearGradient>
  );

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.gold} />
        </View>
      </View>
    );
  }

  if (status === 'unavailable') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary.gold} />
          </View>
          <Text style={styles.centeredText}>{unavailableMessage}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current Password */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.field}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputContainer}>
            <View style={styles.inputIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.primary.gold} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              placeholderTextColor={colors.transparent.white30}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              textContentType="password"
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowCurrent(!showCurrent)}
            >
              <Ionicons
                name={showCurrent ? 'eye-off' : 'eye'}
                size={20}
                color={colors.transparent.white50}
              />
            </Pressable>
          </View>
        </Animated.View>

        {/* New Password */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputContainer}>
            <View style={styles.inputIcon}>
              <Ionicons name="key-outline" size={20} color={colors.primary.gold} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor={colors.transparent.white30}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              textContentType="newPassword"
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowNew(!showNew)}
            >
              <Ionicons
                name={showNew ? 'eye-off' : 'eye'}
                size={20}
                color={colors.transparent.white50}
              />
            </Pressable>
          </View>
          <Text style={styles.hint}>At least {MIN_PASSWORD_LENGTH} characters</Text>
        </Animated.View>

        {/* Confirm Password */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.field}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={[
            styles.inputContainer,
            confirmPassword.length > 0 && newPassword !== confirmPassword && styles.inputError
          ]}>
            <View style={styles.inputIcon}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary.gold} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.transparent.white30}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              textContentType="newPassword"
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowConfirm(!showConfirm)}
            >
              <Ionicons
                name={showConfirm ? 'eye-off' : 'eye'}
                size={20}
                color={colors.transparent.white50}
              />
            </Pressable>
          </View>
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <Text style={styles.error}>Passwords do not match</Text>
          )}
        </Animated.View>

        {/* Server / submit errors */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Change Button */}
        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <Pressable
            style={[styles.changeButton, (!isValid || isSaving) && styles.changeButtonDisabled]}
            onPress={handleChangePassword}
            disabled={!isValid || isSaving}
          >
            <LinearGradient
              colors={isValid && !isSaving ? [colors.primary.gold, '#b8922a'] : [colors.neutral[600], colors.neutral[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.changeButtonGradient}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.neutral[400]} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color={isValid ? colors.primary.navy : colors.neutral[400]} />
                  <Text style={[styles.changeButtonText, !isValid && styles.changeButtonTextDisabled]}>
                    Update Password
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Forgot Password Link */}
        <Animated.View entering={FadeInUp.delay(500).springify()}>
          <Pressable
            style={styles.forgotButton}
            disabled={isSaving}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(auth)/forgot-password');
            }}
          >
            <Text style={styles.forgotButtonText}>Forgot your current password?</Text>
          </Pressable>
        </Animated.View>

        {/* Security Info */}
        <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary.gold} />
          </View>
          <Text style={styles.infoText}>
            Use a strong password with a mix of letters, numbers, and symbols to keep your account secure.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  headerGradient: {
    paddingBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[4],
  },
  centeredText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.transparent.white70,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: colors.transparent.white10,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.semantic.error,
    marginTop: spacing[2],
  },
  errorBannerText: {
    fontSize: 14,
    color: colors.semantic.error,
  },
  field: {
    marginBottom: spacing[5],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.transparent.white70,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  inputError: {
    borderColor: colors.semantic.error,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.primary.white,
    paddingVertical: spacing[4],
  },
  eyeButton: {
    padding: spacing[2],
  },
  hint: {
    fontSize: 13,
    color: colors.transparent.white50,
    marginTop: spacing[2],
    marginLeft: spacing[1],
  },
  error: {
    fontSize: 13,
    color: colors.semantic.error,
    marginTop: spacing[2],
    marginLeft: spacing[1],
  },
  changeButton: {
    marginTop: spacing[4],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  changeButtonDisabled: {
    opacity: 0.7,
  },
  changeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  changeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  changeButtonTextDisabled: {
    color: colors.neutral[400],
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: spacing[4],
    paddingVertical: spacing[2],
  },
  forgotButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary.gold,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    gap: spacing[3],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: colors.transparent.gold20,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.transparent.white70,
  },
});
