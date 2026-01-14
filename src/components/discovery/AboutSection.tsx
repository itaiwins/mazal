/**
 * About Section Component
 *
 * Bio and basic details display
 */

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface AboutSectionProps {
  bio?: string;
  location?: string;
  height?: number; // in cm
  occupation?: string;
  company?: string;
  education?: string;
  school?: string;
}

// Convert cm to feet/inches
function formatHeight(cm?: number): string | null {
  if (!cm) return null;
  const inches = cm / 2.54;
  const feet = Math.floor(inches / 12);
  const remainingInches = Math.round(inches % 12);
  return `${feet}'${remainingInches}"`;
}

interface DetailRowProps {
  icon: string;
  text: string;
}

function DetailRow({ icon, text }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={18} color={colors.transparent.white60} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

export function AboutSection({
  bio,
  location,
  height,
  occupation,
  company,
  education,
  school,
}: AboutSectionProps) {
  const formattedHeight = formatHeight(height);
  const hasDetails = location || formattedHeight || occupation || education;

  if (!bio && !hasDetails) {
    return null;
  }

  return (
    <Animated.View entering={FadeInUp.delay(400)} style={styles.container}>
      <Text style={styles.sectionTitle}>About</Text>

      {/* Bio */}
      {bio && (
        <View style={styles.bioContainer}>
          <Text style={styles.bioText}>{bio}</Text>
        </View>
      )}

      {/* Details */}
      {hasDetails && (
        <View style={styles.detailsContainer}>
          {location && <DetailRow icon="location-outline" text={location} />}
          {formattedHeight && <DetailRow icon="resize-outline" text={formattedHeight} />}
          {occupation && (
            <DetailRow
              icon="briefcase-outline"
              text={company ? `${occupation} at ${company}` : occupation}
            />
          )}
          {education && (
            <DetailRow
              icon="school-outline"
              text={school ? `${education} - ${school}` : education}
            />
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[5],
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[4],
  },
  bioContainer: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  bioText: {
    fontSize: 16,
    color: colors.primary.white,
    lineHeight: 24,
  },
  detailsContainer: {
    gap: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  detailText: {
    fontSize: 15,
    color: colors.transparent.white80,
  },
});
