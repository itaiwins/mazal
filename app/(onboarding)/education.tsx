/**
 * Education Screen
 *
 * School and profession info with searchable school field
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';

// Popular schools for Jewish students
const SCHOOLS_LIST = [
  'Yeshiva University',
  'Brandeis University',
  'New York University',
  'University of Pennsylvania',
  'Columbia University',
  'Harvard University',
  'Yale University',
  'Princeton University',
  'Cornell University',
  'Brown University',
  'Stanford University',
  'MIT',
  'UCLA',
  'USC',
  'University of Michigan',
  'University of Maryland',
  'George Washington University',
  'American University',
  'Boston University',
  'Northeastern University',
  'Tufts University',
  'Emory University',
  'University of Florida',
  'University of Miami',
  'Florida State University',
  'Indiana University',
  'University of Wisconsin',
  'University of Illinois',
  'Northwestern University',
  'University of Chicago',
  'Washington University in St. Louis',
  'Duke University',
  'Vanderbilt University',
  'Tulane University',
  'Syracuse University',
  'SUNY Binghamton',
  'CUNY',
  'Rutgers University',
  'Penn State',
  'Ohio State University',
  'University of Texas at Austin',
  'Arizona State University',
  'University of Arizona',
  'University of Colorado Boulder',
  'University of Washington',
  'San Diego State University',
  'Touro College',
  'Queens College',
  'Hunter College',
  'Baruch College',
  'Brooklyn College',
  'Hebrew University of Jerusalem',
  'Tel Aviv University',
  'Bar-Ilan University',
  'Technion',
  'IDC Herzliya',
];

const EDUCATION_LEVELS = [
  { id: 'high_school', label: 'High School' },
  { id: 'some_college', label: 'Some College' },
  { id: 'bachelors', label: "Bachelor's Degree" },
  { id: 'masters', label: "Master's Degree" },
  { id: 'doctorate', label: 'Doctorate' },
  { id: 'trade_school', label: 'Trade School' },
];

export default function EducationScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateEducation = useOnboardingStore((s) => s.updateEducation);

  const [school, setSchool] = useState(data?.school || '');
  const [occupation, setOccupation] = useState(data?.occupation || '');
  const [educationLevel, setEducationLevel] = useState(data?.education || '');
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [schoolInputFocused, setSchoolInputFocused] = useState(false);

  const isValid = occupation.trim().length >= 2;

  // Filter schools based on input
  const filteredSchools = useMemo(() => {
    if (!school.trim() || school.length < 2) return [];
    const query = school.toLowerCase();
    return SCHOOLS_LIST.filter((s) =>
      s.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [school]);

  const handleSchoolSelect = (selectedSchool: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSchool(selectedSchool);
    setShowSchoolSuggestions(false);
    Keyboard.dismiss();
  };

  const handleContinue = () => {
    updateEducation({
      school: school.trim() || null,
      occupation: occupation.trim() || null,
      education: educationLevel || null,
    });
    router.push('/(onboarding)/lifestyle');
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
            Education & work
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Tell us about your background
          </Text>
        </View>

        {/* Occupation */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            What do you do? *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholder="e.g. Software Engineer, Doctor, Student"
            placeholderTextColor={theme.colors.textTertiary}
            value={occupation}
            onChangeText={setOccupation}
            autoCapitalize="words"
            maxLength={50}
          />
        </View>

        {/* School - Searchable */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            School (optional)
          </Text>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={18}
                color={theme.colors.textTertiary}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Search for your school..."
                placeholderTextColor={theme.colors.textTertiary}
                value={school}
                onChangeText={(text) => {
                  setSchool(text);
                  setShowSchoolSuggestions(true);
                }}
                onFocus={() => {
                  setSchoolInputFocused(true);
                  setShowSchoolSuggestions(true);
                }}
                onBlur={() => {
                  setSchoolInputFocused(false);
                  // Delay hiding to allow tap on suggestion
                  setTimeout(() => setShowSchoolSuggestions(false), 200);
                }}
                autoCapitalize="words"
                maxLength={100}
              />
              {school.length > 0 && (
                <Pressable
                  style={styles.clearButton}
                  onPress={() => {
                    setSchool('');
                    setShowSchoolSuggestions(false);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.textTertiary} />
                </Pressable>
              )}
            </View>

            {/* Suggestions dropdown */}
            {showSchoolSuggestions && filteredSchools.length > 0 && (
              <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.surface }]}>
                {filteredSchools.map((schoolName, index) => (
                  <Pressable
                    key={schoolName}
                    style={[
                      styles.suggestionItem,
                      index < filteredSchools.length - 1 && styles.suggestionBorder,
                    ]}
                    onPress={() => handleSchoolSelect(schoolName)}
                  >
                    <Ionicons name="school-outline" size={18} color={colors.primary.gold} />
                    <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
                      {schoolName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Popular schools hint */}
          {!school && !schoolInputFocused && (
            <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
              Start typing to search universities
            </Text>
          )}
        </View>

        {/* Education Level */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Education level (optional)
          </Text>
          <View style={styles.educationOptions}>
            {EDUCATION_LEVELS.map((level) => (
              <Pressable
                key={level.id}
                style={[
                  styles.educationOption,
                  {
                    backgroundColor:
                      educationLevel === level.id
                        ? colors.primary.gold
                        : theme.colors.surface,
                    borderColor:
                      educationLevel === level.id
                        ? colors.primary.gold
                        : colors.neutral[200],
                  },
                ]}
                onPress={() =>
                  setEducationLevel(educationLevel === level.id ? '' : level.id)
                }
              >
                <Text
                  style={[
                    styles.educationLabel,
                    {
                      color:
                        educationLevel === level.id
                          ? colors.primary.navy
                          : theme.colors.text,
                    },
                  ]}
                >
                  {level.label}
                </Text>
                {educationLevel === level.id && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={colors.primary.navy}
                  />
                )}
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
    marginBottom: spacing[6],
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
  searchContainer: {
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  searchIcon: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingLeft: spacing[10],
    paddingRight: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
  },
  clearButton: {
    position: 'absolute',
    right: spacing[4],
    padding: spacing[1],
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing[1],
    borderRadius: borderRadius.lg,
    shadowColor: colors.primary.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 100,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  suggestionText: {
    fontSize: 15,
    flex: 1,
  },
  hint: {
    fontSize: 13,
    marginTop: spacing[2],
  },
  educationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  educationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: spacing[2],
  },
  educationLabel: {
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
