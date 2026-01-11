/**
 * Shadchan Connect
 *
 * Connect with verified shadchanim
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

// Sample shadchanim data
const SHADCHANIM = [
  {
    id: '1',
    name: 'Mrs. Sarah Goldberg',
    title: 'Professional Shadchan',
    location: 'Brooklyn, NY',
    specialty: 'Yeshivish & Modern Orthodox Machmir',
    experience: '20+ years',
    photo: null,
    phone: '+1234567890',
    verified: true,
  },
  {
    id: '2',
    name: 'Rabbi Moshe Schwartz',
    title: 'Community Shadchan',
    location: 'Lakewood, NJ',
    specialty: 'Yeshivish',
    experience: '15+ years',
    photo: null,
    phone: '+1234567891',
    verified: true,
  },
  {
    id: '3',
    name: 'Mrs. Rivka Cohen',
    title: 'Young Professionals Specialist',
    location: 'Manhattan, NY',
    specialty: 'Modern Orthodox',
    experience: '10+ years',
    photo: null,
    phone: '+1234567892',
    verified: true,
  },
];

interface ShadchanCardProps {
  shadchan: typeof SHADCHANIM[0];
}

function ShadchanCard({ shadchan }: ShadchanCardProps) {
  const theme = useTheme();

  const handleContact = () => {
    Linking.openURL(`tel:${shadchan.phone}`);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {shadchan.name.split(' ').map((n) => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {shadchan.name}
            </Text>
            {shadchan.verified && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.semantic.success}
              />
            )}
          </View>
          <Text style={[styles.title, { color: theme.colors.textSecondary }]}>
            {shadchan.title}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={theme.colors.icon} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {shadchan.location}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="sparkles" size={16} color={theme.colors.icon} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {shadchan.specialty}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color={theme.colors.icon} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {shadchan.experience} experience
          </Text>
        </View>
      </View>

      <Pressable style={styles.contactButton} onPress={handleContact}>
        <Ionicons name="call" size={18} color={colors.primary.navy} />
        <Text style={styles.contactButtonText}>Contact</Text>
      </Pressable>
    </View>
  );
}

export default function ShadchanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Shadchan Connect
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Intro */}
      <View style={styles.introContainer}>
        <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
          Connect with experienced shadchanim who can help guide your shidduch journey.
          All shadchanim are verified and trusted community members.
        </Text>
      </View>

      {/* Shadchan List */}
      <FlatList
        data={SHADCHANIM}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ShadchanCard shadchan={item} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* Become a Shadchan */}
      <View style={[styles.becomeContainer, { paddingBottom: insets.bottom + spacing[4] }]}>
        <Pressable
          style={[styles.becomeButton, { backgroundColor: theme.colors.surface }]}
        >
          <Ionicons name="add-circle" size={22} color={colors.primary.gold} />
          <Text style={[styles.becomeText, { color: theme.colors.text }]}>
            Are you a shadchan? Apply to be listed
          </Text>
        </Pressable>
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
  introContainer: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.navy,
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
  },
  title: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },
  cardDetails: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  detailText: {
    fontSize: 14,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  becomeContainer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  becomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  becomeText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
