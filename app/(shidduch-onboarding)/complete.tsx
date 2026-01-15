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
  const { session, setHasShidduchProfile } = useAuthStore();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Helper function to add timeout to promises
  const withTimeout = <T,>(promise: PromiseLike<T>, ms: number, errorMsg: string): Promise<T> => {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMsg)), ms)
      ),
    ]);
  };

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'Please sign in to submit your profile.');
      return;
    }

    setSubmitting(true);

    try {
      // First, check if user exists in users table (with 10s timeout)
      console.log('[Shidduch] Checking for existing user...');
      let { data: userData } = await withTimeout(
        supabase
          .from('users')
          .select('id')
          .eq('auth_id', session.user.id)
          .maybeSingle(),
        10000,
        'Check existing user timed out'
      );

      // If user doesn't exist, create them
      if (!userData) {
        console.log('[Shidduch] User not found, creating new user record...');
        const displayName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'User';

        // Map community to jewish_background
        const jewishBackgroundMap: Record<string, string> = {
          modern_orthodox: 'modern_orthodox',
          modern_orthodox_machmir: 'orthodox',
          yeshivish: 'orthodox',
          chassidish: 'hasidic',
          sephardi: 'sephardic',
          litvish: 'orthodox',
          chabad: 'chabad',
          carlebachian: 'orthodox',
          other: 'orthodox',
        };
        const jewishBackground = jewishBackgroundMap[data.community || ''] || 'orthodox';

        const { data: newUser, error: createError } = await withTimeout(
          supabase
            .from('users')
            .insert({
              auth_id: session.user.id,
              email: session.user.email || `${session.user.id}@placeholder.com`,
              first_name: data.firstName || 'User',
              last_name: data.lastName,
              display_name: displayName,
              date_of_birth: data.birthDate || '1990-01-01',
              gender: data.gender || 'male',
              gender_preference: data.gender === 'male' ? ['female'] : ['male'],
              current_city: data.city,
              current_state: data.state,
              current_country: data.country || 'USA',
              jewish_background: jewishBackground,
              looking_for: 'marriage_minded',
              is_orthodox_only: true,
              onboarding_complete: true,
            })
            .select('id')
            .single(),
          15000,
          'Create user timed out'
        );

        if (createError) {
          console.error('[Shidduch] Error creating user:', createError);
          throw new Error(`Failed to create user: ${createError.message}`);
        }

        userData = newUser;
        console.log('[Shidduch] User created:', userData?.id);
      } else {
        // User exists, update their info
        console.log('[Shidduch] User exists, updating info...');
        const { error: userError } = await withTimeout(
          supabase
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
            .eq('auth_id', session.user.id),
          10000,
          'Update user timed out'
        );

        if (userError) {
          console.error('[Shidduch] User update error:', userError);
        }
      }

      if (!userData) {
        throw new Error('Failed to get or create user');
      }

      console.log('[Shidduch] User ID:', userData.id);

      // Valid enum values from database schema (expanded to include all onboarding options)
      const VALID_COMMUNITIES = ['modern_orthodox', 'modern_orthodox_machmir', 'yeshivish', 'chassidish', 'litvish', 'sephardi', 'sephardic', 'chabad', 'carlebachian', 'other'];
      const VALID_PARENTS_STATUS = ['married', 'divorced', 'widowed', 'separated'];
      const VALID_HIGHEST_DEGREE = ['high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'rabbinical_ordination', 'other'];
      const VALID_MINYAN_FREQUENCY = ['three_times_daily', 'daily', 'shabbos_only', 'occasionally', 'always', 'morning_evening', 'shabbos_yomtov'];
      const VALID_KOLLEL_INTEREST = ['currently_in_kollel', 'planning_kollel', 'open_to_kollel', 'working', 'not_applicable', 'full_time', 'few_years', 'part_time'];
      const VALID_MARRIAGE_TIMELINE = ['asap', 'within_year', 'one_to_two_years', 'flexible'];
      const VALID_WIFE_WORKING = ['full_time', 'part_time', 'stay_home', 'flexible', 'not_applicable'];
      const VALID_HUSBAND_LEARNING = ['full_time_kollel', 'morning_seder', 'night_seder', 'working_and_learning', 'flexible', 'not_applicable'];
      const VALID_PHOTOS_VISIBLE = ['everyone', 'matches_only', 'shadchan_only', 'hidden'];
      const VALID_LIVING_SITUATION = ['with_parents', 'own_apartment', 'roommates', 'dorm', 'other'];
      const VALID_BUILD = ['slim', 'average', 'athletic', 'heavy', 'prefer_not_to_say'];
      const VALID_CHILDREN_PLANS = ['want_many', 'want_some', 'open', 'not_sure'];

      // Map onboarding values to database enum values
      const mapCommunity = (val: string | undefined) => {
        if (!val) return 'modern_orthodox';
        if (val === 'sephardic') return 'sephardi';
        if (val === 'litvish') return 'yeshivish'; // litvish maps to yeshivish in DB
        return VALID_COMMUNITIES.includes(val) ? val : 'other';
      };

      const mapMinyanFrequency = (val: string | undefined) => {
        if (!val) return null;
        const mapping: Record<string, string> = {
          'always': 'three_times_daily',
          'morning_evening': 'daily',
          'shabbos_yomtov': 'shabbos_only',
          'occasionally': 'occasionally',
        };
        return mapping[val] || val;
      };

      const mapKollelInterest = (val: string | undefined) => {
        if (!val) return null;
        const mapping: Record<string, string> = {
          'full_time': 'currently_in_kollel',
          'few_years': 'planning_kollel',
          'part_time': 'open_to_kollel',
          'working': 'working',
        };
        return mapping[val] || val;
      };

      // Helper to validate enum values
      const validateEnum = (value: any, validValues: string[]) =>
        value && validValues.includes(value) ? value : null;

      // Prepare the shidduch profile data
      // Note: created_by_* and single_* columns require migration to be applied
      const profileData = {
        user_id: userData.id,
        // Profile data
        hebrew_name: data.hebrewName || null,
        community: mapCommunity(data.community),
        chassidus: data.chassidus || null,
        hashkafa_details: data.hashkafaDetails || null,
        father_name: data.fatherName || null,
        father_occupation: data.fatherOccupation || null,
        father_origin: data.fatherOrigin || null,
        mother_name: data.motherName || null,
        mother_maiden_name: data.motherMaidenName || null,
        mother_occupation: data.motherOccupation || null,
        mother_origin: data.motherOrigin || null,
        parents_status: validateEnum(data.parentsStatus, VALID_PARENTS_STATUS),
        num_siblings: data.numSiblings || null,
        sibling_details: data.siblings || null,
        birth_order: data.birthOrder || null,
        grandfather_paternal: data.grandfatherPaternal || null,
        grandfather_maternal: data.grandfatherMaternal || null,
        notable_rabbanim: data.notableRabbanim || null,
        family_minhagim: data.familyMinhagim || null,
        elementary_school: data.elementarySchool || null,
        high_school: data.highSchool || null,
        seminary_yeshiva: data.seminaryYeshiva || null,
        seminary_yeshiva_years: data.seminaryYeshivaYears || null,
        college_university: data.collegeUniversity || null,
        highest_degree: validateEnum(data.highestDegree, VALID_HIGHEST_DEGREE),
        minyan_frequency: mapMinyanFrequency(data.minyanFrequency),
        learning_schedule: data.learningSchedule || null,
        kollel_interest: mapKollelInterest(data.kollelInterest),
        looking_for_description: data.lookingForDescription || null,
        age_range_min: data.ageRangeMin || null,
        age_range_max: data.ageRangeMax || null,
        preferred_communities: data.preferredCommunities || null,
        marriage_timeline: validateEnum(data.marriageTimeline, VALID_MARRIAGE_TIMELINE),
        wife_working: validateEnum(data.wifeWorking, VALID_WIFE_WORKING),
        husband_learning: validateEnum(data.husbandLearning, VALID_HUSBAND_LEARNING),
        photos_visible_to: validateEnum(data.photosVisibleTo, VALID_PHOTOS_VISIBLE) || 'shadchan_only',
        profile_visible: true,
        accepting_suggestions: true,
      };

      console.log('[Shidduch] Saving shidduch profile for user:', userData.id);
      console.log('[Shidduch] Profile data:', JSON.stringify(profileData, null, 2));

      // Insert shidduch profile (with 15s timeout)
      const { data: profileResult, error: profileError } = await withTimeout(
        supabase
          .from('shidduch_profiles')
          .upsert(profileData as any, {
            onConflict: 'user_id',
          })
          .select('id')
          .single(),
        15000,
        'Save profile timed out'
      );

      if (profileError) {
        console.error('[Shidduch] Profile error:', profileError);
        console.error('[Shidduch] Profile error details:', JSON.stringify(profileError, null, 2));
        throw new Error(`Failed to save profile: ${profileError.message}`);
      }

      console.log('[Shidduch] Profile saved successfully:', profileResult?.id);

      // Insert references using the shidduch profile ID
      if (data.references && data.references.length > 0 && profileResult) {
        console.log('[Shidduch] Saving references...');
        const VALID_REF_TYPES = ['rabbi', 'teacher', 'family_friend', 'personal_friend', 'employer', 'roommate', 'other'];
        const VALID_CONTACT_METHODS = ['phone', 'email', 'whatsapp', 'text'];

        const referencesData = data.references
          .filter((ref: any) => ref.name) // Only include refs with a name
          .map((ref: any) => ({
            profile_id: profileResult.id,
            reference_type: VALID_REF_TYPES.includes(ref.type) ? ref.type : 'other',
            name: ref.name,
            relationship: ref.relationship || 'Reference',
            phone: ref.phone || null,
            email: ref.email || null,
            best_contact_method: VALID_CONTACT_METHODS.includes(ref.contactMethod) ? ref.contactMethod : null,
          }));

        if (referencesData.length > 0) {
          const { error: refError } = await withTimeout(
            supabase
              .from('shidduch_references')
              .insert(referencesData),
            10000,
            'Save references timed out'
          );

          if (refError) {
            console.error('[Shidduch] References error:', refError);
            // Don't throw, continue with submission
          } else {
            console.log('[Shidduch] References saved');
          }
        }
      }

      // Mark shidduch onboarding as complete in Supabase user metadata
      console.log('[Shidduch] Updating user metadata...');
      const { error: metadataError } = await withTimeout(
        supabase.auth.updateUser({
          data: { shidduch_onboarding_complete: true },
        }),
        10000,
        'Update metadata timed out'
      );

      if (metadataError) {
        console.error('Metadata update error:', metadataError);
        // Don't throw - profile is saved, this is just for routing
      }

      console.log('Updating local auth store...');
      // Update local auth store to track shidduch profile completion
      setHasShidduchProfile(true);

      console.log('Profile submission complete, showing success screen');
      setSubmitted(true);
    } catch (error: any) {
      console.error('Submit error:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      Alert.alert(
        'Submission Error',
        error?.message || 'There was a problem saving your profile. Please try again.'
      );
    } finally {
      console.log('Finally block - setting submitting to false');
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    reset();
    // Navigate to the main shidduch tabs
    router.replace('/(shidduch-tabs)/');
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
        <Text style={styles.stepText}>9 of 9</Text>
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
