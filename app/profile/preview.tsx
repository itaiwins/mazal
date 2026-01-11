/**
 * Profile Preview Screen
 *
 * See your profile as others see it
 */

import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';

const { width } = Dimensions.get('window');

// Calculate age from date of birth
function calculateAge(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 25;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default function ProfilePreviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Preview</Text>
        <Pressable style={styles.editButton} onPress={() => router.push('/profile/edit')}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          {/* Photo */}
          <View style={[styles.photoPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="person" size={80} color={colors.neutral[300]} />
          </View>

          {/* Info Overlay */}
          <View style={styles.infoOverlay}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {user?.first_name || 'Your Name'}, {calculateAge(user?.date_of_birth)}
              </Text>
              <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={14} color={colors.primary.white} />
              <Text style={styles.detail}>{user?.current_city || 'Your City'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="briefcase" size={14} color={colors.primary.white} />
              <Text style={styles.detail}>{user?.occupation || 'Your Job'}</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About Me</Text>
          <Text style={[styles.bio, { color: theme.colors.textSecondary }]}>
            {user?.bio || 'Your bio will appear here. Tell potential matches about yourself!'}
          </Text>
        </View>

        {/* Jewish Identity */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Jewish Identity</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
              <Text style={styles.badgeEmoji}>✡️</Text>
              <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                {user?.jewish_background || 'Reform'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
              <Text style={styles.badgeEmoji}>🕯️</Text>
              <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                Shabbat
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.transparent.gold20 }]}>
              <Text style={styles.badgeEmoji}>🍽️</Text>
              <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                Kosher-style
              </Text>
            </View>
          </View>
        </View>

        {/* Prompts */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.promptQuestion, { color: theme.colors.textSecondary }]}>
            My ideal Shabbat dinner includes...
          </Text>
          <Text style={[styles.promptAnswer, { color: theme.colors.text }]}>
            Good food, great conversation, and family. Nothing beats homemade challah!
          </Text>
        </View>

        {/* Tip */}
        <View style={[styles.tipCard, { backgroundColor: colors.transparent.gold20 }]}>
          <Ionicons name="bulb" size={20} color={colors.primary.gold} />
          <Text style={[styles.tipText, { color: theme.colors.text }]}>
            This is how others see your profile. Add more photos and prompts to stand out!
          </Text>
        </View>
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
  editButton: {
    paddingHorizontal: spacing[2],
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  content: {
    flex: 1,
  },
  card: {
    margin: spacing[4],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    width: '100%',
    height: width - spacing[8],
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[4],
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[0.5],
  },
  detail: {
    fontSize: 14,
    color: colors.primary.white,
  },
  section: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  promptQuestion: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing[2],
  },
  promptAnswer: {
    fontSize: 16,
    lineHeight: 24,
  },
  tipCard: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[3],
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
