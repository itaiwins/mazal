/**
 * Blocked Users Screen
 *
 * Manage blocked users list
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
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

// Sample blocked users for demo
const SAMPLE_BLOCKED = [
  {
    id: '1',
    name: 'Alex',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    blockedAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Jordan',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    blockedAt: '2024-01-10',
  },
];

export default function BlockedUsersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [blockedUsers, setBlockedUsers] = useState(SAMPLE_BLOCKED);

  const handleBack = () => {
    router.back();
  };

  const handleUnblock = (user: typeof SAMPLE_BLOCKED[0]) => {
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[2],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Blocked Users
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {blockedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="hand-left-outline" size={48} color={colors.neutral[400]} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No Blocked Users
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Users you block will appear here. They won't be able to see your profile or message you.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.count, { color: theme.colors.textSecondary }]}>
              {blockedUsers.length} blocked user{blockedUsers.length !== 1 ? 's' : ''}
            </Text>

            <View style={[styles.userList, { backgroundColor: theme.colors.surface }]}>
              {blockedUsers.map((user, index) => (
                <View
                  key={user.id}
                  style={[
                    styles.userItem,
                    index < blockedUsers.length - 1 && styles.userItemBorder,
                  ]}
                >
                  <Image source={{ uri: user.photo }} style={styles.userPhoto} />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.colors.text }]}>
                      {user.name}
                    </Text>
                    <Text style={[styles.blockedDate, { color: theme.colors.textTertiary }]}>
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
              ))}
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.transparent.gold20 }]}>
              <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                Blocked users cannot see your profile, send you messages, or find you in search results.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
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
    paddingHorizontal: spacing[4],
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  count: {
    fontSize: 14,
    marginTop: spacing[4],
    marginBottom: spacing[3],
    marginLeft: spacing[1],
  },
  userList: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  userItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  userPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  blockedDate: {
    fontSize: 13,
    marginTop: spacing[1],
  },
  unblockButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.md,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginTop: spacing[6],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
