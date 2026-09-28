/**
 * Email Confirmation Screen
 *
 * Landing screen for the `mazal://auth/confirm` deep link in the sign-up
 * confirmation email (see the `emailRedirectTo` passed by app/(auth)/register.tsx
 * and app/(safta-auth)/signup.tsx).
 *
 * The project still requires email confirmation (`mailer_autoconfirm` is off), so
 * this is the screen that tells a new user their address is confirmed and hands
 * them on to onboarding. Without it the link lands on `site_url` and the app
 * gives no sign that anything happened.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { establishSessionFromAuthLink } from '@/lib/auth/authDeepLink';
import { useAuthLink } from '@/lib/auth/useAuthLink';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

type Status = 'verifying' | 'confirmed' | 'invalid';

export default function ConfirmEmailScreen() {
  const insets = useSafeAreaInsets();
  const { link, resolved } = useAuthLink();
  const { flow } = useLocalSearchParams<{ flow?: string }>();

  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);

  const [status, setStatus] = useState<Status>('verifying');
  const [linkExpired, setLinkExpired] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<string | undefined>(undefined);

  // The confirmation link is single-use.
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current || !resolved) return;

    if (!link) {
      consumed.current = true;
      setLinkExpired(false);
      setLinkMessage('Open the link in the confirmation email we sent you.');
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

      setLinkType(result.type);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus('confirmed');
    })();
  }, [link, resolved]);

  const handleContinue = () => {
    // Matchmaker sign-ups go to their own profile setup. Guarded by the flag so a
    // stale link can never open the hidden mode (docs/ROADMAP.md).
    if (flow === 'safta' && FEATURE_SAFTA_MODE) {
      setCurrentMode('safta');
      router.replace('/(safta-auth)/profile-setup');
      return;
    }

    // A brand new account has no profile yet, so send it to onboarding. Anything
    // else (a re-confirmation, an email change) goes through the root router,
    // which already knows where that user belongs.
    if (linkType === 'signup' && !isOnboardingComplete) {
      setOrthodoxMode(false);
      router.replace('/(onboarding)/welcome');
      return;
    }

    router.replace('/');
  };

  if (status === 'verifying') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
        <Text style={styles.note}>Confirming your email…</Text>
      </View>
    );
  }

  if (status === 'invalid') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-unread-outline" size={32} color={colors.primary.gold} />
        </View>
        <Text style={styles.title}>
          {linkExpired ? 'This link has expired' : "We couldn't confirm your email"}
        </Text>
        <Text style={styles.subtitle}>
          {linkMessage} Sign in and we'll send you a fresh confirmation email.
        </Text>

        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.primaryButtonText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
      <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
        <Ionicons name="checkmark" size={36} color={colors.semantic.success} />
      </View>
      <Text style={styles.title}>Email confirmed</Text>
      <Text style={styles.subtitle}>
        Your email address is verified. Let's set up your profile.
      </Text>

      <Pressable style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
    </View>
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
  note: {
    marginTop: spacing[4],
    fontSize: 15,
    color: colors.transparent.white70,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconCircleSuccess: {
    backgroundColor: colors.transparent.success10,
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
    marginBottom: spacing[8],
  },
  primaryButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
});
