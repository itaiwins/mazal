/**
 * Safta Mode Tab (For Regular Users)
 *
 * Generate invite codes for parents/grandparents to connect as matchmakers
 * View and manage connected Saftas
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';

// Type for connected Safta
interface ConnectedSafta {
  id: string;
  name: string;
  relationship: string;
  matchesFound: number;
  connectedAt: Date;
}

// Generate a unique invite link
function generateInviteLink(userId: string): string {
  // In production, this would create a deep link that opens the app
  // For now, use a short unique identifier based on user ID
  const shortId = userId.slice(0, 8).replace(/-/g, '');
  return `https://mazal.app/invite/${shortId}`;
}

export default function SaftaTabScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const authUser = useAuthStore((s) => s.authUser);
  const hasSaftaProfile = useAuthStore((s) => s.hasSaftaProfile);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [connectedSaftas, setConnectedSaftas] = useState<ConnectedSafta[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Generate invite link from user ID (use authUser as fallback if user not loaded)
  const userId = user?.id || authUser?.id;
  useEffect(() => {
    if (userId) {
      setInviteLink(generateInviteLink(userId));
    }
  }, [userId]);

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    await Clipboard.setStringAsync(inviteLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedLink(true);

    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleShareLink = async () => {
    if (!inviteLink) {
      Alert.alert('Error', 'Invite link not ready. Please try again.');
      return;
    }

    setIsSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const message = `I want you to be my matchmaker on Mazal!

Tap this link to connect with me and start browsing matches:
${inviteLink}

Download Mazal from the App Store if you don't have it yet!`;

      await Share.share({
        message,
        title: 'Join Mazal as my Matchmaker',
      });
    } catch (error) {
      console.error('Share error:', error);
      // Don't show alert for user cancel
      if ((error as any)?.message !== 'User did not share') {
        Alert.alert('Error', 'Could not share invite link. Please try again.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Switch to Safta mode
  const handleSwitchToSaftaMode = () => {
    console.log('[Safta] Switch button pressed, hasSaftaProfile:', hasSaftaProfile);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentMode('safta');

    // Navigate directly based on Safta profile state
    if (hasSaftaProfile) {
      console.log('[Safta] Navigating to safta-tabs');
      router.replace('/(safta-tabs)');
    } else {
      console.log('[Safta] Navigating to safta-auth/welcome');
      router.replace('/(safta-auth)/welcome');
    }
  };

  const handleMessageSafta = (saftaId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // In production, navigate to Safta chat
    router.push(`/(safta)/chat/${saftaId}`);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Invite a Matchmaker</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Let your family help you find love
        </Text>
      </Animated.View>

      {/* Hero Illustration */}
      <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.heroContainer}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>👵</Text>
          <Animated.View entering={ZoomIn.delay(500).springify()} style={styles.heroHeart}>
            <Text style={styles.heroHeartEmoji}>💛</Text>
          </Animated.View>
          <Text style={styles.heroEmoji}>👴</Text>
        </View>
      </Animated.View>

      {/* Invite Link Section */}
      <Animated.View
        entering={FadeInDown.delay(300).springify()}
        style={[styles.inviteCard, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={[styles.inviteTitle, { color: theme.colors.text }]}>
          Your Invite Link
        </Text>
        <Text style={[styles.inviteDescription, { color: theme.colors.textSecondary }]}>
          Share this link with a parent or grandparent to connect them as your matchmaker
        </Text>

        {/* Link Display */}
        <View style={styles.linkContainer}>
          {inviteLink ? (
            <Pressable
              style={[styles.linkBox, { borderColor: colors.primary.gold }]}
              onPress={handleCopyLink}
            >
              <Ionicons name="link" size={18} color={colors.primary.gold} />
              <Text style={[styles.linkText, { color: colors.primary.gold }]} numberOfLines={1}>
                {inviteLink}
              </Text>
              <Ionicons
                name={copiedLink ? 'checkmark-circle' : 'copy-outline'}
                size={20}
                color={copiedLink ? colors.semantic.success : colors.primary.gold}
              />
            </Pressable>
          ) : (
            <ActivityIndicator color={colors.primary.gold} />
          )}
        </View>

        {copiedLink && (
          <Text style={styles.copiedText}>Link copied to clipboard!</Text>
        )}

        {/* Action Button */}
        <Pressable style={styles.shareButton} onPress={handleShareLink}>
          <Ionicons name="share-outline" size={20} color={colors.primary.navy} />
          <Text style={styles.shareButtonText}>Share Link</Text>
        </Pressable>
      </Animated.View>

      {/* How It Works */}
      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.howItWorks}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>How It Works</Text>

        <View style={styles.stepsList}>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.transparent.gold20 }]}>
              <Text style={[styles.stepNumberText, { color: colors.primary.gold }]}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
                Share Your Link
              </Text>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Send the invite link to a parent or grandparent
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.transparent.gold20 }]}>
              <Text style={[styles.stepNumberText, { color: colors.primary.gold }]}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
                They Create a Free Account
              </Text>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Your matchmaker signs up for free on Mazal
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.transparent.gold20 }]}>
              <Text style={[styles.stepNumberText, { color: colors.primary.gold }]}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
                They Browse & Recommend
              </Text>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                They find profiles and send you recommendations
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.transparent.gold20 }]}>
              <Text style={[styles.stepNumberText, { color: colors.primary.gold }]}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
                Connect & Match
              </Text>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Review recommendations and find your match!
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Connected Saftas Section */}
      {connectedSaftas.length > 0 && (
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.connectedSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Your Matchmakers
          </Text>
          {connectedSaftas.map((safta) => (
            <View
              key={safta.id}
              style={[styles.saftaCard, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.saftaInfo}>
                <View style={styles.saftaAvatar}>
                  <Text style={styles.saftaAvatarEmoji}>👵</Text>
                </View>
                <View style={styles.saftaDetails}>
                  <Text style={[styles.saftaName, { color: theme.colors.text }]}>
                    {safta.name}
                  </Text>
                  <Text style={[styles.saftaRelationship, { color: theme.colors.textSecondary }]}>
                    {safta.relationship} • {safta.matchesFound} matches found
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.messageButton}
                onPress={() => handleMessageSafta(safta.id)}
              >
                <Ionicons name="chatbubble-outline" size={20} color={colors.primary.gold} />
              </Pressable>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Empty State for No Connected Saftas */}
      {connectedSaftas.length === 0 && (
        <Animated.View
          entering={FadeInDown.delay(500).springify()}
          style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}
        >
          <Ionicons name="people-outline" size={40} color={colors.neutral[400]} />
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
            No matchmakers connected yet. Share your link to get started!
          </Text>
        </Animated.View>
      )}

      {/* Become a Safta Section */}
      <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.becomeSaftaSection}>
        <View style={styles.divider} />

        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: spacing[4] }]}>
          Want to Be a Matchmaker?
        </Text>

        <Pressable style={styles.becomeSaftaCard} onPress={handleSwitchToSaftaMode}>
          <LinearGradient
            colors={[colors.transparent.gold20, colors.transparent.gold10]}
            style={styles.becomeSaftaGradient}
          >
            <View style={styles.becomeSaftaContent}>
              <View style={styles.becomeSaftaIconContainer}>
                <Text style={styles.becomeSaftaEmoji}>👵</Text>
              </View>
              <View style={styles.becomeSaftaTextContainer}>
                <Text style={[styles.becomeSaftaTitle, { color: theme.colors.text }]}>
                  {hasSaftaProfile ? 'Switch to Safta Mode' : 'Become a Safta Matchmaker'}
                </Text>
                <Text style={[styles.becomeSaftaSubtitle, { color: theme.colors.textSecondary }]}>
                  {hasSaftaProfile
                    ? 'Help your family and friends find love'
                    : 'Set up your matchmaker profile to help others find their match'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.primary.gold} />
            </View>
          </LinearGradient>
        </Pressable>

        <Text style={[styles.becomeSaftaNote, { color: theme.colors.textTertiary }]}>
          You can have both a regular profile and a Safta profile. Switch between them anytime.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  heroEmoji: {
    fontSize: 56,
  },
  heroHeart: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroHeartEmoji: {
    fontSize: 18,
  },
  inviteCard: {
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[6],
  },
  inviteTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  inviteDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  linkContainer: {
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: spacing[2],
    maxWidth: '100%',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  copiedText: {
    fontSize: 13,
    color: colors.semantic.success,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  howItWorks: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing[4],
  },
  stepsList: {
    gap: spacing[4],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  connectedSection: {
    marginBottom: spacing[4],
  },
  saftaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
  },
  saftaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  saftaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saftaAvatarEmoji: {
    fontSize: 24,
  },
  saftaDetails: {
    gap: spacing[0.5],
  },
  saftaName: {
    fontSize: 16,
    fontWeight: '600',
  },
  saftaRelationship: {
    fontSize: 13,
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[6],
    borderRadius: borderRadius.xl,
    gap: spacing[3],
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Become a Safta Section
  becomeSaftaSection: {
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  divider: {
    height: 1,
    backgroundColor: colors.transparent.white10,
    marginVertical: spacing[4],
  },
  becomeSaftaCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  becomeSaftaGradient: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  becomeSaftaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  becomeSaftaIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.transparent.gold20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  becomeSaftaEmoji: {
    fontSize: 28,
  },
  becomeSaftaTextContainer: {
    flex: 1,
  },
  becomeSaftaTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  becomeSaftaSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  becomeSaftaNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
