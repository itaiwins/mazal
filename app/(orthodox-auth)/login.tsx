/**
 * Orthodox Login Screen
 *
 * Sign in to Orthodox Shidduch account
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
import * as Crypto from 'expo-crypto';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function OrthodoxLoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const setOrthodoxMode = useUIStore((s) => s.setOrthodoxMode);
  const setOrthodoxSubscription = useUIStore((s) => s.setOrthodoxSubscription);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First check if this email is registered as Orthodox
      // Note: orthodox_emails table created via migration - types will be generated after migration runs
      const { data: orthodoxEmail } = await (supabase as any)
        .from('orthodox_emails')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (!orthodoxEmail) {
        setError('This email is not registered for Orthodox Shidduch. Please create an account.');
        setIsLoading(false);
        return;
      }

      // Sign in
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.session) {
        // Verify user is Orthodox
        // Note: is_orthodox_user column added via migration
        const { data: userData } = await (supabase as any)
          .from('users')
          .select('is_orthodox_user, orthodox_subscription_status')
          .eq('id', data.session.user.id)
          .single();

        if (!userData?.is_orthodox_user) {
          setError('This account is not set up for Orthodox mode.');
          await supabase.auth.signOut();
          return;
        }

        setSession(data.session);

        // Check subscription status
        if (userData.orthodox_subscription_status === 'active') {
          setOrthodoxSubscription(true);
          setOrthodoxMode(true);
          router.replace('/(orthodox-tabs)');
        } else {
          // Send to paywall
          router.replace('/(orthodox-auth)/paywall');
        }
      }
    } catch (e) {
      console.error('Login error:', e);
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
          // Check if user is Orthodox
          const { data: userData } = await (supabase as any)
            .from('users')
            .select('is_orthodox_user, orthodox_subscription_status')
            .eq('id', data.session.user.id)
            .single();

          if (!userData?.is_orthodox_user) {
            Alert.alert(
              'Not Registered',
              'This Apple ID is not registered for Orthodox Shidduch. Please create an account first.'
            );
            await supabase.auth.signOut();
            return;
          }

          setSession(data.session);

          if (userData.orthodox_subscription_status === 'active') {
            setOrthodoxSubscription(true);
            setOrthodoxMode(true);
            router.replace('/(orthodox-tabs)');
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
          <Text style={styles.starOfDavid}>✡</Text>
          <Text style={styles.hebrewTitle}>ברוכים הבאים</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your journey
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
                placeholder="Enter your password"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
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

          {/* Forgot password */}
          <Pressable
            style={styles.forgotPassword}
            onPress={() => Alert.alert('Coming Soon', 'Password reset will be available soon.')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </Pressable>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.semantic.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Login button */}
          <Pressable
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.primary.gold, '#e6c358']}
              style={styles.loginButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary.navy} />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social login buttons */}
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

        {/* Sign up link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <Pressable onPress={() => router.push('/(orthodox-auth)/register')}>
            <Text style={styles.signUpLink}>Create Account</Text>
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
    alignItems: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[8],
  },
  starOfDavid: {
    fontSize: 48,
    color: colors.primary.gold,
    marginBottom: spacing[2],
  },
  hebrewTitle: {
    fontSize: 24,
    color: colors.primary.gold,
    marginBottom: spacing[1],
    letterSpacing: 2,
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
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary.gold,
    fontWeight: '500',
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
  loginButton: {
    marginTop: spacing[2],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  loginButtonText: {
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
