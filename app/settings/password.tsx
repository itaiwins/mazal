/**
 * Change Password Screen
 *
 * Update account password
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

export default function PasswordSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const isValid =
    currentPassword.length >= 8 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const handleChangePassword = () => {
    if (!isValid) {
      Alert.alert('Error', 'Please fill in all fields correctly.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Password Changed',
      'Your password has been updated successfully.',
      [{ text: 'OK', onPress: () => router.back() }]
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
          Change Password
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Current Password
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Enter current password"
              placeholderTextColor={theme.colors.textTertiary}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
            />
            <Pressable onPress={() => setShowCurrent(!showCurrent)}>
              <Ionicons
                name={showCurrent ? 'eye-off' : 'eye'}
                size={22}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>

        {/* New Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            New Password
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Enter new password"
              placeholderTextColor={theme.colors.textTertiary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
            />
            <Pressable onPress={() => setShowNew(!showNew)}>
              <Ionicons
                name={showNew ? 'eye-off' : 'eye'}
                size={22}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            At least 8 characters
          </Text>
        </View>

        {/* Confirm Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Confirm New Password
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Re-enter new password"
              placeholderTextColor={theme.colors.textTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
            />
            <Pressable onPress={() => setShowConfirm(!showConfirm)}>
              <Ionicons
                name={showConfirm ? 'eye-off' : 'eye'}
                size={22}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          </View>
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <Text style={[styles.error]}>Passwords do not match</Text>
          )}
        </View>

        {/* Change Button */}
        <Pressable
          style={[
            styles.changeButton,
            !isValid && styles.changeButtonDisabled,
          ]}
          onPress={handleChangePassword}
          disabled={!isValid}
        >
          <Text style={styles.changeButtonText}>Update Password</Text>
        </Pressable>

        {/* Forgot Password Link */}
        <Pressable
          style={styles.forgotButton}
          onPress={() => Alert.alert('Forgot Password', 'A password reset link will be sent to your email.')}
        >
          <Text style={[styles.forgotButtonText, { color: colors.primary.gold }]}>
            Forgot your current password?
          </Text>
        </Pressable>
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
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  field: {
    marginBottom: spacing[5],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  hint: {
    fontSize: 13,
    marginTop: spacing[2],
  },
  error: {
    fontSize: 13,
    marginTop: spacing[2],
    color: colors.semantic.error,
  },
  changeButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing[4],
  },
  changeButtonDisabled: {
    opacity: 0.5,
  },
  changeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: spacing[4],
    paddingVertical: spacing[2],
  },
  forgotButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
