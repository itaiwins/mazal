/**
 * Change Password Screen
 *
 * Premium password settings with dark theme
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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function PasswordSettingsScreen() {
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

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
          <Text style={styles.hint}>At least 8 characters</Text>
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

        {/* Change Button */}
        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <Pressable
            style={[styles.changeButton, !isValid && styles.changeButtonDisabled]}
            onPress={handleChangePassword}
            disabled={!isValid}
          >
            <LinearGradient
              colors={isValid ? [colors.primary.gold, '#b8922a'] : [colors.neutral[600], colors.neutral[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.changeButtonGradient}
            >
              <Ionicons name="shield-checkmark" size={20} color={isValid ? colors.primary.navy : colors.neutral[400]} />
              <Text style={[styles.changeButtonText, !isValid && styles.changeButtonTextDisabled]}>
                Update Password
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Forgot Password Link */}
        <Animated.View entering={FadeInUp.delay(500).springify()}>
          <Pressable
            style={styles.forgotButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Forgot Password', 'A password reset link will be sent to your email.');
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
