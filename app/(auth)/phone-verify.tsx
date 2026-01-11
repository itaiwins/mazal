/**
 * Phone Verification Screen
 *
 * Verify phone number with OTP
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/api/supabase/client';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const OTP_LENGTH = 6;

export default function PhoneVerifyScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    // Auto-advance to next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (newOtp.every((d) => d) && newOtp.join('').length === OTP_LENGTH) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length !== OTP_LENGTH) {
      setError('Please enter the complete code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: phone!,
        token: code,
        type: 'sms',
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      router.replace('/(onboarding)/welcome');
    } catch (e) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setResendCooldown(60);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone!,
      });

      if (error) {
        setError(error.message);
        setResendCooldown(0);
      }
    } catch (e) {
      setError('Failed to resend code');
      setResendCooldown(0);
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
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to{'\n'}
          <Text style={styles.phoneNumber}>{phone}</Text>
        </Text>
      </View>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { inputRefs.current[index] = ref; }}
            style={[
              styles.otpInput,
              digit && styles.otpInputFilled,
              error && styles.otpInputError,
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value.slice(-1), index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Error message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Loading */}
      {isLoading && (
        <ActivityIndicator size="large" color={colors.primary.gold} style={styles.loader} />
      )}

      {/* Resend */}
      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <Pressable onPress={handleResend} disabled={resendCooldown > 0}>
          <Text style={[styles.resendLink, resendCooldown > 0 && styles.resendLinkDisabled]}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
          </Text>
        </Pressable>
      </View>
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
    marginBottom: spacing[10],
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
  phoneNumber: {
    fontWeight: '600',
    color: colors.primary.navy,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  otpInput: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    backgroundColor: colors.primary.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.primary.navy,
  },
  otpInputFilled: {
    borderColor: colors.primary.gold,
  },
  otpInputError: {
    borderColor: colors.semantic.error,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  loader: {
    marginTop: spacing[6],
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[8],
  },
  resendText: {
    fontSize: 15,
    color: colors.neutral[600],
  },
  resendLink: {
    fontSize: 15,
    color: colors.primary.gold,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: colors.neutral[400],
  },
});
