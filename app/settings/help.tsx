/**
 * Help & FAQ Screen
 *
 * Frequently asked questions and support
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/theme';
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

function FAQCard({ item }: { item: FAQItem }) {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Pressable
      style={[styles.faqCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => setIsExpanded(!isExpanded)}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>
          {item.question}
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.neutral[400]}
        />
      </View>
      {isExpanded && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
            {item.answer}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

export default function HelpScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Help & FAQ
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Get Help
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Pressable style={styles.navItem}>
              <View style={styles.navItemLeft}>
                <Ionicons name="chatbubble-outline" size={22} color={colors.primary.gold} />
                <Text style={[styles.navItemLabel, { color: theme.colors.text }]}>
                  Contact Support
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
            </Pressable>
            <Pressable style={styles.navItem}>
              <View style={styles.navItemLeft}>
                <Ionicons name="bug-outline" size={22} color={theme.colors.icon} />
                <Text style={[styles.navItemLabel, { color: theme.colors.text }]}>
                  Report a Bug
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
            </Pressable>
            <Pressable style={styles.navItem}>
              <View style={styles.navItemLeft}>
                <Ionicons name="bulb-outline" size={22} color={theme.colors.icon} />
                <Text style={[styles.navItemLabel, { color: theme.colors.text }]}>
                  Suggest a Feature
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
            </Pressable>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Frequently Asked Questions
          </Text>
          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item) => (
              <FAQCard key={item.id} item={item} />
            ))}
          </View>
        </View>

        {/* Community */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Community
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Pressable style={styles.navItem}>
              <View style={styles.navItemLeft}>
                <Ionicons name="book-outline" size={22} color={theme.colors.icon} />
                <Text style={[styles.navItemLabel, { color: theme.colors.text }]}>
                  Dating Tips Blog
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
            </Pressable>
            <Pressable style={styles.navItem}>
              <View style={styles.navItemLeft}>
                <Ionicons name="heart-outline" size={22} color={colors.semantic.error} />
                <Text style={[styles.navItemLabel, { color: theme.colors.text }]}>
                  Success Stories
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
            </Pressable>
          </View>
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
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    marginLeft: spacing[4],
  },
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  navItemLabel: {
    fontSize: 16,
  },
  faqList: {
    gap: spacing[2],
  },
  faqCard: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing[2],
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing[3],
  },
});
