/**
 * Forgot Password Screen
 *
 * Request password reset email
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/api/supabase/client';
import { RESET_PASSWORD_REDIRECT_URL } from '@/lib/auth/authDeepLink';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { authErrorMessage } from '@/lib/auth/authErrorMessage';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: RESET_PASSWORD_REDIRECT_URL,
        }
      );

      if (resetError) {
        setError(authErrorMessage(resetError.message, 'resetPassword'));
        return;
      }

      Alert.alert(
        'Check your email',
        'If an account exists with this email, you will receive a password reset link.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Back button */}
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={colors.primary.navy} />
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          No worries! Enter your email and we'll send you a reset link.
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
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

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Reset button */}
        <Pressable
          style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
          onPress={handleResetPassword}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primary.navy} />
          ) : (
            <Text style={styles.resetButtonText}>Send Reset Link</Text>
          )}
        </Pressable>
      </View>

      {/* Back to login */}
      <Pressable style={styles.backToLogin} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={18} color={colors.neutral[600]} />
        <Text style={styles.backToLoginText}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary.cream,
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
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.navy,
    marginBottom: spacing[3],
  },
  subtitle: {
    fontSize: 16,
    color: colors.neutral[600],
    lineHeight: 24,
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
    color: colors.primary.navy,
  },
  input: {
    backgroundColor: colors.primary.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    fontSize: 16,
    color: colors.primary.navy,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  errorContainer: {
    backgroundColor: colors.transparent.black10,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.semantic.error,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[8],
  },
  backToLoginText: {
    fontSize: 15,
    color: colors.neutral[600],
  },
});
