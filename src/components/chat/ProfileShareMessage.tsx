/**
 * Profile Share Message Component
 *
 * Displays a shared profile in a chat message
 * Allows the recipient to view the full profile
 */

import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface ProfileShareData {
  id: string;
  name: string;
  age: number;
  photo: string;
  occupation?: string;
  jewishBackground?: string;
}

interface ProfileShareMessageProps {
  profile: ProfileShareData;
  senderName: string;
  message?: string;
  isMe: boolean;
  isSafta?: boolean;
}

export function ProfileShareMessage({
  profile,
  senderName,
  message,
  isMe,
  isSafta,
}: ProfileShareMessageProps) {
  const handleViewProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to profile view
    router.push(`/profile/${profile.id}`);
  };

  return (
    <View style={[styles.container, isMe && styles.containerMe]}>
      {/* Header */}
      <View style={styles.header}>
        {isSafta ? (
          <Text style={styles.headerEmoji}>👵</Text>
        ) : (
          <Ionicons name="heart" size={16} color={colors.primary.gold} />
        )}
        <Text style={styles.headerText}>
          {isMe ? 'Shared a profile' : `${senderName} shared a profile`}
        </Text>
      </View>

      {/* Profile Card */}
      <Pressable style={styles.profileCard} onPress={handleViewProfile}>
        <Image source={{ uri: profile.photo }} style={styles.profilePhoto} />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile.name}, {profile.age}</Text>
          {profile.occupation && (
            <Text style={styles.profileDetail}>{profile.occupation}</Text>
          )}
          {profile.jewishBackground && (
            <View style={styles.backgroundBadge}>
              <Text style={styles.backgroundText}>{profile.jewishBackground}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.transparent.white50} />
      </Pressable>

      {/* Optional message */}
      {message && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>"{message}"</Text>
        </View>
      )}

      {/* View button */}
      <Pressable style={styles.viewButton} onPress={handleViewProfile}>
        <Text style={styles.viewButtonText}>View Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  containerMe: {
    alignSelf: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  headerEmoji: {
    fontSize: 14,
  },
  headerText: {
    fontSize: 13,
    color: colors.transparent.white60,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.md,
    padding: spacing[2],
  },
  profilePhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileInfo: {
    flex: 1,
    gap: spacing[0.5],
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  profileDetail: {
    fontSize: 13,
    color: colors.transparent.white60,
  },
  backgroundBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
    marginTop: spacing[0.5],
  },
  backgroundText: {
    fontSize: 11,
    color: colors.primary.gold,
    fontWeight: '500',
  },
  messageContainer: {
    marginTop: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.transparent.white10,
  },
  messageText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.transparent.white70,
    lineHeight: 20,
  },
  viewButton: {
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2],
    marginTop: spacing[3],
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.gold,
  },
});
