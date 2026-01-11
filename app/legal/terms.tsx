/**
 * Terms of Service Screen
 */

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const TERMS_CONTENT = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using the Mazal dating application ("App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.

Mazal is intended for users who are 18 years of age or older. By using the App, you represent that you are at least 18 years old and have the legal capacity to enter into these Terms.`,
  },
  {
    title: '2. User Accounts',
    content: `To use Mazal, you must create an account with accurate and complete information. You are responsible for:

• Maintaining the confidentiality of your account credentials
• All activities that occur under your account
• Notifying us immediately of any unauthorized use
• Ensuring your profile information is truthful and up-to-date

We reserve the right to suspend or terminate accounts that violate these terms.`,
  },
  {
    title: '3. User Conduct',
    content: `You agree not to:

• Post false, misleading, or deceptive information
• Harass, abuse, or threaten other users
• Use the App for any illegal purpose
• Impersonate any person or entity
• Collect user information without consent
• Post inappropriate, offensive, or explicit content
• Use automated systems or bots
• Attempt to gain unauthorized access to the App

We take violations seriously and may report illegal activity to authorities.`,
  },
  {
    title: '4. Privacy and Data',
    content: `Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy. By using Mazal, you consent to our data practices as described in the Privacy Policy.

We use industry-standard security measures to protect your data, but no method of transmission over the Internet is 100% secure.`,
  },
  {
    title: '5. Premium Features',
    content: `Mazal offers premium subscription features ("Mazal Gold"). Subscriptions are billed through your app store account.

• Subscriptions auto-renew unless cancelled 24 hours before the renewal date
• No refunds for partial subscription periods
• Prices may change with reasonable notice
• Premium features are subject to availability`,
  },
  {
    title: '6. Content Ownership',
    content: `You retain ownership of content you post on Mazal. However, by posting content, you grant us a non-exclusive, royalty-free license to use, display, and distribute that content within the App.

We do not claim ownership of your photos or personal information. You can delete your content at any time by removing it from your profile or deleting your account.`,
  },
  {
    title: '7. Disclaimers',
    content: `Mazal is provided "as is" without warranties of any kind. We do not guarantee:

• The accuracy of user profiles
• Compatibility between matched users
• Uninterrupted or error-free service
• The safety of in-person meetings

Always exercise caution when meeting people from the App in person.`,
  },
  {
    title: '8. Limitation of Liability',
    content: `To the maximum extent permitted by law, Mazal shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App.

Our total liability for any claims shall not exceed the amount you paid us in the 12 months preceding the claim.`,
  },
  {
    title: '9. Changes to Terms',
    content: `We may update these Terms from time to time. We will notify you of significant changes through the App or via email. Continued use of the App after changes constitutes acceptance of the new Terms.`,
  },
  {
    title: '10. Contact Us',
    content: `If you have questions about these Terms, please contact us at:

Email: legal@mazal.app
Address: Mazal Inc., New York, NY`,
  },
];

export default function TermsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
      <View style={[styles.header, { borderBottomColor: colors.neutral[100] }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Terms of Service
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: theme.colors.textTertiary }]}>
          Last updated: January 2025
        </Text>

        <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
          Welcome to Mazal, the Jewish dating app designed to help you find meaningful connections.
          Please read these terms carefully before using our service.
        </Text>

        {TERMS_CONTENT.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionContent, { color: theme.colors.textSecondary }]}>
              {section.content}
            </Text>
          </View>
        ))}
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
    height: 56,
    borderBottomWidth: 1,
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
  lastUpdated: {
    fontSize: 12,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 21,
  },
});
