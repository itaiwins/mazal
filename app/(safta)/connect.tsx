/**
 * Safta Connect
 *
 * For grandparents/family to enter invite code and connect
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function SaftaConnectScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [grandchildName, setGrandchildName] = useState('');

  const isValidCode = code.trim().length >= 6;

  const handleConnect = async () => {
    if (!isValidCode) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsConnecting(true);
    try {
      // In production, this would verify the code with Supabase
      // Simulating API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock success
      setGrandchildName('Sarah');
      setIsConnected(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Invalid invite code. Please check and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartBrowsing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(safta)/browse');
  };

  const handleBack = () => {
    router.back();
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
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {isConnected ? 'Connected!' : 'Enter Code'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {!isConnected ? (
          <>
            {/* Hero */}
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              style={styles.heroContainer}
            >
              <View style={styles.hero}>
                <Text style={styles.heroEmoji}>👵</Text>
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              style={styles.titleContainer}
            >
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Welcome to Safta Mode
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                Enter the invite code your grandchild shared with you
              </Text>
            </Animated.View>

            {/* Code Input */}
            <Animated.View
              entering={FadeInDown.delay(300).springify()}
              style={styles.codeSection}
            >
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="MAZAL-XXXXXX"
                placeholderTextColor={theme.colors.textTertiary}
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                textAlign="center"
              />
            </Animated.View>

            {/* Info Card */}
            <Animated.View
              entering={FadeInDown.delay(400).springify()}
              style={[styles.infoCard, { backgroundColor: colors.transparent.gold20 }]}
            >
              <Ionicons name="heart" size={20} color={colors.primary.gold} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                As a Safta, you'll be able to browse potential matches and send your
                recommendations. Your grandchild will see your suggestions with love!
              </Text>
            </Animated.View>
          </>
        ) : (
          <>
            {/* Success State */}
            <Animated.View
              entering={FadeInDown.springify()}
              style={styles.successContainer}
            >
              <Animated.View
                entering={ZoomIn.delay(200).springify()}
                style={styles.successIcon}
              >
                <Ionicons name="heart-circle" size={80} color={colors.primary.gold} />
              </Animated.View>
              <Text style={[styles.successTitle, { color: theme.colors.text }]}>
                You're connected!
              </Text>
              <Text style={[styles.successSubtitle, { color: theme.colors.textSecondary }]}>
                You can now help {grandchildName} find their bashert
              </Text>

              <View style={[styles.permissionCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>
                  What you can do:
                </Text>
                <View style={styles.permissionItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.semantic.success} />
                  <Text style={[styles.permissionText, { color: theme.colors.textSecondary }]}>
                    Browse profiles {grandchildName} passed on
                  </Text>
                </View>
                <View style={styles.permissionItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.semantic.success} />
                  <Text style={[styles.permissionText, { color: theme.colors.textSecondary }]}>
                    Send profile recommendations
                  </Text>
                </View>
                <View style={styles.permissionItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.semantic.success} />
                  <Text style={[styles.permissionText, { color: theme.colors.textSecondary }]}>
                    Leave notes with your suggestions
                  </Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {!isConnected ? (
          <Pressable
            style={[
              styles.connectButton,
              (!isValidCode || isConnecting) && styles.connectButtonDisabled,
            ]}
            onPress={handleConnect}
            disabled={!isValidCode || isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.primary.navy} />
            ) : (
              <Text style={styles.connectButtonText}>Connect</Text>
            )}
          </Pressable>
        ) : (
          <Pressable style={styles.connectButton} onPress={handleStartBrowsing}>
            <Text style={styles.connectButtonText}>Start Browsing</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.primary.navy} />
          </Pressable>
        )}
      </View>
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
    paddingHorizontal: spacing[6],
  },
  heroContainer: {
    alignItems: 'center',
    marginVertical: spacing[6],
  },
  hero: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 52,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  codeSection: {
    marginBottom: spacing[6],
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 2,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[5],
    borderRadius: borderRadius.lg,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: spacing[6],
  },
  successIcon: {
    marginBottom: spacing[4],
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  permissionCard: {
    width: '100%',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  permissionText: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
