/**
 * Shidduch Profile Screen
 *
 * View and manage your shidduch resume
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';

// Mock profile data
const MOCK_PROFILE = {
  firstName: 'David',
  lastName: 'Cohen',
  hebrewName: 'Dovid ben Avraham',
  age: 25,
  community: 'Modern Orthodox',
  city: 'Brooklyn, NY',
  isVerified: true,
  photoUrl: null,
  photos: [],
  profileComplete: 85,
  acceptingSuggestions: true,
  photosVisibleTo: 'shadchan_only',
  profileVisible: true,
  stats: {
    suggestionsReceived: 12,
    mutualInterests: 3,
    connectedShadchanim: 2,
    daysActive: 45,
  },
};

const PROFILE_SECTIONS = [
  { id: 'basics', label: 'Personal Details', icon: 'person-outline', complete: true },
  { id: 'family', label: 'Family Background', icon: 'people-outline', complete: true },
  { id: 'education', label: 'Education & Career', icon: 'school-outline', complete: true },
  { id: 'hashkafa', label: 'Religious Outlook', icon: 'book-outline', complete: true },
  { id: 'looking-for', label: "What You're Looking For", icon: 'heart-outline', complete: true },
  { id: 'references', label: 'References', icon: 'call-outline', complete: false },
  { id: 'photos', label: 'Photos', icon: 'camera-outline', complete: false },
];

const SETTINGS_OPTIONS = [
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'notifications-outline',
    description: 'New suggestions, messages',
  },
  {
    id: 'shabbat',
    label: 'Shabbat Mode',
    icon: 'moon-outline',
    description: 'Auto-pause during Shabbat',
  },
  {
    id: 'privacy',
    label: 'Privacy Settings',
    icon: 'lock-closed-outline',
    description: 'Control who sees what',
  },
  {
    id: 'help',
    label: 'Help & Support',
    icon: 'help-circle-outline',
    description: 'FAQs, contact support',
  },
];

export default function ShidduchProfileScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(MOCK_PROFILE);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const toggleAcceptingSuggestions = () => {
    setProfile((prev) => ({
      ...prev,
      acceptingSuggestions: !prev.acceptingSuggestions,
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => router.replace('/(auth)/welcome'),
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={['#0a1628', '#1a2744', '#0a1628']}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d4af37"
          />
        }
      >
        {/* Profile Header */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.profileHeader}>
          <View style={styles.avatarSection}>
            {profile.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#d4af37" />
              </View>
            )}
            <Pressable style={styles.editAvatarButton}>
              <Ionicons name="camera" size={14} color="#0a1628" />
            </Pressable>
            {profile.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
              </View>
            )}
          </View>

          <Text style={styles.hebrewName}>{profile.hebrewName}</Text>
          <Text style={styles.fullName}>
            {profile.firstName} {profile.lastName}, {profile.age}
          </Text>
          <Text style={styles.community}>{profile.community} • {profile.city}</Text>
        </Animated.View>

        {/* Profile Completeness */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.completenessCard}>
          <View style={styles.completenessHeader}>
            <Text style={styles.completenessTitle}>Profile Completeness</Text>
            <Text style={styles.completenessPercent}>{profile.profileComplete}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${profile.profileComplete}%` }]} />
          </View>
          <Text style={styles.completenessHint}>
            Complete your profile to receive better suggestions
          </Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(250)} style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.stats.suggestionsReceived}</Text>
            <Text style={styles.statLabel}>Suggestions</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.stats.mutualInterests}</Text>
            <Text style={styles.statLabel}>Mutual</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.stats.connectedShadchanim}</Text>
            <Text style={styles.statLabel}>Shadchanim</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.stats.daysActive}</Text>
            <Text style={styles.statLabel}>Days Active</Text>
          </View>
        </Animated.View>

        {/* Accepting Suggestions Toggle */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <Ionicons name="heart" size={22} color="#d4af37" />
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Accepting Suggestions</Text>
              <Text style={styles.toggleDesc}>
                {profile.acceptingSuggestions
                  ? 'Shadchanim can suggest matches to you'
                  : 'You won\'t receive new suggestions'}
              </Text>
            </View>
          </View>
          <Switch
            value={profile.acceptingSuggestions}
            onValueChange={toggleAcceptingSuggestions}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
            thumbColor={profile.acceptingSuggestions ? '#d4af37' : '#666'}
          />
        </Animated.View>

        {/* Profile Sections */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.sectionsContainer}>
          <Text style={styles.sectionHeader}>Your Shidduch Resume</Text>
          {PROFILE_SECTIONS.map((section, index) => (
            <Pressable
              key={section.id}
              style={styles.sectionItem}
              onPress={() => router.push(`/(shidduch-onboarding)/${section.id}`)}
            >
              <View style={styles.sectionLeft}>
                <View style={[
                  styles.sectionIcon,
                  section.complete && styles.sectionIconComplete,
                ]}>
                  <Ionicons
                    name={section.icon as any}
                    size={18}
                    color={section.complete ? '#d4af37' : 'rgba(255,255,255,0.4)'}
                  />
                </View>
                <Text style={styles.sectionLabel}>{section.label}</Text>
              </View>
              <View style={styles.sectionRight}>
                {section.complete ? (
                  <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
                ) : (
                  <View style={styles.incompleteBadge}>
                    <Text style={styles.incompleteText}>Incomplete</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </View>
            </Pressable>
          ))}
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.sectionsContainer}>
          <Text style={styles.sectionHeader}>Settings</Text>
          {SETTINGS_OPTIONS.map((option, index) => (
            <Pressable key={option.id} style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name={option.icon as any} size={20} color="#d4af37" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{option.label}</Text>
                <Text style={styles.settingDesc}>{option.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </Pressable>
          ))}
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInDown.delay(600)} style={styles.logoutSection}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff6b6b" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarSection: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#d4af37',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0a1628',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#0a1628',
    borderRadius: 12,
    padding: 2,
  },
  hebrewName: {
    fontSize: 22,
    color: '#d4af37',
    marginBottom: 4,
  },
  fullName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  community: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  completenessCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  completenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  completenessTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  completenessPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d4af37',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#d4af37',
    borderRadius: 3,
  },
  completenessHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#d4af37',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  sectionsContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionIconComplete: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  incompleteBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  incompleteText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f59e0b',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  logoutSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 16,
  },
});
