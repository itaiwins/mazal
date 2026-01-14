/**
 * Orthodox Onboarding - Basics Screen
 *
 * Collect basic information: name, date of birth, gender
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
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function OrthodoxOnboardingBasics() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = firstName.trim() && lastName.trim() && gender && birthMonth && birthDay && birthYear;

  const handleContinue = async () => {
    if (!isValid) {
      setError('Please fill in all fields');
      return;
    }

    // Validate date
    const month = parseInt(birthMonth);
    const day = parseInt(birthDay);
    const year = parseInt(birthYear);

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1940 || year > 2010) {
      setError('Please enter a valid birth date');
      return;
    }

    // Calculate age
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setError('You must be at least 18 years old');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (user?.id) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            gender,
            date_of_birth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          })
          .eq('id', user.id);

        if (updateError) {
          setError('Failed to save. Please try again.');
          return;
        }

        router.push('/(orthodox-onboarding)/background');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: '25%' }]} />
          </View>
        </View>

        {/* Title */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.titleSection}>
          <Text style={styles.stepLabel}>Step 1 of 4</Text>
          <Text style={styles.title}>Basic Information</Text>
          <Text style={styles.subtitle}>Tell us a little about yourself</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.form}>
          {/* Name inputs */}
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={colors.neutral[400]}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1 }]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={colors.neutral[400]}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Gender selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              <Pressable
                style={[
                  styles.genderButton,
                  gender === 'male' && styles.genderButtonSelected,
                ]}
                onPress={() => setGender('male')}
              >
                <Ionicons
                  name="male"
                  size={24}
                  color={gender === 'male' ? colors.primary.navy : colors.transparent.white60}
                />
                <Text style={[
                  styles.genderText,
                  gender === 'male' && styles.genderTextSelected,
                ]}>Male</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.genderButton,
                  gender === 'female' && styles.genderButtonSelected,
                ]}
                onPress={() => setGender('female')}
              >
                <Ionicons
                  name="female"
                  size={24}
                  color={gender === 'female' ? colors.primary.navy : colors.transparent.white60}
                />
                <Text style={[
                  styles.genderText,
                  gender === 'female' && styles.genderTextSelected,
                ]}>Female</Text>
              </Pressable>
            </View>
          </View>

          {/* Date of birth */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Date of Birth</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateInputContainer}>
                <TextInput
                  style={styles.dateInput}
                  value={birthMonth}
                  onChangeText={(text) => setBirthMonth(text.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="MM"
                  placeholderTextColor={colors.neutral[400]}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.dateSeparator}>/</Text>
              <View style={styles.dateInputContainer}>
                <TextInput
                  style={styles.dateInput}
                  value={birthDay}
                  onChangeText={(text) => setBirthDay(text.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="DD"
                  placeholderTextColor={colors.neutral[400]}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.dateSeparator}>/</Text>
              <View style={[styles.dateInputContainer, { flex: 1.5 }]}>
                <TextInput
                  style={styles.dateInput}
                  value={birthYear}
                  onChangeText={(text) => setBirthYear(text.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="YYYY"
                  placeholderTextColor={colors.neutral[400]}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.semantic.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </Animated.View>

        {/* Continue button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.continueButton, (!isValid || isLoading) && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isValid || isLoading}
          >
            <LinearGradient
              colors={isValid ? [colors.primary.gold, '#e6c358'] : ['#555', '#444']}
              style={styles.continueButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            >
              <Text style={[
                styles.continueButtonText,
                !isValid && styles.continueButtonTextDisabled,
              ]}>Continue</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={isValid ? colors.primary.navy : colors.neutral[400]}
              />
            </LinearGradient>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: -spacing[2],
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary.gold,
    borderRadius: 2,
  },
  titleSection: {
    marginBottom: spacing[6],
  },
  stepLabel: {
    fontSize: 13,
    color: colors.primary.gold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[2],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white60,
  },
  form: {
    gap: spacing[5],
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing[3],
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
  genderRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  genderButtonSelected: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  genderText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.transparent.white60,
  },
  genderTextSelected: {
    color: colors.primary.navy,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3.5],
    fontSize: 16,
    color: colors.primary.white,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    textAlign: 'center',
  },
  dateSeparator: {
    fontSize: 20,
    color: colors.transparent.white40,
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
  buttonContainer: {
    marginTop: 'auto',
    paddingTop: spacing[6],
  },
  continueButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    shadowOpacity: 0,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  continueButtonTextDisabled: {
    color: colors.neutral[400],
  },
});
