/**
 * Shidduch Onboarding - Education
 *
 * Collect education and career information
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useShidduchOnboardingStore } from '@/stores/shidduchOnboardingStore';

const DEGREES = [
  { id: 'high_school', label: 'High School' },
  { id: 'some_college', label: 'Some College' },
  { id: 'associates', label: "Associate's" },
  { id: 'bachelors', label: "Bachelor's" },
  { id: 'masters', label: "Master's" },
  { id: 'doctorate', label: 'Doctorate' },
  { id: 'rabbinical', label: 'Rabbinical Ordination' },
];

export default function ShidduchEducationScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useShidduchOnboardingStore();

  const [elementarySchool, setElementarySchool] = useState(data.elementarySchool || '');
  const [highSchool, setHighSchool] = useState(data.highSchool || '');
  const [seminaryYeshiva, setSeminaryYeshiva] = useState(data.seminaryYeshiva || '');
  const [seminaryYears, setSeminaryYears] = useState(data.seminaryYeshivaYears?.toString() || '');
  const [college, setCollege] = useState(data.collegeUniversity || '');
  const [highestDegree, setHighestDegree] = useState(data.highestDegree || '');
  const [occupation, setOccupation] = useState(data.occupation || '');
  const [company, setCompany] = useState(data.company || '');

  const isMale = data.gender === 'male';
  const isValid = highSchool.trim().length > 0 || seminaryYeshiva.trim().length > 0;

  const handleContinue = () => {
    updateData({
      elementarySchool: elementarySchool.trim(),
      highSchool: highSchool.trim(),
      seminaryYeshiva: seminaryYeshiva.trim(),
      seminaryYeshivaYears: seminaryYears ? parseInt(seminaryYears) : undefined,
      collegeUniversity: college.trim(),
      highestDegree,
      occupation: occupation.trim(),
      company: company.trim(),
    });
    router.push('/(shidduch-onboarding)/hashkafa');
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
          <View style={[styles.progressBar, { width: '37.5%' }]} />
        </View>
        <Text style={styles.stepText}>3 of 8</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>חינוך ועבודה</Text>
          <Text style={styles.title}>Education & Career</Text>
          <Text style={styles.subtitle}>Your academic and professional background</Text>
        </Animated.View>

        {/* Elementary School */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.field}>
          <Text style={styles.label}>Elementary School</Text>
          <TextInput
            style={styles.input}
            placeholder="Where did you attend elementary school?"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={elementarySchool}
            onChangeText={setElementarySchool}
          />
        </Animated.View>

        {/* High School */}
        <Animated.View entering={FadeInDown.delay(350)} style={styles.field}>
          <Text style={styles.label}>High School *</Text>
          <TextInput
            style={styles.input}
            placeholder={isMale ? "Mesivta/High School" : "High School/Bais Yaakov"}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={highSchool}
            onChangeText={setHighSchool}
          />
        </Animated.View>

        {/* Seminary/Yeshiva */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.field}>
          <Text style={styles.label}>{isMale ? 'Yeshiva' : 'Seminary'}</Text>
          <TextInput
            style={styles.input}
            placeholder={isMale ? "Which yeshiva did you attend?" : "Which seminary did you attend?"}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={seminaryYeshiva}
            onChangeText={setSeminaryYeshiva}
          />
        </Animated.View>

        {/* Years in Seminary/Yeshiva */}
        {seminaryYeshiva.length > 0 && (
          <Animated.View entering={FadeInDown.delay(450)} style={styles.field}>
            <Text style={styles.label}>{isMale ? 'Years in Yeshiva' : 'Seminary Years'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Number of years"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={seminaryYears}
              onChangeText={setSeminaryYears}
              keyboardType="number-pad"
              maxLength={2}
            />
          </Animated.View>
        )}

        {/* College/University */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.field}>
          <Text style={styles.label}>College/University</Text>
          <TextInput
            style={styles.input}
            placeholder="College or university attended (if applicable)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={college}
            onChangeText={setCollege}
          />
        </Animated.View>

        {/* Highest Degree */}
        <Animated.View entering={FadeInDown.delay(550)} style={styles.field}>
          <Text style={styles.label}>Highest Degree</Text>
          <View style={styles.degreeOptions}>
            {DEGREES.map((degree) => (
              <Pressable
                key={degree.id}
                style={[
                  styles.degreeOption,
                  highestDegree === degree.id && styles.degreeOptionSelected,
                ]}
                onPress={() => setHighestDegree(degree.id)}
              >
                <Text style={[
                  styles.degreeLabel,
                  highestDegree === degree.id && styles.degreeLabelSelected,
                ]}>
                  {degree.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Occupation */}
        <Animated.View entering={FadeInDown.delay(600)} style={styles.field}>
          <Text style={styles.label}>Current Occupation</Text>
          <TextInput
            style={styles.input}
            placeholder="What do you do?"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={occupation}
            onChangeText={setOccupation}
          />
        </Animated.View>

        {/* Company */}
        {occupation.length > 0 && (
          <Animated.View entering={FadeInDown.delay(650)} style={styles.field}>
            <Text style={styles.label}>Company/Organization</Text>
            <TextInput
              style={styles.input}
              placeholder="Where do you work?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={company}
              onChangeText={setCompany}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInDown.delay(700)}
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
  degreeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  degreeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  degreeOptionSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  degreeLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  degreeLabelSelected: {
    color: '#d4af37',
    fontWeight: '600',
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
