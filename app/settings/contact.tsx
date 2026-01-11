/**
 * Email & Phone Settings Screen
 *
 * Manage contact information
 */

import { useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function ContactSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // In production, these would come from user data
  const [email, setEmail] = useState('user@example.com');
  const [phone, setPhone] = useState('+1 (555) 123-4567');
  const [emailVerified, setEmailVerified] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const handleBack = () => {
    router.back();
  };

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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Email & Phone
        </Text>
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Email Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Email Address
          </Text>
          <View style={[styles.inputCard, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Enter your email"
              placeholderTextColor={theme.colors.textTertiary}
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
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            Used for account recovery and notifications
          </Text>
        </View>

        {/* Phone Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Phone Number
          </Text>
          <View style={[styles.inputCard, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Enter your phone number"
              placeholderTextColor={theme.colors.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            {phoneVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : (
              <Pressable style={styles.verifyButton} onPress={handleVerifyPhone}>
                <Text style={styles.verifyButtonText}>Verify</Text>
              </Pressable>
            )}
          </View>
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            Used for two-factor authentication
          </Text>
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.transparent.gold20 }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            Verifying your email and phone helps secure your account and allows us to help you recover access if needed.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  verifiedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.semantic.success,
  },
  verifyButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary.gold,
    borderRadius: borderRadius.md,
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  hint: {
    fontSize: 13,
    marginTop: spacing[2],
    marginLeft: spacing[1],
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginTop: spacing[6],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
