/**
 * Shidduch Profile Screen
 *
 * View and manage your shidduch resume
 */

import { useState, useCallback, useEffect } from 'react';
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
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

interface ProfileData {
  firstName: string;
  lastName: string;
  hebrewName: string | null;
  age: number | null;
  community: string;
  city: string;
  isVerified: boolean;
  photoUrl: string | null;
  acceptingSuggestions: boolean;
  profileVisible: boolean;
}

const PROFILE_SECTIONS = [
  { id: 'basics', label: 'Personal Details', icon: 'person-outline' },
  { id: 'family', label: 'Family Background', icon: 'people-outline' },
  { id: 'education', label: 'Education & Career', icon: 'school-outline' },
  { id: 'hashkafa', label: 'Religious Outlook', icon: 'book-outline' },
  { id: 'looking-for', label: "What You're Looking For", icon: 'heart-outline' },
  { id: 'references', label: 'References', icon: 'call-outline' },
  { id: 'photos', label: 'Photos', icon: 'camera-outline' },
];

const COMMUNITY_LABELS: Record<string, string> = {
  modern_orthodox: 'Modern Orthodox',
  modern_orthodox_machmir: 'Modern Orthodox Machmir',
  yeshivish: 'Yeshivish',
  chassidish: 'Chassidish',
  sephardi: 'Sephardi',
  chabad: 'Chabad',
  carlebachian: 'Carlebachian',
  other: 'Other',
};

const SETTINGS_OPTIONS = [
  { id: 'notifications', label: 'Notifications', description: 'Manage push notifications', icon: 'notifications-outline' },
  { id: 'shabbat', label: 'Shabbat Mode', description: 'Auto-pause during Shabbat', icon: 'moon-outline' },
  { id: 'privacy', label: 'Privacy', description: 'Control who sees your profile', icon: 'shield-outline' },
  { id: 'help', label: 'Help & Support', description: 'Get help or report an issue', icon: 'help-circle-outline' },
];

