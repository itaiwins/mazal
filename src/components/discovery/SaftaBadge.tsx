/**
 * Safta Badge Component
 *
 * Display Safta approvals and recommendations
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface SaftaBadgeProps {
  approvalCount: number;
  recommendation?: string;
  saftaName?: string;
}

export function SaftaBadge({ approvalCount, recommendation, saftaName }: SaftaBadgeProps) {
  if (approvalCount === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeInUp.delay(600)} style={styles.container}>
      <LinearGradient
        colors={[colors.transparent.gold10, colors.transparent.gold20]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>👵</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {approvalCount} {approvalCount === 1 ? 'Safta Approves!' : 'Saftas Approve!'}
            </Text>
            <Text style={styles.subtitle}>Family endorsed</Text>
          </View>
        </View>

        {/* Recommendation Quote */}
        {recommendation && (
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>"{recommendation}"</Text>
            {saftaName && <Text style={styles.quoteName}>— {saftaName}</Text>}
          </View>
        )}

        {/* Trust indicator */}
        <View style={styles.trustBadge}>
          <Text style={styles.trustText}>Verified Family Connection</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[6],
    marginHorizontal: spacing[5],
  },
  gradient: {
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  emoji: {
    fontSize: 36,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  subtitle: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: 2,
  },
  quoteContainer: {
    marginTop: spacing[4],
    paddingLeft: spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: colors.transparent.gold50,
  },
  quoteText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.transparent.white80,
    lineHeight: 22,
  },
  quoteName: {
    fontSize: 13,
    color: colors.transparent.white60,
    marginTop: spacing[2],
  },
  trustBadge: {
    marginTop: spacing[4],
    alignSelf: 'flex-start',
    backgroundColor: colors.transparent.gold20,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
