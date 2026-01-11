/**
 * Location Settings Screen
 *
 * Manage location preferences and permissions
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function LocationSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [showDistance, setShowDistance] = useState(true);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [currentCity, setCurrentCity] = useState('New York, NY');

  const handleBack = () => {
    router.back();
  };

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
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        handleRequestPermission();
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (place) {
        const city = `${place.city}, ${place.region}`;
        setCurrentCity(city);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Location Updated', `Your location is now set to ${city}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    }
  };

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
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Location
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Location */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Current Location
          </Text>
          <View style={[styles.locationCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={24} color={colors.primary.gold} />
              <View style={styles.locationText}>
                <Text style={[styles.locationCity, { color: theme.colors.text }]}>
                  {currentCity}
                </Text>
                <Text style={[styles.locationHint, { color: theme.colors.textTertiary }]}>
                  Used to find matches near you
                </Text>
              </View>
            </View>
            <Pressable style={styles.updateButton} onPress={handleUpdateLocation}>
              <Text style={styles.updateButtonText}>Update</Text>
            </Pressable>
          </View>
        </View>

        {/* Location Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Location Settings
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="navigate" size={22} color={colors.primary.gold} />
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Use current location
                </Text>
              </View>
              <Switch
                value={useCurrentLocation}
                onValueChange={setUseCurrentLocation}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="swap-horizontal" size={22} color={colors.primary.gold} />
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Show distance on profile
                </Text>
              </View>
              <Switch
                value={showDistance}
                onValueChange={setShowDistance}
                trackColor={{ false: colors.neutral[200], true: colors.primary.gold }}
                thumbColor={colors.primary.white}
              />
            </View>
          </View>
        </View>

        {/* Distance Preferences Link */}
        <Pressable
          style={[styles.linkCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => router.push('/settings/preferences')}
        >
          <View style={styles.linkInfo}>
            <Ionicons name="options" size={22} color={theme.colors.icon} />
            <Text style={[styles.linkLabel, { color: theme.colors.text }]}>
              Maximum Distance
            </Text>
          </View>
          <View style={styles.linkRight}>
            <Text style={[styles.linkValue, { color: theme.colors.textSecondary }]}>
              50 mi
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
          </View>
        </Pressable>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.transparent.gold20 }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary.gold} />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            Your precise location is never shared with other users. Only your approximate distance is shown.
          </Text>
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
    paddingHorizontal: spacing[4],
  },
  section: {
    marginTop: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  locationText: {
    flex: 1,
  },
  locationCity: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationHint: {
    fontSize: 13,
    marginTop: spacing[1],
  },
  updateButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary.gold,
    borderRadius: borderRadius.md,
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  settingsCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  settingLabel: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: spacing[4],
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[4],
  },
  linkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  linkLabel: {
    fontSize: 16,
  },
  linkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  linkValue: {
    fontSize: 15,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    marginTop: spacing[6],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
