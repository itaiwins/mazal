/**
 * Safta Profile Tab
 *
 * Premium Safta profile with dark theme design
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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { useSaftaPremiumStore } from '@/stores/saftaPremiumStore';
import { supabase } from '@/api/supabase/client';
import { fetchPrimaryPhotoUrls } from '@/api/queries/primaryPhotos';
import { useDeactivateAccount } from '@/api/mutations/useProfile';

interface ConnectedUser {
  id: string;
  first_name: string;
  photo_url: string | null;
  age: number;
  connected_at: string;
}

const Base64Encoding = 'base64' as const;

function SettingsItem({
  icon,
  label,
  onPress,
  showArrow = true,
  rightElement,
  danger = false,
  index = 0,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
  danger?: boolean;
  index?: number;
}) {
  return (
    <Animated.View entering={FadeInRight.delay(index * 30).springify()}>
      <Pressable
        style={({ pressed }) => [styles.settingsItem, pressed && styles.settingsItemPressed]}
        onPress={onPress}
      >
        <View style={styles.settingsItemLeft}>
          <View style={[styles.settingIconContainer, danger && styles.settingIconDanger]}>
            <Ionicons
              name={icon as any}
              size={20}
              color={danger ? colors.semantic.error : colors.primary.gold}
            />
          </View>
          <Text style={[styles.settingsItemLabel, danger && styles.settingsItemLabelDanger]}>
            {label}
          </Text>
        </View>
        {rightElement || (showArrow && (
          <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
        ))}
      </Pressable>
    </Animated.View>
  );
}

export default function SaftaProfileScreen() {
  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const isOnboardingComplete = useAuthStore((s) => s.isOnboardingComplete);
  const setCurrentMode = useAuthStore((s) => s.setCurrentMode);
  const logout = useAuthStore((s) => s.logout);
  const hasUserProfile = useAuthStore((s) => s.isOnboardingComplete);

  const { isProSubscriber, dailyRecommendationsRemaining } = useSaftaPremiumStore();
  const deleteAccountMutation = useDeactivateAccount();

  const saftaName = session?.user?.user_metadata?.safta_name || 'Safta';
  const saftaRelationship = session?.user?.user_metadata?.safta_relationship || 'grandmother';
  const saftaPhoto = session?.user?.user_metadata?.safta_photo || null;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const [editName, setEditName] = useState(saftaName);
  const [editRelationship, setEditRelationship] = useState(saftaRelationship);
  const [editPhoto, setEditPhoto] = useState<string | null>(saftaPhoto);
  const [isUploading, setIsUploading] = useState(false);

  const [notifyNewMatches, setNotifyNewMatches] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyRecommendations, setNotifyRecommendations] = useState(true);

  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);

  useEffect(() => {
    async function fetchConnectedUsers() {
      if (!session?.user?.id) return;

      try {
        // This query named three things that do not exist, and the `catch`-and-log below
        // hid that, so the screen has always shown no connected users (MEXA-279):
        //
        //   * `safta_connections` has no `safta_id`. The safta side is `safta_account_id`,
        //     a reference to `safta_accounts`, which is what `session.user.id` has to be
        //     resolved through - hence the first query.
        //   * there is no `safta_connections_user_id_fkey`; the constraint on the member
        //     side is `safta_connections_connected_user_id_fkey`.
        //   * `users` is own-row-only since 00013 (MEXA-261), and a safta has no `users`
        //     row at all, so the connected member has to come from `user_public_profiles` -
        //     which is a view, hence two more queries rather than an embed with photos
        //     nested underneath it.
        const { data: saftaAccount, error: accountError } = await supabase
          .from('safta_accounts')
          .select('id')
          .eq('auth_id', session.user.id)
          .maybeSingle();

        if (accountError || !saftaAccount) {
          if (accountError) console.log('No safta_accounts row:', accountError.message);
          setConnectedUsers([]);
          return;
        }

        const { data, error } = await supabase
          .from('safta_connections')
          .select('id, created_at, connected_user_id')
          .eq('safta_account_id', saftaAccount.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.log('No safta_connections data:', error.message);
          setConnectedUsers([]);
          return;
        }

        const connectedUserIds = [
          ...new Set((data ?? []).map((conn) => conn.connected_user_id)),
        ].filter((id): id is string => !!id);

        const { data: members, error: membersError } = await supabase
          .from('user_public_profiles')
          .select('id, first_name, age')
          .in('id', connectedUserIds);

        if (membersError) {
          console.log('No connected member profiles:', membersError.message);
          setConnectedUsers([]);
          return;
        }

        const membersById = new Map((members ?? []).map((member) => [member.id, member]));
        const photoUrls = await fetchPrimaryPhotoUrls(connectedUserIds);

        const users: ConnectedUser[] = (data || []).map((conn) => {
          const user = conn.connected_user_id ? membersById.get(conn.connected_user_id) : undefined;

          // Computed by the view now (MEXA-320); 0 stands for "no such member", the same
          // thing the inline arithmetic this replaces produced for a missing row.
          const age = user?.age ?? 0;

          return {
            id: user?.id || conn.id,
            first_name: user?.first_name || 'User',
            photo_url: (conn.connected_user_id && photoUrls.get(conn.connected_user_id)) || null,
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMode('user');

    if (isOnboardingComplete) {
      router.replace('/(tabs)');
    } else {
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

      if (editPhoto && !editPhoto.startsWith('http') && session?.user?.id) {
        try {
          const base64 = await FileSystem.readAsStringAsync(editPhoto, {
            encoding: Base64Encoding,
          });

          const fileExt = editPhoto.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `safta-photos/${session.user.id}/${Date.now()}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, decode(base64), {
              contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
              upsert: true,
            });

          if (uploadError) {
            console.error('[Safta Profile] Photo upload error:', uploadError);
          } else {
            const { data: urlData } = supabase.storage
              .from('profile-photos')
              .getPublicUrl(fileName);

            if (urlData?.publicUrl) {
              photoUrl = urlData.publicUrl;
            }
          }
        } catch (uploadErr) {
          console.error('[Safta Profile] Error uploading photo:', uploadErr);
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
    router.push('/(safta-auth)/paywall');
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
          onPress: () => Linking.openURL('mailto:support@mazaldating.com?subject=Safta%20Mode%20Support'),
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
    <View style={styles.container}>
      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[colors.primary.navy, colors.dark.background]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color={colors.primary.white} />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Preview */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profilePreview}>
          <Pressable onPress={() => setShowEditModal(true)}>
            {saftaPhoto ? (
              <Image source={{ uri: saftaPhoto }} style={styles.mainPhoto} />
            ) : (
              <View style={[styles.mainPhoto, styles.photoPlaceholder]}>
                <Text style={styles.avatarEmoji}>👵</Text>
              </View>
            )}
            <View style={styles.editPhotoOverlay}>
              <Ionicons name="camera" size={16} color={colors.primary.navy} />
            </View>
          </Pressable>
          <View style={styles.saftaBadgeOnPhoto}>
            <Text style={styles.saftaBadgeText}>SAFTA</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{saftaName}</Text>
            <Text style={styles.occupation}>{getRelationshipLabel(saftaRelationship)}</Text>
          </View>

          <Pressable style={styles.editButton} onPress={() => setShowEditModal(true)}>
            <Ionicons name="pencil" size={18} color={colors.primary.gold} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
        </Animated.View>

        {/* Stats Section */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.statsSection}>
          <Text style={styles.sectionLabel}>Your Activity</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="sparkles" size={24} color={colors.semantic.success} />
              </View>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: colors.transparent.gold10 }]}>
                <Ionicons name="people" size={24} color={colors.primary.gold} />
              </View>
              <Text style={styles.statValue}>{connectedUsers.length}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>
        </Animated.View>

        {/* Premium Banner */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          {isProSubscriber ? (
            <View style={styles.proBanner}>
              <View style={styles.premiumContent}>
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
                <View style={styles.premiumText}>
                  <Text style={styles.proTitle}>Safta Pro</Text>
                  <Text style={styles.proSubtitle}>Unlimited recommendations & connections</Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={colors.semantic.success} />
            </View>
          ) : (
            <Pressable style={styles.premiumBanner} onPress={handlePremiumPress}>
              <View style={styles.premiumContent}>
                <View style={styles.premiumIconContainer}>
                  <Ionicons name="star" size={22} color={colors.primary.gold} />
                </View>
                <View style={styles.premiumText}>
                  <Text style={styles.premiumTitle}>Upgrade to Safta Pro</Text>
                  <Text style={styles.premiumSubtitle}>
                    {dailyRecommendationsRemaining} recommendations left today
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primary.gold} />
            </Pressable>
          )}
        </Animated.View>

        {/* Settings Sections */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.settingsSection}>
          <Text style={styles.sectionLabel}>Settings</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon="options-outline"
              label="Browse Preferences"
              onPress={() => setShowPreferencesModal(true)}
              index={0}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => setShowNotificationsModal(true)}
              index={1}
            />
          </View>
        </Animated.View>

        {/* Switch to Dating Mode */}
        <Animated.View entering={FadeInUp.delay(500).springify()}>
          <Pressable style={styles.saftaModeBanner} onPress={handleSwitchToUserMode}>
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
        </Animated.View>

        {/* Support Section */}
        <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.settingsSection}>
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon="help-circle-outline"
              label="Help & Support"
              onPress={handleHelpPress}
              index={0}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="document-text-outline"
              label="Terms & Privacy"
              onPress={() => router.push('/legal/terms')}
              index={1}
            />
          </View>
        </Animated.View>

        {/* Account Actions */}
        <Animated.View entering={FadeInUp.delay(700).springify()} style={styles.accountActions}>
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
        </Animated.View>

        <Text style={styles.versionText}>Mazal for Saftas v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Pressable onPress={handleSaveProfile} disabled={isUploading}>
              <Text style={[styles.modalSave, isUploading && { opacity: 0.5 }]}>
                {isUploading ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.photoEditSection}>
              <Text style={styles.inputLabel}>Profile Photo</Text>
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
                    <Ionicons name="camera" size={14} color={colors.primary.navy} />
                  </View>
                </Pressable>
                <View style={styles.photoActions}>
                  <Pressable style={styles.photoActionButton} onPress={handlePickPhoto}>
                    <Ionicons name="image-outline" size={20} color={colors.primary.gold} />
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
              <Text style={styles.photoHint}>Adding a photo helps your family recognize you</Text>
            </View>

            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={colors.transparent.white30}
            />

            <Text style={styles.inputLabel}>Relationship</Text>
            <View style={styles.relationshipOptions}>
              {relationships.map((rel) => (
                <Pressable
                  key={rel.id}
                  style={[
                    styles.relationshipOption,
                    editRelationship === rel.id && styles.relationshipOptionActive,
                  ]}
                  onPress={() => setEditRelationship(rel.id)}
                >
                  <Text
                    style={[
                      styles.relationshipOptionText,
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
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowPreferencesModal(false)}>
              <Text style={styles.modalCancel}>Close</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Browse Preferences</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.preferencesInfo}>
              Your browse preferences are managed from the Discover tab. Tap the filter icon to customize who you see.
            </Text>

            <View style={styles.tipCard}>
              <View style={styles.tipIconContainer}>
                <Ionicons name="bulb-outline" size={22} color={colors.primary.gold} />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Tip</Text>
                <Text style={styles.tipText}>
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
              <LinearGradient
                colors={[colors.primary.gold, '#b8922a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.goToDiscoverGradient}
              >
                <Text style={styles.goToDiscoverButtonText}>Go to Discover</Text>
              </LinearGradient>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowNotificationsModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Notifications</Text>
            <Pressable onPress={handleSaveNotifications}>
              <Text style={styles.modalSave}>Save</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.notificationRow}>
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationLabel}>New Matches</Text>
                <Text style={styles.notificationDesc}>
                  When someone you recommended matches
                </Text>
              </View>
              <Switch
                value={notifyNewMatches}
                onValueChange={setNotifyNewMatches}
                trackColor={{ false: colors.neutral[600], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.notificationRow}>
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationLabel}>Messages</Text>
                <Text style={styles.notificationDesc}>
                  When you receive new messages
                </Text>
              </View>
              <Switch
                value={notifyMessages}
                onValueChange={setNotifyMessages}
                trackColor={{ false: colors.neutral[600], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>

            <View style={styles.notificationRow}>
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationLabel}>Recommendations</Text>
                <Text style={styles.notificationDesc}>
                  Updates on your sent recommendations
                </Text>
              </View>
              <Switch
                value={notifyRecommendations}
                onValueChange={setNotifyRecommendations}
                trackColor={{ false: colors.neutral[600], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profilePreview: {
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
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
    color: colors.primary.white,
  },
  occupation: {
    fontSize: 14,
    marginTop: spacing[1],
    color: colors.transparent.white60,
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
    borderWidth: 1,
    borderColor: colors.transparent.gold30,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  statsSection: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.transparent.white10,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.success10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.white,
  },
  statLabel: {
    fontSize: 12,
    marginTop: spacing[0.5],
    color: colors.transparent.white50,
  },
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
    flex: 1,
  },
  premiumIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: colors.transparent.white60,
    marginTop: spacing[0.5],
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.transparent.gold20,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primary.gold,
  },
  proBadge: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.navy,
    letterSpacing: 0.5,
  },
  proTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  proSubtitle: {
    fontSize: 13,
    color: colors.transparent.white70,
    marginTop: spacing[0.5],
  },
  settingsSection: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
  },
  settingsCard: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
  },
  settingsItemPressed: {
    backgroundColor: colors.transparent.white05,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingIconDanger: {
    backgroundColor: colors.transparent.error10,
  },
  settingsItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
  },
  settingsItemLabelDanger: {
    color: colors.semantic.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.transparent.white10,
    marginLeft: spacing[4] + 36 + spacing[3],
  },
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
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  accountActions: {
    marginTop: spacing[6],
    marginHorizontal: spacing[4],
    gap: spacing[2],
  },
  logoutButton: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.semantic.error,
  },
  deleteButton: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.transparent.white50,
  },
  versionText: {
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.dark.background,
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
    color: colors.primary.white,
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
    color: colors.transparent.white50,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.transparent.white50,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  textInput: {
    fontSize: 16,
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.transparent.white10,
    color: colors.primary.white,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
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
    borderColor: colors.transparent.white10,
    backgroundColor: colors.transparent.white10,
  },
  relationshipOptionActive: {
    borderColor: colors.primary.gold,
    backgroundColor: colors.transparent.gold10,
  },
  relationshipOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.transparent.white70,
  },
  relationshipOptionTextActive: {
    color: colors.primary.gold,
  },
  preferencesInfo: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing[4],
    color: colors.transparent.white70,
  },
  tipCard: {
    flexDirection: 'row',
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    gap: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.transparent.gold20,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing[1],
    color: colors.primary.white,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.transparent.white70,
  },
  goToDiscoverButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  goToDiscoverGradient: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  goToDiscoverButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[2],
    backgroundColor: colors.transparent.white10,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
  },
  notificationInfo: {
    flex: 1,
    marginRight: spacing[4],
  },
  notificationLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
  },
  notificationDesc: {
    fontSize: 13,
    marginTop: spacing[0.5],
    color: colors.transparent.white50,
  },
});
