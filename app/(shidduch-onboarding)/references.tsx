/**
 * Shidduch Onboarding - References
 *
 * Collect reference contacts for shidduch verification
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useShidduchOnboardingStore, ShidduchReference } from '@/stores/shidduchOnboardingStore';

const REFERENCE_TYPES = [
  { id: 'rav', label: 'Rav/Rabbi', icon: 'book-outline' },
  { id: 'rosh_yeshiva', label: 'Rosh Yeshiva', icon: 'school-outline' },
  { id: 'teacher', label: 'Teacher/Rebbi', icon: 'person-outline' },
  { id: 'family_friend', label: 'Family Friend', icon: 'people-outline' },
  { id: 'employer', label: 'Employer', icon: 'briefcase-outline' },
  { id: 'shadchan', label: 'Shadchan', icon: 'heart-outline' },
];

const CONTACT_METHODS = [
  { id: 'phone', label: 'Phone Call' },
  { id: 'email', label: 'Email' },
  { id: 'either', label: 'Either' },
];

interface ReferenceFormData {
  type: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  contactMethod: string;
}

const emptyReference: ReferenceFormData = {
  type: '',
  name: '',
  relationship: '',
  phone: '',
  email: '',
  contactMethod: 'either',
};

export default function ShidduchReferencesScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useShidduchOnboardingStore();

  const [references, setReferences] = useState<ReferenceFormData[]>(
    data.references && data.references.length > 0
      ? data.references.map((ref) => ({
          type: ref.type,
          name: ref.name,
          relationship: ref.relationship,
          phone: ref.phone || '',
          email: ref.email || '',
          contactMethod: ref.contactMethod || 'either',
        }))
      : [{ ...emptyReference }, { ...emptyReference }]
  );
  const [expandedIndex, setExpandedIndex] = useState(0);

  const isReferenceValid = (ref: ReferenceFormData) => {
    return (
      ref.type.length > 0 &&
      ref.name.trim().length >= 2 &&
      ref.relationship.trim().length >= 2 &&
      (ref.phone.trim().length >= 10 || ref.email.trim().length >= 5)
    );
  };

  const validCount = references.filter(isReferenceValid).length;
  const isValid = validCount >= 2;

  const updateReference = (index: number, field: keyof ReferenceFormData, value: string) => {
    setReferences((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addReference = () => {
    if (references.length < 5) {
      setReferences((prev) => [...prev, { ...emptyReference }]);
      setExpandedIndex(references.length);
    }
  };

  const removeReference = (index: number) => {
    if (references.length > 2) {
      Alert.alert(
        'Remove Reference',
        'Are you sure you want to remove this reference?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              setReferences((prev) => prev.filter((_, i) => i !== index));
              if (expandedIndex >= references.length - 1) {
                setExpandedIndex(references.length - 2);
              }
            },
          },
        ]
      );
    }
  };

  const handleContinue = () => {
    const validRefs: ShidduchReference[] = references
      .filter(isReferenceValid)
      .map((ref) => ({
        type: ref.type,
        name: ref.name.trim(),
        relationship: ref.relationship.trim(),
        phone: ref.phone.trim() || undefined,
        email: ref.email.trim() || undefined,
        contactMethod: ref.contactMethod,
      }));

    updateData({ references: validRefs });
    router.push('/(shidduch-onboarding)/photos');
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
          <View style={[styles.progressBar, { width: '78%' }]} />
        </View>
        <Text style={styles.stepText}>7 of 9</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>ממליצים</Text>
          <Text style={styles.title}>References</Text>
          <Text style={styles.subtitle}>
            Provide at least 2 references who can speak about you
          </Text>
        </Animated.View>

        {/* Info Note */}
        <Animated.View entering={FadeInDown.delay(250)} style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={20} color="#d4af37" />
          <Text style={styles.infoText}>
            References will only be contacted after you approve a potential match
          </Text>
        </Animated.View>

        {/* References List */}
        {references.map((ref, index) => (
          <Animated.View
            key={index}
            entering={FadeIn.delay(300 + index * 50)}
            style={styles.referenceCard}
          >
            {/* Card Header */}
            <Pressable
              style={styles.referenceHeader}
              onPress={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
            >
              <View style={styles.referenceHeaderLeft}>
                <View style={[
                  styles.referenceNumber,
                  isReferenceValid(ref) && styles.referenceNumberValid,
                ]}>
                  {isReferenceValid(ref) ? (
                    <Ionicons name="checkmark" size={14} color="#0a1628" />
                  ) : (
                    <Text style={styles.referenceNumberText}>{index + 1}</Text>
                  )}
                </View>
                <Text style={styles.referenceTitle}>
                  {ref.name || `Reference ${index + 1}`}
                </Text>
              </View>
              <View style={styles.referenceHeaderRight}>
                {references.length > 2 && (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeReference(index)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                  </Pressable>
                )}
                <Ionicons
                  name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="rgba(255,255,255,0.5)"
                />
              </View>
            </Pressable>

            {/* Card Content */}
            {expandedIndex === index && (
              <View style={styles.referenceContent}>
                {/* Reference Type */}
                <View style={styles.field}>
                  <Text style={styles.label}>Reference Type *</Text>
                  <View style={styles.typeGrid}>
                    {REFERENCE_TYPES.map((type) => (
                      <Pressable
                        key={type.id}
                        style={[
                          styles.typeOption,
                          ref.type === type.id && styles.typeOptionSelected,
                        ]}
                        onPress={() => updateReference(index, 'type', type.id)}
                      >
                        <Ionicons
                          name={type.icon as any}
                          size={18}
                          color={ref.type === type.id ? '#d4af37' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[
                          styles.typeLabel,
                          ref.type === type.id && styles.typeLabelSelected,
                        ]}>
                          {type.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Name */}
                <View style={styles.field}>
                  <Text style={styles.label}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Reference's full name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={ref.name}
                    onChangeText={(value) => updateReference(index, 'name', value)}
                    autoCapitalize="words"
                  />
                </View>

                {/* Relationship */}
                <View style={styles.field}>
                  <Text style={styles.label}>Relationship *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="How do they know you?"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={ref.relationship}
                    onChangeText={(value) => updateReference(index, 'relationship', value)}
                  />
                </View>

                {/* Phone */}
                <View style={styles.field}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="(555) 123-4567"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={ref.phone}
                    onChangeText={(value) => updateReference(index, 'phone', value)}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>

                {/* Email */}
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="email@example.com"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={ref.email}
                    onChangeText={(value) => updateReference(index, 'email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                {/* Contact Method */}
                <View style={styles.field}>
                  <Text style={styles.label}>Preferred Contact Method</Text>
                  <View style={styles.contactMethods}>
                    {CONTACT_METHODS.map((method) => (
                      <Pressable
                        key={method.id}
                        style={[
                          styles.contactOption,
                          ref.contactMethod === method.id && styles.contactOptionSelected,
                        ]}
                        onPress={() => updateReference(index, 'contactMethod', method.id)}
                      >
                        <Text style={[
                          styles.contactLabel,
                          ref.contactMethod === method.id && styles.contactLabelSelected,
                        ]}>
                          {method.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        ))}

        {/* Add Reference Button */}
        {references.length < 5 && (
          <Pressable style={styles.addButton} onPress={addReference}>
            <Ionicons name="add-circle-outline" size={24} color="#d4af37" />
            <Text style={styles.addButtonText}>Add Another Reference</Text>
          </Pressable>
        )}

        {/* Status */}
        <View style={styles.statusBar}>
          <Text style={[
            styles.statusText,
            isValid && styles.statusTextValid,
          ]}>
            {validCount} of 2 minimum references completed
          </Text>
        </View>
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
    marginBottom: 16,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  referenceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  referenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  referenceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  referenceNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referenceNumberValid: {
    backgroundColor: '#d4af37',
  },
  referenceNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d4af37',
  },
  referenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  referenceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeButton: {
    padding: 4,
  },
  referenceContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.1)',
    paddingTop: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  typeOptionSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  typeLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  typeLabelSelected: {
    color: '#d4af37',
    fontWeight: '600',
  },
  contactMethods: {
    flexDirection: 'row',
    gap: 8,
  },
  contactOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  contactOptionSelected: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  contactLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  contactLabelSelected: {
    color: '#d4af37',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 15,
    color: '#d4af37',
    fontWeight: '600',
  },
  statusBar: {
    marginTop: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  statusTextValid: {
    color: '#4ade80',
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
