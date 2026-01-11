/**
 * Location Screen
 *
 * Request location permission and set city
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';
import { useOnboardingStore } from '@/stores/onboardingStore';

const POPULAR_CITIES = [
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Miami, FL',
  'Boston, MA',
  'San Francisco, CA',
];

export default function LocationScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useOnboardingStore((s) => s.data);
  const updateLocation = useOnboardingStore((s) => s.updateLocation);

  const [city, setCity] = useState(data?.current_city || '');
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const isValid = city.trim().length >= 2;

  const requestLocationPermission = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (address) {
          const cityName = address.city || address.subregion || '';
          const region = address.region || '';
          setCity(`${cityName}, ${region}`);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your location. Please enter it manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    updateLocation({ current_city: city.trim() });
    router.push('/(onboarding)/education');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing[16],
          paddingBottom: insets.bottom + spacing[4],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Where are you?
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          We'll show you people nearby
        </Text>
      </View>

      {/* Location Permission */}
      {hasPermission !== true && (
        <Pressable
          style={[styles.locationButton, { backgroundColor: theme.colors.surface }]}
          onPress={requestLocationPermission}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primary.gold} />
          ) : (
            <>
              <View style={styles.locationIcon}>
                <Ionicons name="location" size={24} color={colors.primary.gold} />
              </View>
              <View style={styles.locationContent}>
                <Text style={[styles.locationTitle, { color: theme.colors.text }]}>
                  Use my current location
                </Text>
                <Text style={[styles.locationSubtitle, { color: theme.colors.textSecondary }]}>
                  We'll only use this to find people near you
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.icon} />
            </>
          )}
        </Pressable>
      )}

      {hasPermission === true && city && (
        <Animated.View
          entering={FadeIn}
          style={[styles.locationConfirmed, { backgroundColor: colors.transparent.gold20 }]}
        >
          <Ionicons name="checkmark-circle" size={24} color={colors.primary.gold} />
          <Text style={[styles.locationConfirmedText, { color: colors.primary.gold }]}>
            Location detected
          </Text>
        </Animated.View>
      )}

      {/* Manual Entry */}
      <View style={styles.manualSection}>
        <Text style={[styles.orText, { color: theme.colors.textTertiary }]}>
          Or enter your city
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
            },
          ]}
          placeholder="City, State"
          placeholderTextColor={theme.colors.textTertiary}
          value={city}
          onChangeText={setCity}
          autoCapitalize="words"
        />
      </View>

      {/* Popular Cities */}
      <View style={styles.popularSection}>
        <Text style={[styles.popularLabel, { color: theme.colors.textSecondary }]}>
          Popular cities
        </Text>
        <View style={styles.popularCities}>
          {POPULAR_CITIES.map((popularCity) => (
            <Pressable
              key={popularCity}
              style={[
                styles.cityChip,
                city === popularCity && styles.cityChipSelected,
              ]}
              onPress={() => setCity(popularCity)}
            >
              <Text style={styles.cityChipText}>
                {popularCity}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.continueButton,
            !isValid && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 16,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  locationContent: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  locationSubtitle: {
    fontSize: 13,
  },
  locationConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  locationConfirmedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  manualSection: {
    marginBottom: spacing[6],
  },
  orText: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  input: {
    fontSize: 16,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
  },
  popularSection: {
    flex: 1,
  },
  popularLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  popularCities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  cityChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary.cream,
  },
  cityChipSelected: {
    backgroundColor: colors.primary.gold,
  },
  cityChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary.navy,
  },
  footer: {
    paddingTop: spacing[4],
  },
  continueButton: {
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
