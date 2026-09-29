/**
 * Profile Verification Screen
 *
 * Multi-step identity verification:
 * Step 1: Upload government-issued ID
 * Step 2: Take a selfie for face matching
 * Step 3: Review and submit
 *
 * LEGAL COMPLIANCE:
 * - This process is legal and commonly used by dating apps (Tinder, Bumble, Hinge)
 * - Requirements for compliance:
 *   • Clear user consent before collecting data
 *   • Encrypted storage (Supabase handles this)
 *   • Clear privacy policy explaining data usage
 *   • ID photos deleted after verification (not stored long-term)
 *   • GDPR/CCPA compliant data handling
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { verifyIdentity, VerificationResult } from '@/api/services/verificationService';
import { FEATURE_PHOTO_VERIFICATION } from '@/lib/config/features';

type VerificationStep = 'intro' | 'id-upload' | 'selfie' | 'review' | 'processing' | 'complete';

const ACCEPTED_ID_TYPES = [
  "Driver's License",
  'Passport',
  'State ID',
  'National ID Card',
];

export default function VerifyScreen() {
  // Off until verification moves server-side (MEXA-359 Part B). Hiding only the "Verify
  // Your Profile" button on the profile tab would leave this screen reachable by route -
  // expo-router registers every file under app/ - so the flow is closed here too. Metro
  // inlines EXPO_PUBLIC_* at build time, so with the flag off the body below is statically
  // unreachable in the bundle.
  if (!FEATURE_PHOTO_VERIFICATION) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return <VerifyScreenContent />;
}

function VerifyScreenContent() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Auth
  const authUser = useAuthStore((s) => s.authUser);
  const updateUser = useAuthStore((s) => s.updateUser);

  // State
  const [step, setStep] = useState<VerificationStep>('intro');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleBack = () => {
    if (step === 'intro') {
      router.back();
    } else if (step === 'id-upload') {
      setStep('intro');
    } else if (step === 'selfie') {
      setStep('id-upload');
    } else if (step === 'review') {
      setStep('selfie');
    } else {
      router.back();
    }
  };

  const handleStartVerification = () => {
    if (!hasConsented) {
      Alert.alert(
        'Consent Required',
        'Please agree to the verification terms to continue.',
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('id-upload');
  };

  const handleTakeIdPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      'Upload ID Document',
      'Choose how to add your government-issued ID',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Please allow camera access to take a photo of your ID.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [16, 10],
              quality: 0.9,
            });
            if (!result.canceled && result.assets[0]) {
              setIdPhoto(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Please allow access to your photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [16, 10],
              quality: 0.9,
            });
            if (!result.canceled && result.assets[0]) {
              setIdPhoto(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleTakeSelfie = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a selfie.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled && result.assets[0]) {
      setSelfiePhoto(result.assets[0].uri);
    }
  };

  const handleContinueFromId = () => {
    if (!idPhoto) {
      Alert.alert('ID Required', 'Please upload a photo of your government-issued ID.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('selfie');
  };

  const handleContinueFromSelfie = () => {
    if (!selfiePhoto) {
      Alert.alert('Selfie Required', 'Please take a selfie for verification.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('review');
  };

  const handleSubmitVerification = async () => {
    if (!idPhoto || !selfiePhoto || !authUser) {
      Alert.alert('Error', 'Missing required information for verification.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStep('processing');
    setIsProcessing(true);
    setVerificationError(null);

    try {
      // Call the verification service
      const result: VerificationResult = await verifyIdentity({
        userId: authUser.id,
        idPhotoUri: idPhoto,
        selfiePhotoUri: selfiePhoto,
      });

      setIsProcessing(false);

      if (result.success && result.verified) {
        // Update local user state
        updateUser({ is_verified: true });
        setStep('complete');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Verification failed
        const errorMessage = result.reason || result.error || 'Verification failed. Please try again.';
        setVerificationError(errorMessage);

        Alert.alert(
          'Verification Failed',
          errorMessage,
          [
            {
              text: 'Try Again',
              onPress: () => {
                setStep('id-upload');
                setIdPhoto(null);
                setSelfiePhoto(null);
              },
            },
            { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
          ]
        );
      }
    } catch (error) {
      console.error('Verification error:', error);
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setVerificationError(errorMessage);

      Alert.alert(
        'Verification Error',
        errorMessage,
        [
          { text: 'Try Again', onPress: () => setStep('review') },
          { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        ]
      );
    }
  };

  const handleFinish = () => {
    router.back();
  };

  const renderIntroStep = () => (
    <Animated.View entering={FadeInDown.springify()} style={styles.stepContent}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={48} color={colors.primary.gold} />
        </View>
        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
          Verify Your Identity
        </Text>
        <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
          A verified badge shows others you're authentic and helps build trust in our Jewish community.
        </Text>
      </View>

      {/* What you'll need */}
      <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
          What you'll need:
        </Text>
        <View style={styles.infoItem}>
          <Ionicons name="card" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            A government-issued ID (driver's license, passport, or state ID)
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="camera" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            A clear selfie of your face
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="time" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            About 2 minutes to complete
          </Text>
        </View>
      </View>

      {/* Benefits */}
      <View style={[styles.benefitsCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.benefitsTitle, { color: theme.colors.text }]}>
          Benefits of Verification
        </Text>
        <View style={styles.benefitItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
          <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
            Get a gold verified badge on your profile
          </Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
          <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
            Appear higher in search results
          </Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
          <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
            Build trust with potential matches
          </Text>
        </View>
      </View>

      {/* Privacy notice */}
      <View style={[styles.privacyCard, { backgroundColor: colors.transparent.gold10 }]}>
        <Ionicons name="lock-closed" size={20} color={colors.primary.gold} />
        <View style={styles.privacyContent}>
          <Text style={[styles.privacyTitle, { color: theme.colors.text }]}>
            Your Privacy Matters
          </Text>
          <Text style={[styles.privacyText, { color: theme.colors.textSecondary }]}>
            Your ID photo is only used for verification and is deleted immediately after. We never store your ID or share it with third parties.
          </Text>
        </View>
      </View>

      {/* Consent checkbox */}
      <Pressable
        style={styles.consentRow}
        onPress={() => setHasConsented(!hasConsented)}
      >
        <View style={[styles.checkbox, hasConsented && styles.checkboxChecked]}>
          {hasConsented && <Ionicons name="checkmark" size={16} color={colors.primary.navy} />}
        </View>
        <Text style={[styles.consentText, { color: theme.colors.textSecondary }]}>
          I agree to the verification terms and consent to the temporary processing of my ID for verification purposes.
        </Text>
      </Pressable>
    </Animated.View>
  );

  const renderIdUploadStep = () => (
    <Animated.View entering={SlideInRight.springify()} style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepOf}>of 2</Text>
        </View>
        <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
          Upload Your ID
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
          Take a clear photo of your government-issued ID
        </Text>
      </View>

      {/* Accepted ID types */}
      <View style={[styles.idTypesCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.idTypesTitle, { color: theme.colors.text }]}>
          Accepted ID Types:
        </Text>
        <View style={styles.idTypesList}>
          {ACCEPTED_ID_TYPES.map((type) => (
            <View key={type} style={styles.idTypeItem}>
              <Ionicons name="checkmark" size={16} color={colors.semantic.success} />
              <Text style={[styles.idTypeText, { color: theme.colors.textSecondary }]}>
                {type}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ID Photo upload area */}
      <Pressable
        style={[
          styles.uploadArea,
          { backgroundColor: theme.colors.surface },
          idPhoto && styles.uploadAreaWithPhoto,
        ]}
        onPress={handleTakeIdPhoto}
      >
        {idPhoto ? (
          <>
            <Image source={{ uri: idPhoto }} style={styles.uploadedImage} contentFit="contain" />
            <View style={styles.retakeOverlay}>
              <Ionicons name="camera" size={24} color={colors.primary.white} />
              <Text style={styles.retakeText}>Tap to retake</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.uploadIcon}>
              <Ionicons name="card-outline" size={48} color={colors.transparent.white40} />
            </View>
            <Text style={[styles.uploadText, { color: theme.colors.text }]}>
              Tap to upload ID photo
            </Text>
            <Text style={[styles.uploadHint, { color: theme.colors.textTertiary }]}>
              Make sure all text is clearly visible
            </Text>
          </>
        )}
      </Pressable>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={[styles.tipsTitle, { color: theme.colors.textSecondary }]}>Tips:</Text>
        <Text style={[styles.tipItem, { color: theme.colors.textTertiary }]}>
          • Use good lighting
        </Text>
        <Text style={[styles.tipItem, { color: theme.colors.textTertiary }]}>
          • Avoid glare on the ID
        </Text>
        <Text style={[styles.tipItem, { color: theme.colors.textTertiary }]}>
          • Include all four corners
        </Text>
      </View>
    </Animated.View>
  );

  const renderSelfieStep = () => (
    <Animated.View entering={SlideInRight.springify()} style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepOf}>of 2</Text>
        </View>
        <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
          Take a Selfie
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
          We'll compare this with your ID photo to verify it's you
        </Text>
      </View>

      {/* Selfie upload area */}
      <Pressable
        style={[
          styles.selfieArea,
          { backgroundColor: theme.colors.surface },
          selfiePhoto && styles.uploadAreaWithPhoto,
        ]}
        onPress={handleTakeSelfie}
      >
        {selfiePhoto ? (
          <>
            <Image source={{ uri: selfiePhoto }} style={styles.selfieImage} contentFit="cover" />
            <View style={styles.retakeOverlay}>
              <Ionicons name="camera" size={24} color={colors.primary.white} />
              <Text style={styles.retakeText}>Tap to retake</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.selfieFrame}>
              <View style={styles.selfieOutline} />
            </View>
            <View style={styles.uploadIcon}>
              <Ionicons name="person-circle-outline" size={64} color={colors.transparent.white40} />
            </View>
            <Text style={[styles.uploadText, { color: theme.colors.text }]}>
              Tap to take selfie
            </Text>
            <Text style={[styles.uploadHint, { color: theme.colors.textTertiary }]}>
              Look straight at the camera
            </Text>
          </>
        )}
      </Pressable>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={[styles.tipsTitle, { color: theme.colors.textSecondary }]}>Tips:</Text>
        <Text style={[styles.tipItem, { color: theme.colors.textTertiary }]}>
          • Face the camera directly
        </Text>
        <Text style={[styles.tipItem, { color: theme.colors.textTertiary }]}>
          • Remove sunglasses or hats
        </Text>
        <Text style={[styles.tipItem, { color: theme.colors.textTertiary }]}>
          • Use natural lighting
        </Text>
      </View>
    </Animated.View>
  );

  const renderReviewStep = () => (
    <Animated.View entering={SlideInRight.springify()} style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
          Review & Submit
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
          Make sure both photos are clear before submitting
        </Text>
      </View>

      {/* Review photos */}
      <View style={styles.reviewPhotos}>
        <View style={styles.reviewPhotoContainer}>
          <Text style={[styles.reviewPhotoLabel, { color: theme.colors.textSecondary }]}>
            ID Document
          </Text>
          <View style={[styles.reviewPhotoFrame, { backgroundColor: theme.colors.surface }]}>
            {idPhoto && (
              <Image source={{ uri: idPhoto }} style={styles.reviewIdImage} contentFit="contain" />
            )}
          </View>
          <Pressable style={styles.editButton} onPress={() => setStep('id-upload')}>
            <Ionicons name="pencil" size={16} color={colors.primary.gold} />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.reviewPhotoContainer}>
          <Text style={[styles.reviewPhotoLabel, { color: theme.colors.textSecondary }]}>
            Your Selfie
          </Text>
          <View style={[styles.reviewPhotoFrame, styles.reviewSelfieFrame, { backgroundColor: theme.colors.surface }]}>
            {selfiePhoto && (
              <Image source={{ uri: selfiePhoto }} style={styles.reviewSelfieImage} contentFit="cover" />
            )}
          </View>
          <Pressable style={styles.editButton} onPress={() => setStep('selfie')}>
            <Ionicons name="pencil" size={16} color={colors.primary.gold} />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>
      </View>

      {/* Final notice */}
      <View style={[styles.finalNotice, { backgroundColor: colors.transparent.gold10 }]}>
        <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
        <Text style={[styles.finalNoticeText, { color: theme.colors.textSecondary }]}>
          By submitting, you confirm that you've provided accurate information. Verification typically takes a few seconds.
        </Text>
      </View>
    </Animated.View>
  );

  const renderProcessingStep = () => (
    <Animated.View entering={FadeInDown.springify()} style={styles.processingContent}>
      <View style={styles.processingIcon}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
      </View>
      <Text style={[styles.processingTitle, { color: theme.colors.text }]}>
        Verifying Your Identity
      </Text>
      <Text style={[styles.processingSubtitle, { color: theme.colors.textSecondary }]}>
        This usually takes just a few seconds...
      </Text>

      <View style={styles.processingSteps}>
        <View style={styles.processingStepItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
          <Text style={[styles.processingStepText, { color: theme.colors.textSecondary }]}>
            Uploading documents
          </Text>
        </View>
        <View style={styles.processingStepItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
          <Text style={[styles.processingStepText, { color: theme.colors.textSecondary }]}>
            Analyzing ID
          </Text>
        </View>
        <View style={styles.processingStepItem}>
          <ActivityIndicator size="small" color={colors.primary.gold} />
          <Text style={[styles.processingStepText, { color: theme.colors.text }]}>
            Comparing photos...
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderCompleteStep = () => (
    <Animated.View entering={FadeInUp.springify()} style={styles.completeContent}>
      <View style={styles.completeIcon}>
        <Ionicons name="shield-checkmark" size={64} color={colors.semantic.success} />
      </View>
      <Text style={[styles.completeTitle, { color: theme.colors.text }]}>
        You're Verified!
      </Text>
      <Text style={[styles.completeSubtitle, { color: theme.colors.textSecondary }]}>
        Your profile now has a verified badge. This helps build trust with potential matches.
      </Text>

      <View style={[styles.completeBadge, { backgroundColor: colors.transparent.gold10 }]}>
        <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
        <Text style={[styles.completeBadgeText, { color: theme.colors.text }]}>
          Verified Profile
        </Text>
      </View>
    </Animated.View>
  );

  const getStepTitle = () => {
    switch (step) {
      case 'intro': return 'Get Verified';
      case 'id-upload': return 'Upload ID';
      case 'selfie': return 'Take Selfie';
      case 'review': return 'Review';
      case 'processing': return 'Verifying';
      case 'complete': return 'Complete';
      default: return 'Verification';
    }
  };

  const getButtonText = () => {
    switch (step) {
      case 'intro': return 'Start Verification';
      case 'id-upload': return 'Continue';
      case 'selfie': return 'Continue';
      case 'review': return 'Submit for Verification';
      case 'complete': return 'Done';
      default: return 'Continue';
    }
  };

  const handleButtonPress = () => {
    switch (step) {
      case 'intro': return handleStartVerification();
      case 'id-upload': return handleContinueFromId();
      case 'selfie': return handleContinueFromSelfie();
      case 'review': return handleSubmitVerification();
      case 'complete': return handleFinish();
    }
  };

  const isButtonDisabled = () => {
    switch (step) {
      case 'intro': return !hasConsented;
      case 'id-upload': return !idPhoto;
      case 'selfie': return !selfiePhoto;
      case 'processing': return true;
      default: return false;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Header */}
      {step !== 'processing' && step !== 'complete' && (
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {getStepTitle()}
          </Text>
          <View style={styles.headerRight} />
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 'intro' && renderIntroStep()}
        {step === 'id-upload' && renderIdUploadStep()}
        {step === 'selfie' && renderSelfieStep()}
        {step === 'review' && renderReviewStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'complete' && renderCompleteStep()}
      </ScrollView>

      {/* Footer */}
      {step !== 'processing' && (
        <View style={styles.footer}>
          <Pressable
            style={[
              styles.continueButton,
              isButtonDisabled() && styles.continueButtonDisabled,
            ]}
            onPress={handleButtonPress}
            disabled={isButtonDisabled()}
          >
            <Text style={styles.continueButtonText}>{getButtonText()}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  stepContent: {
    flex: 1,
  },
  // Intro step
  hero: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoCard: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  infoText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  benefitsCard: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
  },
  privacyCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    gap: spacing[3],
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  privacyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // Step header
  stepHeader: {
    marginBottom: spacing[6],
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing[2],
  },
  stepNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  stepOf: {
    fontSize: 14,
    color: colors.transparent.white50,
    marginLeft: spacing[1],
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  // ID upload step
  idTypesCard: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  idTypesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  idTypesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  idTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  idTypeText: {
    fontSize: 13,
  },
  uploadArea: {
    height: 200,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.transparent.white20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  uploadAreaWithPhoto: {
    borderStyle: 'solid',
    borderColor: colors.primary.gold,
  },
  uploadIcon: {
    marginBottom: spacing[3],
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  uploadHint: {
    fontSize: 13,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  retakeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeText: {
    color: colors.primary.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing[2],
  },
  tipsContainer: {
    marginBottom: spacing[4],
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  tipItem: {
    fontSize: 13,
    marginBottom: spacing[1],
  },
  // Selfie step
  selfieArea: {
    height: 300,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.transparent.white20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  selfieFrame: {
    position: 'absolute',
    width: '80%',
    aspectRatio: 1,
  },
  selfieOutline: {
    flex: 1,
    borderRadius: 1000,
    borderWidth: 2,
    borderColor: colors.transparent.white20,
    borderStyle: 'dashed',
  },
  selfieImage: {
    width: '100%',
    height: '100%',
  },
  // Review step
  reviewPhotos: {
    flexDirection: 'row',
    gap: spacing[4],
    marginBottom: spacing[4],
  },
  reviewPhotoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  reviewPhotoLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  reviewPhotoFrame: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  reviewSelfieFrame: {
    aspectRatio: 1,
    borderRadius: 100,
  },
  reviewIdImage: {
    width: '100%',
    height: '100%',
  },
  reviewSelfieImage: {
    width: '100%',
    height: '100%',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary.gold,
  },
  finalNotice: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  finalNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // Processing step
  processingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  processingIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  processingSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  processingSteps: {
    gap: spacing[3],
  },
  processingStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  processingStepText: {
    fontSize: 15,
  },
  // Complete step
  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  completeIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  completeSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[6],
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
  },
  completeBadgeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Footer
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
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
