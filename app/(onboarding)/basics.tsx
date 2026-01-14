/**
 * Basics Screen
 *
 * Collect name, birthday, and gender
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';

const GENDERS = [
  { id: 'male', label: 'Man', icon: 'male' },
  { id: 'female', label: 'Woman', icon: 'female' },
  { id: 'non_binary', label: 'Non-binary', icon: 'male-female' },
];

export default function BasicsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateBasics = useOnboardingStore((s) => s.updateBasics);

  const [firstName, setFirstName] = useState(data?.first_name || '');
  const [birthDate, setBirthDate] = useState<Date>(
    data?.date_of_birth ? new Date(data.date_of_birth) : new Date(2000, 0, 1)
  );
  const [gender, setGender] = useState(data?.gender || '');
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
  const isValid = firstName.trim().length >= 2 && gender && isOver18;

  const handleContinue = () => {
    // Double-check age requirement
    if (!isOver18) {
      return;
    }

    updateBasics({
      first_name: firstName.trim(),
      date_of_birth: birthDate,
      gender: gender as any,
    });
    router.push('/(onboarding)/photos');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[16],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            The basics
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Let's start with who you are
          </Text>
        </View>

        {/* First Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            First name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholder="Your first name"
            placeholderTextColor={theme.colors.textTertiary}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={30}
          />
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            This is how you'll appear on Mazal
          </Text>
        </View>

        {/* Birthday */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Birthday
          </Text>
          <Pressable
            style={[styles.dateButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.dateText, { color: theme.colors.text }]}>
              {formatDate(birthDate)}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.icon} />
          </Pressable>
          <Text style={[styles.hint, { color: !isOver18 ? colors.semantic.error : theme.colors.textTertiary }]}>
            {!isOver18
              ? 'You must be 18 or older to use Mazal'
              : `You'll be ${age} years old`}
          </Text>
        </View>

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
            themeVariant={theme.isDark ? 'dark' : 'light'}
            textColor={theme.isDark ? '#FFFFFF' : '#000000'}
          />
        )}

        {/* Gender */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            I am a
          </Text>
          <View style={styles.genderOptions}>
            {GENDERS.map((g) => (
              <Pressable
                key={g.id}
                style={[
                  styles.genderOption,
                  {
                    backgroundColor:
                      gender === g.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      gender === g.id ? colors.primary.gold : colors.neutral[200],
                  },
                ]}
                onPress={() => setGender(g.id)}
              >
                <Ionicons
                  name={g.icon as any}
                  size={24}
                  color={gender === g.id ? colors.primary.navy : theme.colors.icon}
                />
                <Text
                  style={[
                    styles.genderLabel,
                    {
                      color:
                        gender === g.id ? colors.primary.navy : theme.colors.text,
                    },
                  ]}
                >
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.continueButton,
            !isValid && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  header: {
    marginBottom: spacing[8],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
  },
  field: {
    marginBottom: spacing[6],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  input: {
    fontSize: 16,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
  },
  hint: {
    fontSize: 13,
    marginTop: spacing[2],
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
  },
  dateText: {
    fontSize: 16,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  genderOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    gap: spacing[2],
  },
  genderLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  continueButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
