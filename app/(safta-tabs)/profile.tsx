/**
 * Safta Profile Tab
 *
 * Manage Safta account - mirrors regular profile.tsx but for Saftas
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/api/supabase/client';
import { useDeactivateAccount } from '@/api/mutations/useProfile';

// Type for connected users (followers)
interface ConnectedUser {
  id: string;
  first_name: string;
  photo_url: string | null;
  age: number;
  connected_at: string;
}

// Safta mode uses gold accent (matching user mode)
const SAFTA_ACCENT = colors.primary.gold;

// FileSystem encoding type
const Base64Encoding = 'base64' as const;

function SettingsItem({
  icon,
  label,
  onPress,
  showArrow = true,
  rightElement,
  danger = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
  danger?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemLeft}>
        <Ionicons
          name={icon as any}
          size={22}
          color={danger ? colors.semantic.error : SAFTA_ACCENT}
        />
        <Text style={[styles.settingsItemLabel, { color: danger ? colors.semantic.error : theme.colors.text }]}>
          {label}
        </Text>
      </View>
      {rightElement || (showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
      ))}
    </Pressable>
  );
}

export default function SaftaProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);
  const logout = useAuthStore((s) => s.logout);
  const hasUserProfile = useAuthStore((s) => s.isOnboardingComplete);

  // Account deletion mutation
  const deleteAccountMutation = useDeactivateAccount();

  // Get Safta profile from user metadata
  const saftaName = session?.user?.user_metadata?.safta_name || 'Safta';
  const saftaRelationship = session?.user?.user_metadata?.safta_relationship || 'grandmother';
  const saftaPhoto = session?.user?.user_metadata?.safta_photo || null;

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Edit profile state
  const [editName, setEditName] = useState(saftaName);
  const [editRelationship, setEditRelationship] = useState(saftaRelationship);
  const [editPhoto, setEditPhoto] = useState<string | null>(saftaPhoto);
  const [isUploading, setIsUploading] = useState(false);

  // Notification preferences
  const [notifyNewMatches, setNotifyNewMatches] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyRecommendations, setNotifyRecommendations] = useState(true);

  // Connected users (followers) - used for follower count
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);

  // Fetch connected users count
  useEffect(() => {
    async function fetchConnectedUsers() {
      if (!session?.user?.id) return;

      try {
        // Query safta_connections table to get connected users
        const { data, error } = await supabase
          .from('safta_connections')
          .select(`
            id,
            created_at,
            user:users!safta_connections_user_id_fkey (
              id,
              first_name,
              date_of_birth,
              user_photos (
                photo_url,
                photo_order
              )
            )
          `)
          .eq('safta_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) {
          // Table might not exist yet - that's okay
          console.log('No safta_connections data:', error.message);
          setConnectedUsers([]);
          return;
        }

        // Transform data to ConnectedUser format
        const users: ConnectedUser[] = (data || []).map((conn: any) => {
          const user = conn.user;
          const primaryPhoto = user?.user_photos?.find((p: any) => p.photo_order === 0)?.photo_url ||
                               user?.user_photos?.[0]?.photo_url || null;

          // Calculate age
          let age = 0;
          if (user?.date_of_birth) {
            const today = new Date();
            const birthDate = new Date(user.date_of_birth);
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          }

          return {
            id: user?.id || conn.id,
            first_name: user?.first_name || 'User',
            photo_url: primaryPhoto,
            age,
            connected_at: conn.created_at,
          };
        });

        setConnectedUsers(users);
      } catch (err) {
        console.error('Error fetching connected users:', err);
      }
    }

    fetchConnectedUsers();
  }, [session?.user?.id]);

  const getRelationshipLabel = (id: string) => {
    const relationships: Record<string, string> = {
      mother: 'Mother',
      father: 'Father',
      grandmother: 'Grandmother',
      grandfather: 'Grandfather',
      aunt: 'Aunt',
      uncle: 'Uncle',
      other: 'Other',
    };
    return relationships[id] || id;
  };

  const handlePickPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Show options: camera or gallery
    Alert.alert(
      'Add Profile Photo',
      'Choose how to add your photo',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setEditPhoto(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Please allow access to your photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setEditPhoto(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRemovePhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setEditPhoto(null),
        },
      ]
    );
  };

  const handleSwitchToUserMode = () => {
    console.log('[Safta Profile] Switching to user mode, onboarding complete:', isOnboardingComplete);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMode('user');

    // Navigate directly based on onboarding state (like handleSwitchToSaftaMode does)
    if (isOnboardingComplete) {
      console.log('[Safta Profile] Navigating to tabs');
      router.replace('/(tabs)');
    } else {
      console.log('[Safta Profile] Navigating to onboarding');
      router.replace('/(onboarding)/welcome');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await supabase.auth.signOut();
            logout();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    const message = hasUserProfile
      ? 'This will permanently delete BOTH your Safta account AND your dating profile. All your data, matches, messages, and photos will be removed. This action cannot be undone.'
      : 'This will permanently delete your Safta account. All your data and connections will be removed. This action cannot be undone.';

    Alert.alert('Delete Account', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Everything',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteAccountMutation.mutate(true, {
            onSuccess: () => {
              router.replace('/(auth)/welcome');
            },
            onError: (error) => {
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again or contact support.',
                [{ text: 'OK' }]
              );
              console.error('Delete account error:', error);
            },
          });
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    setIsUploading(true);

    try {
      let photoUrl = editPhoto;

      // Upload photo to storage if it's a local file
      if (editPhoto && !editPhoto.startsWith('http') && session?.user?.id) {
        try {
          console.log('[Safta Profile] Uploading photo...');

          // Read file as base64
          const base64 = await FileSystem.readAsStringAsync(editPhoto, {
            encoding: Base64Encoding,
          });

          // Generate unique filename
          const fileExt = editPhoto.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `safta-photos/${session.user.id}/${Date.now()}.${fileExt}`;

          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, decode(base64), {
              contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
              upsert: true,
            });

          if (uploadError) {
            console.error('[Safta Profile] Photo upload error:', uploadError);
            // Continue without photo update
          } else {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('profile-photos')
              .getPublicUrl(fileName);

            if (urlData?.publicUrl) {
              photoUrl = urlData.publicUrl;
              console.log('[Safta Profile] Photo uploaded:', photoUrl);
            }
          }
        } catch (uploadErr) {
          console.error('[Safta Profile] Error uploading photo:', uploadErr);
          // Continue with profile save without photo
        }
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          safta_name: editName,
          safta_relationship: editRelationship,
          safta_photo: photoUrl,
        },
      });

      if (error) {
        Alert.alert('Error', 'Failed to save profile. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowEditModal(false);
        Alert.alert('Success', 'Your profile has been updated!');
      }
    } catch (err) {
      console.error('[Safta Profile] Error saving profile:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveNotifications = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowNotificationsModal(false);
    Alert.alert('Success', 'Notification preferences saved!');
  };

  const handlePremiumPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Safta Premium',
      'Unlock unlimited recommendations, advanced filters, and priority support!\n\nComing soon - stay tuned!',
      [{ text: 'OK' }]
    );
  };

  const handleHelpPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Help & Support',
      'How can we help you?',
      [
        {
          text: 'FAQs',
          onPress: () => Linking.openURL('https://mazal.app/faq'),
        },
        {
          text: 'Contact Support',
          onPress: () => Linking.openURL('mailto:support@mazal.app?subject=Safta%20Mode%20Support'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const relationships = [
    { id: 'mother', label: 'Mother' },
    { id: 'father', label: 'Father' },
    { id: 'grandmother', label: 'Grandmother' },
    { id: 'grandfather', label: 'Grandfather' },
    { id: 'aunt', label: 'Aunt' },
    { id: 'uncle', label: 'Uncle' },
    { id: 'other', label: 'Other' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.icon} />
        </Pressable>
      </View>

      {/* Profile Preview */}
      <View style={styles.profilePreview}>
        <Pressable onPress={() => setShowEditModal(true)}>
          {saftaPhoto ? (
            <Image source={{ uri: saftaPhoto }} style={styles.mainPhoto} />
          ) : (
            <View style={[styles.mainPhoto, styles.photoPlaceholder]}>
              <Text style={styles.avatarEmoji}>👵</Text>
            </View>
          )}
          <View style={styles.editPhotoOverlay}>
            <Ionicons name="camera" size={16} color={colors.primary.white} />
          </View>
        </Pressable>
        <View style={styles.saftaBadgeOnPhoto}>
          <Text style={styles.saftaBadgeText}>SAFTA</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {saftaName}
          </Text>
          <Text style={[styles.occupation, { color: theme.colors.textSecondary }]}>
            {getRelationshipLabel(saftaRelationship)}
          </Text>
        </View>

        {/* Edit Profile Button */}
        <Pressable
          style={styles.editButton}
          onPress={() => setShowEditModal(true)}
        >
          <Ionicons name="pencil" size={18} color={SAFTA_ACCENT} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          Your Activity
        </Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="sparkles" size={24} color={colors.semantic.success} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              0
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Matches
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="people" size={24} color={SAFTA_ACCENT} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {connectedUsers.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Followers
            </Text>
          </View>
        </View>
      </View>

      {/* Premium Banner */}
      <Pressable
        style={styles.premiumBanner}
        onPress={handlePremiumPress}
      >
        <View style={styles.premiumContent}>
          <Ionicons name="star" size={24} color={SAFTA_ACCENT} />
          <View style={styles.premiumText}>
            <Text style={styles.premiumTitle}>Upgrade to Safta Premium</Text>
            <Text style={styles.premiumSubtitle}>Help more people & advanced filters</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={SAFTA_ACCENT} />
      </Pressable>

      {/* Settings Sections */}
      <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}>
        <SettingsItem
          icon="options-outline"
          label="Browse Preferences"
          onPress={() => setShowPreferencesModal(true)}
        />
        <SettingsItem
          icon="notifications-outline"
          label="Notifications"
          onPress={() => setShowNotificationsModal(true)}
        />
      </View>

      {/* Switch to Dating Mode */}
      <Pressable
        style={styles.saftaModeBanner}
        onPress={handleSwitchToUserMode}
      >
        <View style={styles.saftaModeContent}>
          <View style={styles.saftaModeIconContainer}>
            <Ionicons name="heart" size={22} color={colors.primary.gold} />
          </View>
          <View style={styles.saftaModeText}>
            <Text style={styles.saftaModeTitle}>Switch to Dating Mode</Text>
            <Text style={styles.saftaModeSubtitle}>
              {isOnboardingComplete
                ? 'Browse profiles for yourself'
                : 'Set up your dating profile'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
      </Pressable>

      <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}>
        <SettingsItem
          icon="help-circle-outline"
          label="Help & Support"
          onPress={handleHelpPress}
        />
        <SettingsItem
          icon="document-text-outline"
          label="Terms & Privacy"
          onPress={() => router.push('/legal/terms')}
        />
      </View>

      {/* Account Actions */}
      <View style={styles.accountActions}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Pressable
          style={[styles.deleteButton, deleteAccountMutation.isPending && { opacity: 0.5 }]}
          onPress={deleteAccountMutation.isPending ? undefined : handleDeleteAccount}
          disabled={deleteAccountMutation.isPending}
        >
          {deleteAccountMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.semantic.error} />
          ) : (
            <Text style={styles.deleteText}>Delete Account</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.versionText}>Mazal for Saftas v1.0.0</Text>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Profile</Text>
            <Pressable onPress={handleSaveProfile} disabled={isUploading}>
              <Text style={[styles.modalSave, isUploading && { opacity: 0.5 }]}>
                {isUploading ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Photo Section */}
            <View style={styles.photoEditSection}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Profile Photo
              </Text>
              <View style={styles.photoEditContainer}>
                <Pressable onPress={handlePickPhoto}>
                  {editPhoto ? (
                    <Image source={{ uri: editPhoto }} style={styles.editPhotoImage} />
                  ) : (
                    <View style={[styles.editPhotoImage, styles.editPhotoPlaceholder]}>
                      <Ionicons name="camera" size={32} color={colors.transparent.white50} />
                    </View>
                  )}
                  <View style={styles.editPhotoButton}>
                    <Ionicons name="camera" size={14} color={colors.primary.white} />
                  </View>
                </Pressable>
                <View style={styles.photoActions}>
                  <Pressable style={styles.photoActionButton} onPress={handlePickPhoto}>
                    <Ionicons name="image-outline" size={20} color={SAFTA_ACCENT} />
                    <Text style={styles.photoActionText}>Change Photo</Text>
                  </Pressable>
                  {editPhoto && (
                    <Pressable style={styles.photoActionButton} onPress={handleRemovePhoto}>
                      <Ionicons name="trash-outline" size={20} color={colors.semantic.error} />
                      <Text style={[styles.photoActionText, { color: colors.semantic.error }]}>
                        Remove
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <Text style={[styles.photoHint, { color: theme.colors.textTertiary }]}>
                Adding a photo helps your family recognize you
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
              Display Name
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={colors.transparent.white40}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
              Relationship
            </Text>
            <View style={styles.relationshipOptions}>
              {relationships.map((rel) => (
                <Pressable
                  key={rel.id}
                  style={[
                    styles.relationshipOption,
                    { backgroundColor: theme.colors.surface },
                    editRelationship === rel.id && styles.relationshipOptionActive,
                  ]}
                  onPress={() => setEditRelationship(rel.id)}
                >
                  <Text
                    style={[
                      styles.relationshipOptionText,
                      { color: theme.colors.text },
                      editRelationship === rel.id && styles.relationshipOptionTextActive,
                    ]}
                  >
                    {rel.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Browse Preferences Modal */}
      <Modal
        visible={showPreferencesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreferencesModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowPreferencesModal(false)}>
              <Text style={styles.modalCancel}>Close</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Browse Preferences</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.preferencesInfo, { color: theme.colors.textSecondary }]}>
              Your browse preferences are managed from the Discover tab. Tap the filter icon to customize who you see.
            </Text>

            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={24} color={SAFTA_ACCENT} />
              <View style={styles.tipContent}>
                <Text style={[styles.tipTitle, { color: theme.colors.text }]}>Tip</Text>
                <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
                  You can toggle between using your grandchild's preferences or setting your own custom filters.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.goToDiscoverButton}
              onPress={() => {
                setShowPreferencesModal(false);
                router.push('/(safta-tabs)');
              }}
            >
              <Text style={styles.goToDiscoverButtonText}>Go to Discover</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowNotificationsModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Notifications</Text>
            <Pressable onPress={handleSaveNotifications}>
              <Text style={styles.modalSave}>Save</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={[styles.notificationRow, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.notificationInfo}>
                <Text style={[styles.notificationLabel, { color: theme.colors.text }]}>
                  New Matches
                </Text>
                <Text style={[styles.notificationDesc, { color: theme.colors.textSecondary }]}>
                  When someone you recommended matches
                </Text>
              </View>
              <Switch
                value={notifyNewMatches}
                onValueChange={setNotifyNewMatches}
                trackColor={{ false: colors.neutral[200], true: SAFTA_ACCENT }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={[styles.notificationRow, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.notificationInfo}>
                <Text style={[styles.notificationLabel, { color: theme.colors.text }]}>
                  Messages
                </Text>
                <Text style={[styles.notificationDesc, { color: theme.colors.textSecondary }]}>
                  When you receive new messages
                </Text>
              </View>
              <Switch
                value={notifyMessages}
                onValueChange={setNotifyMessages}
                trackColor={{ false: colors.neutral[200], true: SAFTA_ACCENT }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={[styles.notificationRow, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.notificationInfo}>
                <Text style={[styles.notificationLabel, { color: theme.colors.text }]}>
                  Recommendations
                </Text>
                <Text style={[styles.notificationDesc, { color: theme.colors.textSecondary }]}>
                  Updates on your sent recommendations
                </Text>
              </View>
              <Switch
                value={notifyRecommendations}
                onValueChange={setNotifyRecommendations}
                trackColor={{ false: colors.neutral[200], true: SAFTA_ACCENT }}
                thumbColor={colors.primary.white}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePreview: {
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  mainPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary.gold,
  },
  photoPlaceholder: {
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 56,
  },
  editPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.dark.background,
  },
  saftaBadgeOnPhoto: {
    marginTop: -16,
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  saftaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.navy,
    letterSpacing: 0.5,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: spacing[3],
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  occupation: {
    fontSize: 14,
    marginTop: spacing[1],
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginTop: spacing[4],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    backgroundColor: colors.transparent.gold20,
    borderRadius: borderRadius.full,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  // Stats Section
  statsSection: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: spacing[2],
  },
  statLabel: {
    fontSize: 12,
    marginTop: spacing[0.5],
  },
  // Premium Banner
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  premiumText: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  premiumSubtitle: {
    fontSize: 13,
    color: colors.transparent.white80,
    marginTop: spacing[0.5],
  },
  // Settings
  settingsSection: {
    marginTop: spacing[4],
    marginHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  settingsItemLabel: {
    fontSize: 16,
  },
  // Safta Mode Banner (Switch to Dating)
  saftaModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.transparent.gold30,
  },
  saftaModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  saftaModeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saftaModeText: {
    flex: 1,
  },
  saftaModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  saftaModeSubtitle: {
    fontSize: 12,
    color: colors.transparent.gold70,
    marginTop: spacing[0.5],
  },
  // Account Actions
  accountActions: {
    marginTop: spacing[6],
    marginHorizontal: spacing[4],
    gap: spacing[2],
  },
  logoutButton: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.semantic.error,
  },
  deleteButton: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.semantic.error,
  },
  versionText: {
    fontSize: 12,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    fontSize: 16,
    color: colors.transparent.white70,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  // Photo Edit Section
  photoEditSection: {
    marginBottom: spacing[4],
  },
  photoEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginTop: spacing[2],
  },
  editPhotoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  editPhotoPlaceholder: {
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  photoActions: {
    flex: 1,
    gap: spacing[2],
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  photoActionText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary.gold,
  },
  photoHint: {
    fontSize: 13,
    marginTop: spacing[2],
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  textInput: {
    fontSize: 16,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },
  relationshipOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  relationshipOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  relationshipOptionActive: {
    borderColor: colors.primary.gold,
    backgroundColor: colors.transparent.gold10,
  },
  relationshipOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  relationshipOptionTextActive: {
    color: colors.primary.gold,
  },
  // Preferences Modal
  preferencesInfo: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing[4],
  },
  tipCard: {
    flexDirection: 'row',
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  goToDiscoverButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  goToDiscoverButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  // Notifications Modal
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
  },
  notificationInfo: {
    flex: 1,
    marginRight: spacing[4],
  },
  notificationLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  notificationDesc: {
    fontSize: 13,
    marginTop: spacing[0.5],
  },
});
