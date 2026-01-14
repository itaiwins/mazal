/**
 * Shidduch Onboarding - Basics
 *
 * Collect basic personal information for the shidduch resume
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useShidduchOnboardingStore } from '@/stores/shidduchOnboardingStore';

const GENDERS = [
  { id: 'male', label: 'Man', hebrewLabel: 'בחור' },
  { id: 'female', label: 'Woman', hebrewLabel: 'בחורה' },
];

export default function ShidduchBasicsScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useShidduchOnboardingStore();

  const [firstName, setFirstName] = useState(data.firstName || '');
  const [lastName, setLastName] = useState(data.lastName || '');
  const [hebrewName, setHebrewName] = useState(data.hebrewName || '');
  const [birthDate, setBirthDate] = useState<Date>(
    data.birthDate ? new Date(data.birthDate) : new Date(2000, 0, 1)
  );
  const [gender, setGender] = useState(data.gender || '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const calculateAge = (date: Date) => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(birthDate);
  const isOver18 = age >= 18;
  const isValid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && gender && isOver18;

  const handleContinue = () => {
    updateData({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      hebrewName: hebrewName.trim(),
      birthDate: birthDate.toISOString(),
      gender,
      age,
    });
    router.push('/(shidduch-onboarding)/family');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0a1628']}
      style={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#d4af37" />
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: '22%' }]} />
        </View>
        <Text style={styles.stepText}>2 of 9</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>פרטים אישיים</Text>
          <Text style={styles.title}>Personal Details</Text>
          <Text style={styles.subtitle}>Let's start with the basics</Text>
        </Animated.View>

        {/* First Name */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.field}>
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Your first name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
          />
        </Animated.View>

        {/* Last Name */}
        <Animated.View entering={FadeInDown.delay(350)} style={styles.field}>
          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Your family name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="family-name"
          />
        </Animated.View>

        {/* Hebrew Name */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.field}>
          <Text style={styles.label}>Hebrew Name</Text>
          <Text style={styles.labelHint}>e.g., Moshe ben Avraham</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Hebrew name (optional)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={hebrewName}
            onChangeText={setHebrewName}
          />
        </Animated.View>

        {/* Gender */}
        <Animated.View entering={FadeInDown.delay(450)} style={styles.field}>
          <Text style={styles.label}>I am a *</Text>
          <View style={styles.genderOptions}>
            {GENDERS.map((g) => (
              <Pressable
                key={g.id}
                style={[
                  styles.genderOption,
                  gender === g.id && styles.genderOptionSelected,
                ]}
                onPress={() => setGender(g.id)}
              >
                <Text style={styles.genderHebrew}>{g.hebrewLabel}</Text>
                <Text style={[
                  styles.genderLabel,
                  gender === g.id && styles.genderLabelSelected,
                ]}>
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Birth Date */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.field}>
          <Text style={styles.label}>Date of Birth *</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>{formatDate(birthDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color="#d4af37" />
          </Pressable>
          <Text style={[
            styles.ageText,
            !isOver18 && styles.ageTextError
          ]}>
            {!isOver18
              ? 'You must be 18 or older'
              : `${age} years old`}
          </Text>
        </Animated.View>

        {showDatePicker && (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setBirthDate(date);
            }}
            maximumDate={new Date(new Date().getFullYear() - 18, 0, 1)}
            minimumDate={new Date(1940, 0, 1)}
            themeVariant="dark"
            textColor="#FFFFFF"
          />
        )}
      </ScrollView>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInDown.delay(600)}
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable
          style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <LinearGradient
            colors={isValid ? ['#d4af37', '#f4d47c', '#d4af37'] : ['#333', '#444', '#333']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
              Continue
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={isValid ? '#0a1628' : '#666'}
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginHorizontal: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#d4af37',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    width: 50,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  hebrewTitle: {
    fontSize: 28,
    color: '#d4af37',
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 32,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    marginTop: -4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  genderOptionSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  genderHebrew: {
    fontSize: 24,
    color: '#d4af37',
    marginBottom: 4,
  },
  genderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  genderLabelSelected: {
    color: '#FFFFFF',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  ageText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  ageTextError: {
    color: '#ff6b6b',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(10, 22, 40, 0.95)',
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonDisabled: {
    shadowOpacity: 0,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
  },
  buttonTextDisabled: {
    color: '#666',
  },
});
