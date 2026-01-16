/**
 * Blocked Users Screen
 *
 * Premium blocked users with dark theme
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

type BlockedUser = {
  id: string;
  name: string;
  photo: string;
  blockedAt: string;
};

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${user.name}? They will be able to see your profile and message you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setBlockedUsers(blockedUsers.filter((u) => u.id !== user.id));
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[colors.primary.navy, colors.dark.background]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={colors.primary.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {blockedUsers.length === 0 ? (
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="hand-left-outline" size={48} color={colors.primary.gold} />
            </View>
            <Text style={styles.emptyTitle}>No Blocked Users</Text>
            <Text style={styles.emptySubtitle}>
              Users you block will appear here. They won't be able to see your profile or message you.
            </Text>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInUp.delay(100).springify()}>
              <Text style={styles.count}>
                {blockedUsers.length} blocked user{blockedUsers.length !== 1 ? 's' : ''}
              </Text>
            </Animated.View>

            <View style={styles.userList}>
              {blockedUsers.map((user, index) => (
                <Animated.View
                  key={user.id}
                  entering={FadeInRight.delay(index * 50).springify()}
                >
                  <View style={styles.userItem}>
                    <Image source={{ uri: user.photo }} style={styles.userPhoto} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.blockedDate}>
                        Blocked on {new Date(user.blockedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.unblockButton}
                      onPress={() => handleUnblock(user)}
                    >
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ))}
            </View>

            <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
              </View>
              <Text style={styles.infoText}>
                Blocked users cannot see your profile, send you messages, or find you in search results.
              </Text>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  headerGradient: {
    paddingBottom: spacing[4],
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
    color: colors.primary.white,
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 2,
    borderColor: colors.transparent.gold20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    color: colors.transparent.white60,
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.transparent.white50,
    marginTop: spacing[4],
    marginBottom: spacing[3],
    marginLeft: spacing[2],
  },
  userList: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    overflow: 'hidden',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  userPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.transparent.white20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  blockedDate: {
    fontSize: 13,
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  unblockButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.transparent.white20,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.white,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    gap: spacing[3],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: colors.transparent.gold20,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.transparent.white70,
  },
});