export default function ShidduchProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuthStore();
  const { setOrthodoxMode } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showShabbatModal, setShowShabbatModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [newMatchNotif, setNewMatchNotif] = useState(true);
  const [messageNotif, setMessageNotif] = useState(true);
  const [shabbatModeEnabled, setShabbatModeEnabled] = useState(false);
  const [autoShabbatMode, setAutoShabbatMode] = useState(true);

  const loadProfile = async () => {
    if (!session?.user?.id) return;

    try {
      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name, date_of_birth, current_city, current_state')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) {
        setLoading(false);
        return;
      }

      // Get shidduch profile
      const { data: shidduchProfile } = await supabase
        .from('shidduch_profiles')
        .select('*')
        .eq('user_id', userData.id)
        .single();

      // Get user's primary photo
      const { data: photoData } = await supabase
        .from('user_photos')
        .select('photo_url')
        .eq('user_id', userData.id)
        .eq('is_primary', true)
        .single();

      // If no primary, get first photo
      let photoUrl = photoData?.photo_url || null;
      if (!photoUrl) {
        const { data: anyPhoto } = await supabase
          .from('user_photos')
          .select('photo_url')
          .eq('user_id', userData.id)
          .order('display_order', { ascending: true })
          .limit(1)
          .single();
        photoUrl = anyPhoto?.photo_url || null;
      }

      if (shidduchProfile) {
        const age = userData.date_of_birth
          ? Math.floor((Date.now() - new Date(userData.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null;

        setProfile({
          firstName: userData.first_name || '',
          lastName: userData.last_name || '',
          hebrewName: shidduchProfile.hebrew_name,
          age,
          community: COMMUNITY_LABELS[shidduchProfile.community] || shidduchProfile.community || 'Not specified',
          city: [userData.current_city, userData.current_state].filter(Boolean).join(', ') || 'Not specified',
          isVerified: shidduchProfile.is_verified || false,
          photoUrl,
          acceptingSuggestions: shidduchProfile.accepting_suggestions || false,
          profileVisible: shidduchProfile.profile_visible || false,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [session?.user?.id])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
  }, []);

  const toggleAcceptingSuggestions = async () => {
    if (!profile) return;
    const newValue = !profile.acceptingSuggestions;
    setProfile((prev) => prev ? { ...prev, acceptingSuggestions: newValue } : null);

    // Update in database
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session?.user?.id)
      .single();

    if (userData) {
      await supabase
        .from('shidduch_profiles')
        .update({ accepting_suggestions: newValue })
        .eq('user_id', userData.id);
    }
  };

  const handleSettingPress = (settingId: string) => {
    switch (settingId) {
      case 'notifications':
        setShowNotificationsModal(true);
        break;
      case 'shabbat':
        setShowShabbatModal(true);
        break;
      case 'privacy':
        setShowPrivacyModal(true);
        break;
      case 'help':
        setShowHelpModal(true);
        break;
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@mazalapp.com?subject=Mazal App Support');
  };

  const handleVisitFAQ = () => {
    Linking.openURL('https://mazalapp.com/faq');
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
          onPress: async () => {
            setOrthodoxMode(false);
            await signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0a1628', '#1a2744', '#0a1628']} style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color="#d4af37" />
        </View>
      </LinearGradient>
    );
  }

  // No profile state - show empty state
  if (!profile) {
    return (
      <LinearGradient colors={['#0a1628', '#1a2744', '#0a1628']} style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Empty State */}
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="person-outline" size={48} color="#d4af37" />
            </View>
            <Text style={styles.emptyTitle}>No Profile Yet</Text>
            <Text style={styles.emptyText}>
              Create your shidduch profile to start receiving match suggestions
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push('/(shidduch-onboarding)/welcome')}
            >
              <Text style={styles.emptyButtonText}>Create Profile</Text>
            </Pressable>
          </View>

          {/* Settings still available */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.sectionsContainer}>
            <Text style={styles.sectionHeader}>Settings</Text>
            {SETTINGS_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={styles.settingItem}
                onPress={() => handleSettingPress(option.id)}
              >
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
          <Animated.View entering={FadeInDown.delay(300)} style={styles.logoutSection}>
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

          {profile.hebrewName && <Text style={styles.hebrewName}>{profile.hebrewName}</Text>}
          <Text style={styles.fullName}>
            {profile.firstName} {profile.lastName}{profile.age ? `, ${profile.age}` : ''}
          </Text>
          <Text style={styles.community}>{profile.community} • {profile.city}</Text>
        </Animated.View>

        {/* Accepting Suggestions Toggle */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.toggleCard}>
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
        <Animated.View entering={FadeInDown.delay(300)} style={styles.sectionsContainer}>
          <Text style={styles.sectionHeader}>Your Shidduch Resume</Text>
          {PROFILE_SECTIONS.map((section) => (
            <Pressable
              key={section.id}
              style={styles.sectionItem}
              onPress={() => router.push(`/(shidduch-onboarding)/${section.id}` as any)}
            >
              <View style={styles.sectionLeft}>
                <View style={styles.sectionIcon}>
                  <Ionicons
                    name={section.icon as any}
                    size={18}
                    color="#d4af37"
                  />
                </View>
                <Text style={styles.sectionLabel}>{section.label}</Text>
              </View>
              <View style={styles.sectionRight}>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </View>
            </Pressable>
          ))}
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.sectionsContainer}>
          <Text style={styles.sectionHeader}>Settings</Text>
          {SETTINGS_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={styles.settingItem}
              onPress={() => handleSettingPress(option.id)}
            >
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
        <Animated.View entering={FadeInDown.delay(500)} style={styles.logoutSection}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff6b6b" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </Animated.View>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal visible={showNotificationsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <Pressable onPress={() => setShowNotificationsModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <Text style={styles.settingRowLabel}>Push Notifications</Text>
                <Text style={styles.settingRowDesc}>Enable all notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                thumbColor={notificationsEnabled ? '#d4af37' : '#666'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <Text style={styles.settingRowLabel}>New Match Alerts</Text>
                <Text style={styles.settingRowDesc}>Get notified of new suggestions</Text>
              </View>
              <Switch
                value={newMatchNotif}
                onValueChange={setNewMatchNotif}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                thumbColor={newMatchNotif ? '#d4af37' : '#666'}
                disabled={!notificationsEnabled}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <Text style={styles.settingRowLabel}>Message Alerts</Text>
                <Text style={styles.settingRowDesc}>Get notified of new messages</Text>
              </View>
              <Switch
                value={messageNotif}
                onValueChange={setMessageNotif}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                thumbColor={messageNotif ? '#d4af37' : '#666'}
                disabled={!notificationsEnabled}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Shabbat Mode Modal */}
      <Modal visible={showShabbatModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Shabbat Mode</Text>
              <Pressable onPress={() => setShowShabbatModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.shabbatInfo}>
              <Ionicons name="moon-outline" size={32} color="#d4af37" />
              <Text style={styles.shabbatInfoText}>
                Shabbat Mode pauses the app during Shabbat and Yom Tov. No notifications will be sent and the app will display a peaceful screen.
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <Text style={styles.settingRowLabel}>Enable Shabbat Mode</Text>
                <Text style={styles.settingRowDesc}>Manually turn on now</Text>
              </View>
              <Switch
                value={shabbatModeEnabled}
                onValueChange={setShabbatModeEnabled}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                thumbColor={shabbatModeEnabled ? '#d4af37' : '#666'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <Text style={styles.settingRowLabel}>Auto Shabbat Mode</Text>
                <Text style={styles.settingRowDesc}>Automatically enable based on zmanim</Text>
              </View>
              <Switch
                value={autoShabbatMode}
                onValueChange={setAutoShabbatMode}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                thumbColor={autoShabbatMode ? '#d4af37' : '#666'}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy</Text>
              <Pressable onPress={() => setShowPrivacyModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <Text style={styles.settingRowLabel}>Profile Visible</Text>
                <Text style={styles.settingRowDesc}>Allow others to see your profile</Text>
              </View>
              <Switch
                value={profile?.profileVisible || false}
                onValueChange={(value) => {
                  if (profile) {
                    setProfile({ ...profile, profileVisible: value });
                  }
                }}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212, 175, 55, 0.5)' }}
                thumbColor={profile?.profileVisible ? '#d4af37' : '#666'}
              />
            </View>

            <Pressable style={styles.privacyLink}>
              <Text style={styles.privacyLinkText}>View Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color="#d4af37" />
            </Pressable>

            <Pressable style={styles.privacyLink}>
              <Text style={styles.privacyLinkText}>View Terms of Service</Text>
              <Ionicons name="chevron-forward" size={18} color="#d4af37" />
            </Pressable>

            <Pressable style={styles.deleteAccountButton}>
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal visible={showHelpModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <Pressable onPress={() => setShowHelpModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <Pressable style={styles.helpItem} onPress={handleContactSupport}>
              <View style={styles.helpItemIcon}>
                <Ionicons name="mail-outline" size={22} color="#d4af37" />
              </View>
              <View style={styles.helpItemInfo}>
                <Text style={styles.helpItemLabel}>Contact Support</Text>
                <Text style={styles.helpItemDesc}>support@mazalapp.com</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </Pressable>

            <Pressable style={styles.helpItem} onPress={handleVisitFAQ}>
              <View style={styles.helpItemIcon}>
                <Ionicons name="help-circle-outline" size={22} color="#d4af37" />
              </View>
              <View style={styles.helpItemInfo}>
                <Text style={styles.helpItemLabel}>FAQ</Text>
                <Text style={styles.helpItemDesc}>Frequently asked questions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </Pressable>

            <Pressable style={styles.helpItem}>
              <View style={styles.helpItemIcon}>
                <Ionicons name="chatbubble-outline" size={22} color="#d4af37" />
              </View>
              <View style={styles.helpItemInfo}>
                <Text style={styles.helpItemLabel}>Report a Problem</Text>
                <Text style={styles.helpItemDesc}>Let us know about issues</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </Pressable>

            <View style={styles.appVersion}>
              <Text style={styles.appVersionText}>Mazal App v1.0.0</Text>
              <Text style={styles.appVersionSubtext}>Made with ❤️ for the Jewish community</Text>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a1628',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a2744',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  settingRowInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingRowDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  shabbatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 16,
  },
  shabbatInfoText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  privacyLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  privacyLinkText: {
    fontSize: 16,
    color: '#d4af37',
  },
  deleteAccountButton: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b6b',
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  helpItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  helpItemInfo: {
    flex: 1,
  },
  helpItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  helpItemDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  appVersion: {
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  appVersionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  appVersionSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
});
