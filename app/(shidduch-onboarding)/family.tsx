/**
 * Shidduch Onboarding - Family Background
 *
 * Collect family information for yichus (lineage)
 * This is unique to the shidduch process
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

const PARENT_STATUS_OPTIONS = [
  { id: 'married', label: 'Married' },
  { id: 'divorced', label: 'Divorced' },
  { id: 'widowed', label: 'Widowed' },
  { id: 'separated', label: 'Separated' },
];

const MINHAG_OPTIONS = [
  { id: 'ashkenaz', label: 'Ashkenaz' },
  { id: 'sefard', label: 'Sefard (Chassidish)' },
  { id: 'sephardi', label: 'Sephardi/Edot HaMizrach' },
  { id: 'teimani', label: 'Teimani' },
  { id: 'mixed', label: 'Mixed' },
];

export default function ShidduchFamilyScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useShidduchOnboardingStore();

  // Father's info
  const [fatherName, setFatherName] = useState(data.fatherName || '');
  const [fatherOccupation, setFatherOccupation] = useState(data.fatherOccupation || '');
  const [fatherOrigin, setFatherOrigin] = useState(data.fatherOrigin || '');

  // Mother's info
  const [motherName, setMotherName] = useState(data.motherName || '');
  const [motherMaidenName, setMotherMaidenName] = useState(data.motherMaidenName || '');
  const [motherOccupation, setMotherOccupation] = useState(data.motherOccupation || '');
  const [motherOrigin, setMotherOrigin] = useState(data.motherOrigin || '');

  // Parents status
  const [parentsStatus, setParentsStatus] = useState(data.parentsStatus || 'married');

  // Siblings
  const [numSiblings, setNumSiblings] = useState(data.numSiblings?.toString() || '');
  const [birthOrder, setBirthOrder] = useState(data.birthOrder?.toString() || '');

  // Extended family
  const [grandfatherPaternal, setGrandfatherPaternal] = useState(data.grandfatherPaternal || '');
  const [grandfatherMaternal, setGrandfatherMaternal] = useState(data.grandfatherMaternal || '');
  const [notableRabbanim, setNotableRabbanim] = useState(data.notableRabbanim || '');
  const [familyMinhagim, setFamilyMinhagim] = useState(data.familyMinhagim || 'ashkenaz');

  const isValid = fatherName.trim().length > 0 || motherName.trim().length > 0;

  const handleContinue = () => {
    updateData({
      fatherName: fatherName.trim(),
      fatherOccupation: fatherOccupation.trim(),
      fatherOrigin: fatherOrigin.trim(),
      motherName: motherName.trim(),
      motherMaidenName: motherMaidenName.trim(),
      motherOccupation: motherOccupation.trim(),
      motherOrigin: motherOrigin.trim(),
      parentsStatus,
      numSiblings: numSiblings ? parseInt(numSiblings) : undefined,
      birthOrder: birthOrder ? parseInt(birthOrder) : undefined,
      grandfatherPaternal: grandfatherPaternal.trim(),
      grandfatherMaternal: grandfatherMaternal.trim(),
      notableRabbanim: notableRabbanim.trim(),
      familyMinhagim,
    });
    router.push('/(shidduch-onboarding)/education');
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
          <View style={[styles.progressBar, { width: '33%' }]} />
        </View>
        <Text style={styles.stepText}>3 of 9</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>משפחה</Text>
          <Text style={styles.title}>Family Background</Text>
          <Text style={styles.subtitle}>
            Family is central to the shidduch process. Share about your yichus.
          </Text>
        </Animated.View>

        {/* Father Section */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="man-outline" size={20} color="#d4af37" />
            <Text style={styles.sectionTitle}>Father's Information</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Father's Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={fatherName}
              onChangeText={setFatherName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Occupation</Text>
              <TextInput
                style={styles.input}
                placeholder="Occupation"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={fatherOccupation}
                onChangeText={setFatherOccupation}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.label}>Origin</Text>
              <TextInput
                style={styles.input}
                placeholder="City/Country"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={fatherOrigin}
                onChangeText={setFatherOrigin}
                autoCapitalize="words"
              />
            </View>
          </View>
        </Animated.View>

        {/* Mother Section */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="woman-outline" size={20} color="#d4af37" />
            <Text style={styles.sectionTitle}>Mother's Information</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mother's Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={motherName}
              onChangeText={setMotherName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mother's Maiden Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Family name before marriage"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={motherMaidenName}
              onChangeText={setMotherMaidenName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Occupation</Text>
              <TextInput
                style={styles.input}
                placeholder="Occupation"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={motherOccupation}
                onChangeText={setMotherOccupation}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.label}>Origin</Text>
              <TextInput
                style={styles.input}
                placeholder="City/Country"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={motherOrigin}
                onChangeText={setMotherOrigin}
                autoCapitalize="words"
              />
            </View>
          </View>
        </Animated.View>

        {/* Parents Status */}
        <Animated.View entering={FadeInDown.delay(450)} style={styles.field}>
          <Text style={styles.label}>Parents' Marital Status</Text>
          <View style={styles.optionsGrid}>
            {PARENT_STATUS_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.optionChip,
                  parentsStatus === option.id && styles.optionChipSelected,
                ]}
                onPress={() => setParentsStatus(option.id)}
              >
                <Text style={[
                  styles.optionChipText,
                  parentsStatus === option.id && styles.optionChipTextSelected,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Siblings */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={20} color="#d4af37" />
            <Text style={styles.sectionTitle}>Siblings</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Number of Siblings</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={numSiblings}
                onChangeText={setNumSiblings}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.label}>Your Birth Order</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2 (for 2nd)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={birthOrder}
                onChangeText={setBirthOrder}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Animated.View>

        {/* Extended Family / Yichus */}
        <Animated.View entering={FadeInDown.delay(550)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="git-branch-outline" size={20} color="#d4af37" />
            <Text style={styles.sectionTitle}>Extended Family & Yichus</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Optional but valued in shidduchim</Text>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Paternal Grandfather</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={grandfatherPaternal}
                onChangeText={setGrandfatherPaternal}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.label}>Maternal Grandfather</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={grandfatherMaternal}
                onChangeText={setGrandfatherMaternal}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notable Rabbanim in Family</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Any notable rabbinical lineage"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={notableRabbanim}
              onChangeText={setNotableRabbanim}
              multiline
              numberOfLines={2}
            />
          </View>
        </Animated.View>

        {/* Family Minhagim */}
        <Animated.View entering={FadeInDown.delay(600)} style={styles.field}>
          <Text style={styles.label}>Family Minhagim (Customs)</Text>
          <View style={styles.optionsGrid}>
            {MINHAG_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.optionChip,
                  familyMinhagim === option.id && styles.optionChipSelected,
                ]}
                onPress={() => setFamilyMinhagim(option.id)}
              >
                <Text style={[
                  styles.optionChipText,
                  familyMinhagim === option.id && styles.optionChipTextSelected,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
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
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#d4af37',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 28,
  },
  field: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  optionChipSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  optionChipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  optionChipTextSelected: {
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
