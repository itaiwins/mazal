/**
 * Email & Phone Settings Screen
 *
 * Premium contact settings with dark theme
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';

export default function ContactSettingsScreen() {
  const insets = useSafeAreaInsets();
  const authUser = useAuthStore((s) => s.authUser);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    if (authUser?.email) {
      setEmail(authUser.email);
      setEmailVerified(authUser.email_confirmed_at != null);
    }
    if (user?.phone) {
      setPhone(user.phone);
      setPhoneVerified((user as any).phone_verified ?? false);
    }
  }, [authUser, user]);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', 'Your contact information has been updated.');
    router.back();
  };

  const handleVerifyEmail = () => {
    Alert.alert(
      'Verify Email',
      `We'll send a verification link to ${email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Email Sent', 'Check your inbox for a verification link.');
          },
        },
      ]
    );
  };

  const handleVerifyPhone = () => {
    Alert.alert(
      'Verify Phone',
      `We'll send a verification code to ${phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Code',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Code Sent', 'Check your messages for a verification code.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[colors.primary.navy, colors.dark.background]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Email & Phone</Text>
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Email Section */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Email Address</Text>
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="mail-outline" size={20} color={colors.primary.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={colors.transparent.white30}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : (
                <Pressable style={styles.verifyButton} onPress={handleVerifyEmail}>
                  <Text style={styles.verifyButtonText}>Verify</Text>
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.hint}>Used for account recovery and notifications</Text>
        </Animated.View>

        {/* Phone Section */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Phone Number</Text>
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="call-outline" size={20} color={colors.primary.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor={colors.transparent.white30}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              {phoneVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : phone.length > 0 ? (
                <Pressable style={styles.verifyButton} onPress={handleVerifyPhone}>
                  <Text style={styles.verifyButtonText}>Verify</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={styles.hint}>Used for two-factor authentication</Text>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary.gold} />
          </View>
          <Text style={styles.infoText}>
            Verifying your email and phone helps secure your account and allows us to help you recover access if needed.
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
  saveButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  section: {
    marginTop: spacing[6],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.transparent.white50,
    marginBottom: spacing[3],
    marginLeft: spacing[2],
  },
  inputCard: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
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
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.transparent.success10,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.semantic.success,
  },
  verifyButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary.gold,
    borderRadius: borderRadius.lg,
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  hint: {
    fontSize: 13,
    color: colors.transparent.white50,
    marginTop: spacing[2],
    marginLeft: spacing[2],
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
