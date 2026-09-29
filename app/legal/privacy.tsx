/**
 * Privacy Policy Screen
 */

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const PRIVACY_CONTENT = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly:

• Account Information: Name, email, phone number, date of birth, gender
• Profile Information: Photos, bio, Jewish background, education, occupation
• Preferences: Dating preferences, location, search filters
• Communications: Messages with matches, support requests
• Payment Information: Processed securely by app stores (we don't store card details)

We also collect information automatically:

• Device Information: Device type, operating system, unique identifiers
• Usage Data: Features used, time spent, interactions
• Location: With your permission, to show nearby users`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use your information to:

• Create and manage your account
• Match you with compatible users
• Personalize your experience
• Process payments for premium features
• Send important updates and notifications
• Improve our services and develop new features
• Ensure safety and prevent fraud
• Comply with legal obligations

We will never sell your personal data to third parties.`,
  },
  {
    title: '3. Information Sharing',
    content: `We share information only in these circumstances:

• With Other Users: Your profile information is visible to potential matches
• Service Providers: Companies that help us operate (hosting, analytics, payment processing)
• Legal Requirements: When required by law or to protect rights and safety
• Business Transfers: In connection with a merger, acquisition, or sale

Our service providers are bound by confidentiality agreements and can only use data to provide services to us.`,
  },
  {
    title: '4. Your Privacy Controls',
    content: `You have control over your information:

• Profile Visibility: Hide your profile from discovery
• Location Sharing: Control when and how your location is used
• Notifications: Manage email and push notification preferences
• Data Access: Request a copy of your personal data
• Deletion: Delete your account and associated data. If another user reported you, we keep a limited safety record afterwards — see Section 6
• Corrections: Update your profile information anytime

Access these controls in Settings > Privacy & Safety.`,
  },
  {
    title: '5. Data Security',
    content: `We implement security measures including:

• Encryption of data in transit and at rest
• Regular security audits and testing
• Access controls and employee training
• Secure cloud infrastructure
• Two-factor authentication options

While we strive to protect your data, no system is 100% secure. Report any security concerns to security@mazal.app.`,
  },
  {
    title: '6. Data Retention',
    content: `We retain your data for as long as your account is active. After you delete your account:

• Profile data — your photos, bio, preferences, matches and messages — is deleted within 30 days
• Backup copies are removed within 90 days
• Anonymized/aggregated data may be kept for analytics
• Limited safety records may be kept for longer, as described below
• Some data may be kept longer where the law requires it

Safety records kept after deletion

Deleting your account does not erase a complaint another user made about you. If someone reported your account, we keep a small safety record after the rest of your data is gone. We keep it to protect other users: without it, anyone could delete their account to wipe a report against them and sign up again a minute later.

That record holds only:

• A one-way, salted hash of your email address and phone number. It is not your email or phone number and cannot be turned back into them. We cannot read it, contact you with it, or pass it to anyone else. It only lets us recognize the same address if it is used to sign up again.
• Your display name, when your account was created, when it was deleted, and how many reports were made
• The reports themselves and how they were resolved

How long we keep it:

• 12 months, if every report about you was reviewed and dismissed
• 24 months, if a report led us to take action on your account
• Longer only while a report about you is still under review, or while it is needed for an ongoing safety investigation or legal matter

After that, the record and the reports attached to it are deleted automatically. If nobody ever reported your account, no safety record is created and nothing about you is kept.

Reports that you filed about other users are also kept after you delete your account. They are part of the safety history of the person you reported, and are not ours to erase on your behalf. Once your account is gone they are no longer linked to a profile, but the report and its outcome remain.

If a report led us to take action on your account, we may use this record to prevent the same email address from being used to create a new account while the record is kept.

Requesting earlier deletion

You can ask us to delete your data sooner by contacting privacy@mazal.app. We will do that for everything above, with one exception: a safety record that is still within the period described here. That record exists to protect other people, so we cannot remove it on request. If this applies to you, we will tell you.`,
  },
  {
    title: '7. Children\'s Privacy',
    content: `Mazal is not intended for users under 18 years of age. We do not knowingly collect information from minors. If you believe a minor has created an account, please contact us immediately at privacy@mazal.app.`,
  },
  {
    title: '8. International Data Transfers',
    content: `Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including:

• Standard contractual clauses
• Compliance with applicable data protection laws
• Selection of reputable service providers`,
  },
  {
    title: '9. Third-Party Links',
    content: `Our app may contain links to third-party websites or services. We are not responsible for their privacy practices. Please review their privacy policies before providing any information.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy periodically. We will notify you of significant changes through:

• In-app notifications
• Email to your registered address
• Updated "Last modified" date

Continued use of Mazal after changes indicates acceptance of the updated policy.`,
  },
  {
    title: '11. Contact Us',
    content: `For privacy-related questions or requests:

Email: privacy@mazal.app
Data Protection Officer: dpo@mazal.app

Address:
Mazal Inc.
Attn: Privacy Team
New York, NY

We aim to respond to all requests within 30 days.`,
  },
];

export default function PrivacyScreen() {
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
          Privacy Policy
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: theme.colors.textTertiary }]}>
          Last updated: September 2026
        </Text>

        <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
          At Mazal, we take your privacy seriously. This policy explains how we collect,
          use, and protect your personal information when you use our Jewish dating app.
        </Text>

        {PRIVACY_CONTENT.map((section, index) => (
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
