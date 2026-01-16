/**
 * Help & FAQ Screen
 *
 * Premium help screen with dark theme
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, FadeInUp, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'How does Mazal work?',
    answer: 'Mazal connects Jewish singles looking for meaningful relationships. Browse profiles, swipe right on people you like, and when you both swipe right, it\'s a match! You can then message each other.',
  },
  {
    id: '2',
    question: 'What is Safta Mode?',
    answer: 'Safta Mode allows your grandparents or parents to browse potential matches for you. They can send you profiles they approve of, and you decide whether to connect.',
  },
  {
    id: '3',
    question: 'How do I verify my profile?',
    answer: 'Go to your profile and tap on the verification badge. Follow the prompts to take a selfie that matches your profile photos. Verified profiles get more matches!',
  },
  {
    id: '4',
    question: 'What is a Super Like?',
    answer: 'A Super Like lets someone know you\'re especially interested in them before they swipe. Your profile will show up with a blue star, and you\'ll go to the front of their queue.',
  },
  {
    id: '5',
    question: 'How do I hide my profile?',
    answer: 'Go to Settings > Discovery and toggle "Hide Profile" on. You\'ll still be able to browse and message matches, but you won\'t appear in other people\'s discovery feed.',
  },
  {
    id: '6',
    question: 'How do I report or block someone?',
    answer: 'On their profile or in a chat, tap the menu icon (three dots) and select "Report" or "Block". Blocking is immediate and they won\'t be able to see or contact you.',
  },
  {
    id: '7',
    question: 'What is the Mazal Map?',
    answer: 'The Mazal Map shows you Jewish singles near specific locations like colleges, synagogues, or neighborhoods. Save locations important to you to see who\'s there!',
  },
];

function FAQCard({ item, index }: { item: FAQItem; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
      <Pressable
        style={[styles.faqCard, isExpanded && styles.faqCardExpanded]}
        onPress={handlePress}
      >
        <View style={styles.faqHeader}>
          <Text style={styles.faqQuestion}>{item.question}</Text>
          <View style={[styles.faqIcon, isExpanded && styles.faqIconExpanded]}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.primary.gold}
            />
          </View>
        </View>
        {isExpanded && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Text style={styles.faqAnswer}>{item.answer}</Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:support@mazaldating.com');
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
          <Text style={styles.headerTitle}>Help & FAQ</Text>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Get Help</Text>
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              onPress={handleContactSupport}
            >
              <View style={styles.navItemLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.primary.gold} />
                </View>
                <Text style={styles.navItemLabel}>Contact Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={styles.navItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.transparent.white10 }]}>
                  <Ionicons name="bug-outline" size={20} color={colors.transparent.white60} />
                </View>
                <Text style={styles.navItemLabel}>Report a Bug</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={styles.navItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.transparent.white10 }]}>
                  <Ionicons name="bulb-outline" size={20} color={colors.transparent.white60} />
                </View>
                <Text style={styles.navItemLabel}>Suggest a Feature</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>
        </Animated.View>

        {/* FAQ */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item, index) => (
              <FAQCard key={item.id} item={item} index={index} />
            ))}
          </View>
        </Animated.View>

        {/* Community */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Community</Text>
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={styles.navItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.transparent.white10 }]}>
                  <Ionicons name="book-outline" size={20} color={colors.transparent.white60} />
                </View>
                <Text style={styles.navItemLabel}>Dating Tips Blog</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={styles.navItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.transparent.error10 }]}>
                  <Ionicons name="heart-outline" size={20} color={colors.semantic.error} />
                </View>
                <Text style={styles.navItemLabel}>Success Stories</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </Pressable>
          </View>
        </Animated.View>
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
  },
  section: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[4],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.transparent.white50,
    marginBottom: spacing[3],
    marginLeft: spacing[2],
  },
  card: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    overflow: 'hidden',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
  },
  navItemPressed: {
    backgroundColor: colors.transparent.white05,
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
  },
  divider: {
    height: 1,
    backgroundColor: colors.transparent.white10,
    marginLeft: spacing[4] + 36 + spacing[3],
  },
  faqList: {
    gap: spacing[2],
  },
  faqCard: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  faqCardExpanded: {
    borderColor: colors.transparent.gold30,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.white,
    flex: 1,
    marginRight: spacing[2],
  },
  faqIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqIconExpanded: {
    backgroundColor: colors.transparent.gold20,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.transparent.white60,
    marginTop: spacing[3],
  },
});
