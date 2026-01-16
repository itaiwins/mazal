/**
 * Location Settings Screen
 *
 * Premium location settings with dark theme
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/api/supabase/client';

export default function LocationSettingsScreen() {
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [showDistance, setShowDistance] = useState(true);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [currentCity, setCurrentCity] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user?.current_city) {
      setCurrentCity(user.current_city);
    }
  }, [user?.current_city]);

  const handleRequestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Location permission granted!');
    } else {
      Alert.alert(
        'Permission Denied',
        'Please enable location access in your device settings to use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleUpdateLocation = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to update your location.');
      return;
    }

    try {
      setIsUpdating(true);

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsUpdating(false);
        handleRequestPermission();
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (place) {
        const city = `${place.city || place.district || 'Unknown'}, ${place.region || place.country || ''}`.trim();

        const { error } = await supabase
          .from('users')
          .update({
            current_city: city,
            current_latitude: location.coords.latitude,
            current_longitude: location.coords.longitude,
          })
          .eq('id', user.id);

        if (error) {
          throw error;
        }

        setCurrentCity(city);
        setUser({ ...user, current_city: city });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Location Updated', `Your location is now set to ${city}`);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    } finally {
      setIsUpdating(false);
    }
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
          <Text style={styles.headerTitle}>Location</Text>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Location */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Current Location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationInfo}>
              <View style={styles.locationIconContainer}>
                <Ionicons name="location" size={22} color={colors.primary.gold} />
              </View>
              <View style={styles.locationText}>
                <Text style={styles.locationCity}>
                  {currentCity || 'Not set'}
                </Text>
                <Text style={styles.locationHint}>
                  Used to find matches near you
                </Text>
              </View>
            </View>
            <Pressable
              style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]}
              onPress={handleUpdateLocation}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={colors.primary.navy} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={colors.primary.navy} />
                  <Text style={styles.updateButtonText}>Update</Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>

        {/* Location Settings */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionLabel}>Location Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIcon}>
                  <Ionicons name="navigate" size={20} color={colors.primary.gold} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Use current location</Text>
                  <Text style={styles.settingDesc}>Automatically update your location</Text>
                </View>
              </View>
              <Switch
                value={useCurrentLocation}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setUseCurrentLocation(value);
                }}
                trackColor={{ false: colors.neutral[600], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIcon}>
                  <Ionicons name="swap-horizontal" size={20} color={colors.primary.gold} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Show distance on profile</Text>
                  <Text style={styles.settingDesc}>Let others see how far you are</Text>
                </View>
              </View>
              <Switch
                value={showDistance}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDistance(value);
                }}
                trackColor={{ false: colors.neutral[600], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </Animated.View>

        {/* Distance Preferences Link */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <Pressable
            style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings/preferences');
            }}
          >
            <View style={styles.linkInfo}>
              <View style={[styles.settingIcon, { backgroundColor: colors.transparent.white10 }]}>
                <Ionicons name="options" size={20} color={colors.transparent.white60} />
              </View>
              <Text style={styles.linkLabel}>Maximum Distance</Text>
            </View>
            <View style={styles.linkRight}>
              <Text style={styles.linkValue}>50 mi</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </View>
          </Pressable>
        </Animated.View>

        {/* Info Card */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary.gold} />
          </View>
          <Text style={styles.infoText}>
            Your precise location is never shared with other users. Only your approximate distance is shown.
          </Text>
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
    paddingHorizontal: spacing[4],
  },
  section: {
    marginTop: spacing[6],
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
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    padding: spacing[4],
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
  },
  locationCity: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  locationHint: {
    fontSize: 13,
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    backgroundColor: colors.primary.gold,
    borderRadius: borderRadius.lg,
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  settingsCard: {
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.transparent.gold10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  divider: {
    height: 1,
    backgroundColor: colors.transparent.white10,
    marginLeft: spacing[4] + 36 + spacing[3],
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.transparent.white10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.transparent.white10,
    padding: spacing[4],
    marginTop: spacing[4],
  },
  linkCardPressed: {
    backgroundColor: colors.transparent.white05,
  },
  linkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.white,
  },
  linkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  linkValue: {
    fontSize: 15,
    color: colors.transparent.white60,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    borderRadius: borderRadius.xl,
    gap: spacing[3],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: colors.transparent.gold20,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.transparent.white70,
  },
});
