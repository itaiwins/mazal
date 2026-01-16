/**
 * Enter Invite Link Screen
 *
 * Safta enters the invite link from their family member to connect
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function EnterLinkScreen() {
  const insets = useSafeAreaInsets();
  const [inviteLink, setInviteLink] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerifyLink = async () => {
    if (!inviteLink.trim()) {
      setError('Please enter or paste the invite link');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // In production, this would verify the link and extract the user ID
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Accept links that match our pattern
      if (inviteLink.includes('mazal.app/invite/')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Extract the invite ID and store it for after signup
        router.push('/(safta-auth)/signup');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError('Invalid invite link. Please check and try again.');
      }
    } catch (err) {
      setError('Could not verify link. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLinkChange = (text: string) => {
    setInviteLink(text);
    if (error) setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[colors.primary.navy, '#1a2d52', colors.primary.navy]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Back button */}
      <Pressable
        style={[styles.backButton, { top: insets.top + spacing[2] }]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
      </Pressable>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="link" size={36} color={colors.primary.gold} />
          </View>
          <Text style={styles.title}>Enter Invite Link</Text>
          <Text style={styles.subtitle}>
            Paste the link your child or grandchild shared with you
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.inputSection}>
          <View style={[styles.linkInputContainer, error && styles.linkInputError]}>
            <Ionicons name="link" size={20} color={colors.transparent.white50} />
            <TextInput
              style={styles.linkInput}
              value={inviteLink}
              onChangeText={handleLinkChange}
              placeholder="mazal.app/invite/..."
              placeholderTextColor={colors.transparent.white30}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.helpSection}>
          <Ionicons name="information-circle-outline" size={18} color={colors.transparent.white50} />
          <Text style={styles.helpText}>
            Ask your family member to share their invite link from the Mazal app. You can also sign up first and connect later!
          </Text>
        </Animated.View>
      </View>

      {/* Bottom button */}
      <Animated.View
        entering={FadeInDown.delay(300).springify()}
        style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing[4] }]}
      >
        <Pressable
          style={[styles.continueButton, !inviteLink.trim() && styles.continueButtonDisabled]}
          onPress={handleVerifyLink}
          disabled={!inviteLink.trim() || isVerifying}
        >
          <Text style={styles.continueButtonText}>
            {isVerifying ? 'Verifying...' : 'Connect & Continue'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.skipButton}
          onPress={() => router.push('/(safta-auth)/signup')}
        >
          <Text style={styles.skipButtonText}>
            I'll connect with my family later
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  backButton: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    color: colors.transparent.white70,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: spacing[4],
  },
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    borderWidth: 2,
    borderColor: colors.transparent.white20,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  linkInputError: {
    borderColor: colors.semantic.error,
  },
  linkInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primary.white,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: colors.transparent.white50,
    lineHeight: 20,
  },
  bottomSection: {
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  continueButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: colors.primary.navy,
    fontSize: 17,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  skipButtonText: {
    color: colors.transparent.white60,
    fontSize: 15,
  },
});
