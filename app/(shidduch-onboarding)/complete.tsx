/**
 * Shidduch Onboarding - Complete
 *
 * Review and submit the shidduch resume
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { useShidduchOnboardingStore } from '@/stores/shidduchOnboardingStore';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';

const COMMUNITIES_MAP: Record<string, string> = {
  modern_orthodox: 'Modern Orthodox',
  yeshivish: 'Yeshivish',
  chassidish: 'Chassidish',
  litvish: 'Litvish',
  sephardic: 'Sephardic',
  chabad: 'Chabad',
  other: 'Other',
};

export default function ShidduchCompleteScreen() {
  const insets = useSafeAreaInsets();
  const { data, reset } = useShidduchOnboardingStore();
  const { session } = useAuthStore();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'Please sign in to submit your profile.');
      return;
    }

    setSubmitting(true);

    try {
      // First, update the users table with basic info
      const { error: userError } = await supabase
        .from('users')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          date_of_birth: data.birthDate,
          gender: data.gender,
          current_city: data.city,
          current_state: data.state,
          current_country: data.country,
        })
        .eq('auth_id', session.user.id);

      if (userError) {
        console.error('User update error:', userError);
      }

      // Get the user's internal ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) {
        throw new Error('User not found');
      }

      // Prepare the shidduch profile data
      const profileData = {
        user_id: userData.id,
        hebrew_name: data.hebrewName,
        community: data.community || 'modern_orthodox',
        chassidus: data.chassidus,
        hashkafa_details: data.hashkafaDetails,
        father_name: data.fatherName,
        father_occupation: data.fatherOccupation,
        father_origin: data.fatherOrigin,
        mother_name: data.motherName,
        mother_maiden_name: data.motherMaidenName,
        mother_occupation: data.motherOccupation,
        mother_origin: data.motherOrigin,
        parents_status: data.parentsStatus,
        num_siblings: data.numSiblings,
        sibling_details: data.siblings,
        birth_order: data.birthOrder,
        grandfather_paternal: data.grandfatherPaternal,
        grandfather_maternal: data.grandfatherMaternal,
        notable_rabbanim: data.notableRabbanim,
        family_minhagim: data.familyMinhagim,
        elementary_school: data.elementarySchool,
        high_school: data.highSchool,
        seminary_yeshiva: data.seminaryYeshiva,
        seminary_yeshiva_years: data.seminaryYeshivaYears,
        college_university: data.collegeUniversity,
        highest_degree: data.highestDegree,
        minyan_frequency: data.minyanFrequency,
        learning_schedule: data.learningSchedule,
        kollel_interest: data.kollelInterest,
        looking_for_description: data.lookingForDescription,
        age_range_min: data.ageRangeMin,
        age_range_max: data.ageRangeMax,
        preferred_communities: data.preferredCommunities,
        marriage_timeline: data.marriageTimeline,
        wife_working: data.wifeWorking,
        husband_learning: data.husbandLearning,
        photos_visible_to: data.photosVisibleTo || 'shadchan_only',
        profile_visible: true,
        accepting_suggestions: true,
      };

      // Insert shidduch profile
      const { data: profileResult, error: profileError } = await supabase
        .from('shidduch_profiles')
        .upsert(profileData as any, {
          onConflict: 'user_id',
        })
        .select('id')
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error('Failed to save profile');
      }

      // Insert references using the shidduch profile ID
      if (data.references && data.references.length > 0 && profileResult) {
        const referencesData = data.references.map((ref: any) => ({
          profile_id: profileResult.id,
          reference_type: ref.type || 'other',
          name: ref.name,
          relationship: ref.relationship,
          phone: ref.phone,
          email: ref.email,
          best_contact_method: ref.contactMethod,
        }));

        const { error: refError } = await supabase
          .from('shidduch_references')
          .insert(referencesData);

        if (refError) {
          console.error('References error:', refError);
          // Don't throw, continue with submission
        }
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert(
        'Submission Error',
        'There was a problem saving your profile. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    reset();
    // Navigate to the main shidduch tabs
    router.replace('/(tabs)/');
  };

  if (submitted) {
    return (
      <LinearGradient
        colors={['#0a1628', '#1a2744', '#0a1628']}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <View style={styles.successContainer}>
          <Animated.View entering={ZoomIn.delay(200)} style={styles.successIcon}>
            <Text style={styles.successStar}>✡</Text>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(400)} style={styles.successHebrew}>
            מזל טוב
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(500)} style={styles.successTitle}>
            Profile Complete!
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(600)} style={styles.successText}>
            Your shidduch resume has been submitted. A shadchan will review your
            profile and begin suggesting appropriate matches.
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(700)} style={styles.nextSteps}>
            <Text style={styles.nextStepsTitle}>What Happens Next</Text>
            <View style={styles.nextStepItem}>
              <View style={styles.nextStepNumber}>
                <Text style={styles.nextStepNumberText}>1</Text>
              </View>
              <Text style={styles.nextStepText}>
                Your profile will be reviewed by verified shadchanim
              </Text>
            </View>
            <View style={styles.nextStepItem}>
              <View style={styles.nextStepNumber}>
                <Text style={styles.nextStepNumberText}>2</Text>
              </View>
              <Text style={styles.nextStepText}>
                You'll receive curated suggestions based on your preferences
              </Text>
            </View>
            <View style={styles.nextStepItem}>
              <View style={styles.nextStepNumber}>
                <Text style={styles.nextStepNumberText}>3</Text>
              </View>
              <Text style={styles.nextStepText}>
                When both parties approve, contact information is exchanged
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(800)}
            style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
          >
            <Pressable style={styles.continueButton} onPress={handleFinish}>
              <LinearGradient
                colors={['#d4af37', '#f4d47c', '#d4af37']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Go to Dashboard</Text>
                <Ionicons name="arrow-forward" size={20} color="#0a1628" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </LinearGradient>
    );
  }

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
          <View style={[styles.progressBar, { width: '100%' }]} />
        </View>
        <Text style={styles.stepText}>8 of 8</Text>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Text style={styles.hebrewTitle}>סיכום</Text>
          <Text style={styles.title}>Review Your Profile</Text>
          <Text style={styles.subtitle}>
            Please review your information before submitting
          </Text>
        </Animated.View>

        {/* Profile Photo Preview */}
        {data.photos && data.photos.length > 0 && (
          <Animated.View entering={FadeIn.delay(300)} style={styles.photoPreview}>
            <Image
              source={{ uri: data.photos.find((p) => p.order === 1)?.uri || data.photos[0].uri }}
              style={styles.mainPhoto}
            />
          </Animated.View>
        )}

        {/* Summary Cards */}
        <Animated.View entering={FadeInDown.delay(350)} style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color="#d4af37" />
            <Text style={styles.cardTitle}>Personal Details</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardValue}>
              {data.firstName} {data.lastName}
              {data.hebrewName && ` (${data.hebrewName})`}
            </Text>
            <Text style={styles.cardDetail}>
              {data.age} years old • {data.gender === 'male' ? 'Man' : 'Woman'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="people-outline" size={20} color="#d4af37" />
            <Text style={styles.cardTitle}>Family Background</Text>
          </View>
          <View style={styles.cardContent}>
            {data.fatherName && (
              <Text style={styles.cardDetail}>
                Father: {data.fatherName}
                {data.fatherOccupation && ` • ${data.fatherOccupation}`}
              </Text>
            )}
            {data.motherName && (
              <Text style={styles.cardDetail}>
                Mother: {data.motherName}
                {data.motherMaidenName && ` (née ${data.motherMaidenName})`}
              </Text>
            )}
            {data.numSiblings !== undefined && (
              <Text style={styles.cardDetail}>
                {data.numSiblings} siblings • #{data.birthOrder} in birth order
              </Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450)} style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="school-outline" size={20} color="#d4af37" />
            <Text style={styles.cardTitle}>Education</Text>
          </View>
          <View style={styles.cardContent}>
            {data.highSchool && (
              <Text style={styles.cardDetail}>High School: {data.highSchool}</Text>
            )}
            {data.seminaryYeshiva && (
              <Text style={styles.cardDetail}>
                {data.gender === 'male' ? 'Yeshiva' : 'Seminary'}: {data.seminaryYeshiva}
              </Text>
            )}
            {data.occupation && (
              <Text style={styles.cardDetail}>
                Occupation: {data.occupation}
                {data.company && ` at ${data.company}`}
              </Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500)} style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="book-outline" size={20} color="#d4af37" />
            <Text style={styles.cardTitle}>Hashkafa</Text>
          </View>
          <View style={styles.cardContent}>
            {data.community && (
              <Text style={styles.cardValue}>
                {COMMUNITIES_MAP[data.community] || data.community}
                {data.chassidus && ` - ${data.chassidus}`}
              </Text>
            )}
            {data.hashkafaDetails && (
              <Text style={styles.cardDetail}>{data.hashkafaDetails}</Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(550)} style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="heart-outline" size={20} color="#d4af37" />
            <Text style={styles.cardTitle}>Looking For</Text>
          </View>
          <View style={styles.cardContent}>
            {data.lookingForDescription && (
              <Text style={styles.cardDetail}>{data.lookingForDescription}</Text>
            )}
            {(data.ageRangeMin || data.ageRangeMax) && (
              <Text style={styles.cardDetail}>
                Age range: {data.ageRangeMin || '18'} - {data.ageRangeMax || '40'}
              </Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600)} style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="call-outline" size={20} color="#d4af37" />
            <Text style={styles.cardTitle}>References</Text>
          </View>
          <View style={styles.cardContent}>
            {data.references?.map((ref, i) => (
              <Text key={i} style={styles.cardDetail}>
                {ref.name} ({ref.type})
              </Text>
            ))}
          </View>
        </Animated.View>

        {/* Legal Note */}
        <Animated.View entering={FadeInDown.delay(650)} style={styles.legalNote}>
          <Text style={styles.legalText}>
            By submitting, you confirm that all information is accurate and you agree
            to our Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Submit Button */}
      <Animated.View
        entering={FadeInDown.delay(700)}
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable
          style={[styles.continueButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <LinearGradient
            colors={submitting ? ['#333', '#444', '#333'] : ['#d4af37', '#f4d47c', '#d4af37']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#666" />
            ) : (
              <>
                <Text style={styles.buttonText}>Submit Profile</Text>
                <Ionicons name="checkmark-circle" size={20} color="#0a1628" />
              </>
            )}
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
    marginBottom: 24,
  },
  photoPreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mainPhoto: {
    width: 120,
    height: 160,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#d4af37',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardContent: {
    gap: 4,
  },
  cardValue: {
    fontSize: 16,
    color: '#d4af37',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  legalNote: {
    paddingVertical: 16,
  },
  legalText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 18,
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
  buttonDisabled: {
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
  // Success screen styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successStar: {
    fontSize: 50,
    color: '#d4af37',
    textShadowColor: '#d4af37',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  successHebrew: {
    fontSize: 36,
    color: '#d4af37',
    marginBottom: 8,
    letterSpacing: 4,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  nextSteps: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a1628',
  },
  nextStepText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
});
