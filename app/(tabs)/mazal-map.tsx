/**
 * Mazal Map Screen
 *
 * Geographic discovery - browse users on an interactive map
 * Shows nearby Jewish singles with markers and profile previews
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import { useDotNavigatorInset } from '@/components/navigation/DotNavigator';
import { StarOfDavid } from '@/components/icons/StarOfDavid';
import { usePremiumStore } from '@/stores/premiumStore';
import { useUIStore } from '@/stores/uiStore';
import { FEATURE_LIMITS } from '@/lib/config/revenuecat';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';
import { DEMO_NEARBY_USERS } from '@/lib/demo/demoProfiles';
import Constants from 'expo-constants';

// Conditionally import MapView - not available in Expo Go
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = null;
let Callout: any = null;
type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// Check if we're in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
    Callout = Maps.Callout;
  } catch (e) {
    console.log('react-native-maps not available');
  }
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Initial region will be set to user's location once obtained
// This is just a fallback that won't be used since we wait for location
const FALLBACK_REGION: Region = {
  latitude: 30.4383,  // Tallahassee as fallback
  longitude: -84.2807,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

// Nearby users type - will be populated from Supabase
type NearbyUser = {
  id: string;
  name: string;
  age: number;
  photo: string;
  distance: number;
  latitude: number;
  longitude: number;
  jewishBackground: string;
  occupation: string;
  isVerified: boolean;
  saftaApproved: number;
};

type UserType = NearbyUser;
type LocationType = {
  id: string;
  name: string;
  type: 'home' | 'college';
  latitude: number;
  longitude: number;
};

// Saved locations - Home will be set to user's actual location
const DEFAULT_LOCATIONS: LocationType[] = [];

// User marker component
function UserMarker({ user, isSelected, onPress }: { user: UserType; isSelected: boolean; onPress: () => void }) {
  return (
    <Marker
      coordinate={{ latitude: user.latitude, longitude: user.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={[styles.markerContainer, isSelected && styles.markerContainerSelected]}>
        <Image
          source={{ uri: user.photo }}
          style={[styles.markerImage, isSelected && styles.markerImageSelected]}
        />
        {user.isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={8} color={colors.primary.navy} />
          </View>
        )}
        {/* Safta approvals - hidden behind a flag (docs/ROADMAP.md) */}
        {FEATURE_SAFTA_MODE && user.saftaApproved > 0 && (
          <View style={styles.saftaBadge}>
            <Text style={styles.saftaBadgeText}>👵{user.saftaApproved}</Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

// Profile preview card component
function ProfilePreview({
  user,
  onClose,
  onViewProfile
}: {
  user: UserType;
  onClose: () => void;
  onViewProfile: () => void;
}) {
  // Absolute at bottom 0, same as the DotNavigator, so it needs the navigator's height in
  // its own padding or the "View Profile" button sits under the dots (MEXA-338, finding 9).
  const dotNavigatorInset = useDotNavigatorInset();

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(15)}
      exiting={SlideOutDown.springify()}
      style={[styles.previewContainer, { paddingBottom: dotNavigatorInset + spacing[4] }]}
    >
      <LinearGradient
        colors={[colors.dark.elevated, colors.dark.card]}
        style={styles.previewGradient}
      >
        <Pressable style={styles.previewCloseButton} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.transparent.white60} />
        </Pressable>

        <View style={styles.previewContent}>
          <Image source={{ uri: user.photo }} style={styles.previewImage} />

          <View style={styles.previewInfo}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewName}>{user.name}, {user.age}</Text>
              {user.isVerified && (
                <Ionicons name="checkmark-circle" size={18} color={colors.semantic.info} />
              )}
            </View>

            <Text style={styles.previewOccupation}>{user.occupation}</Text>

            <View style={styles.previewTags}>
              <View style={styles.previewTag}>
                <StarOfDavid size={12} color={colors.primary.gold} />
                <Text style={styles.previewTagText}>{user.jewishBackground}</Text>
              </View>
              <View style={styles.previewTag}>
                <Ionicons name="location" size={12} color={colors.primary.gold} />
                <Text style={styles.previewTagText}>{user.distance} mi</Text>
              </View>
            </View>

            {/* Safta approvals - hidden behind a flag (docs/ROADMAP.md) */}
            {FEATURE_SAFTA_MODE && user.saftaApproved > 0 && (
              <View style={styles.saftaApprovedRow}>
                <Text style={styles.saftaApprovedEmoji}>👵</Text>
                <Text style={styles.saftaApprovedText}>
                  {user.saftaApproved} Safta{user.saftaApproved > 1 ? 's' : ''} approved
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.previewActions}>
          <Pressable style={styles.previewPassButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.semantic.error} />
          </Pressable>
          <Pressable style={styles.previewViewButton} onPress={onViewProfile}>
            <Text style={styles.previewViewButtonText}>View Profile</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primary.navy} />
          </Pressable>
          <Pressable style={styles.previewLikeButton} onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Liked!', `You liked ${user.name}. If they like you back, it's a match!`);
            onClose();
          }}>
            <Ionicons name="heart" size={24} color={colors.primary.gold} />
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export default function MazalMapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);

  // Premium state
  const entitlements = usePremiumStore((s) => s.entitlements);
  const showPaywallModal = usePremiumStore((s) => s.showPaywallModal);
  const isPlatinum = entitlements.plan === 'mazal_platinum';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationType, setNewLocationType] = useState<'home' | 'college'>('college');
  const [savedLocations, setSavedLocations] = useState<LocationType[]>(DEFAULT_LOCATIONS);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);

  // Nearby users - empty until real data is fetched from Supabase
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);

  // Check if demo mode is enabled
  const isDemoMode = useUIStore((s) => s.isDemoMode);

  // Set demo users when demo mode is enabled
  useEffect(() => {
    if (isDemoMode) {
      setNearbyUsers(DEMO_NEARBY_USERS);
    } else {
      setNearbyUsers([]);
    }
  }, [isDemoMode]);

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setIsLoadingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const userCoords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(userCoords);

        // Center map on user location
        setRegion({
          ...userCoords,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });

        // Set Home location to user's actual location
        setSavedLocations([{
          id: 'home',
          name: 'Home',
          type: 'home',
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
        }]);
      } catch (error) {
        console.error('Error getting location:', error);
      } finally {
        setIsLoadingLocation(false);
      }
    })();
  }, []);

  // Handle marker press - Platinum only feature
  const handleMarkerPress = useCallback((user: UserType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if user has Platinum - map profile viewing is Platinum-only
    if (!isPlatinum) {
      showPaywallModal(
        'Upgrade to Mazal Platinum to view profiles on the map and like or pass directly!',
        'platinum'
      );
      return;
    }

    setSelectedUser(user);

    // Animate to user location
    mapRef.current?.animateToRegion({
      latitude: user.latitude,
      longitude: user.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 500);
  }, [isPlatinum, showPaywallModal]);

  // Center on user location
  const handleCenterOnUser = useCallback(() => {
    if (userLocation) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
    }
  }, [userLocation]);

  // Handle saved location press
  const handleLocationPress = useCallback((location: LocationType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 500);
  }, []);

  // Add new location
  const handleAddLocation = useCallback(() => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }

    const centerCoords = region || FALLBACK_REGION;
    const newLocation: LocationType = {
      id: Date.now().toString(),
      name: newLocationName.trim(),
      type: newLocationType,
      latitude: centerCoords.latitude,
      longitude: centerCoords.longitude,
    };

    setSavedLocations(prev => [...prev, newLocation]);
    setNewLocationName('');
    setShowAddModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newLocationName, newLocationType, region]);

  // View full profile
  const handleViewProfile = useCallback(() => {
    if (selectedUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Coming Soon',
        `Full profile view for ${selectedUser.name} will open in the Discover tab.`,
        [{ text: 'OK', onPress: () => setSelectedUser(null) }]
      );
    }
  }, [selectedUser]);

  // Fallback UI for Expo Go (maps not available)
  if (!MapView || isExpoGo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[colors.dark.background, colors.primary.navy]}
          style={styles.expoGoFallback}
        >
          <View style={styles.expoGoContent}>
            <View style={styles.expoGoIconContainer}>
              <Ionicons name="map" size={64} color={colors.primary.gold} />
            </View>
            <Text style={styles.expoGoTitle}>Map View</Text>
            <Text style={styles.expoGoSubtitle}>
              Maps require a development build and are not available in Expo Go.
            </Text>
            <Text style={styles.expoGoHint}>
              Use the Discover tab to browse profiles, or build the app with{'\n'}
              <Text style={styles.expoGoCode}>npx expo run:ios</Text>
            </Text>
            <Pressable
              style={styles.expoGoButton}
              onPress={() => router.push('/(tabs)/')}
            >
              <Text style={styles.expoGoButtonText}>Go to Discover</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={region || FALLBACK_REGION}
        region={mapReady ? undefined : (region || FALLBACK_REGION)}
        onRegionChangeComplete={setRegion}
        onMapReady={() => setMapReady(true)}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        customMapStyle={darkMapStyle}
        onPress={() => setSelectedUser(null)}
      >
        {/* User markers */}
        {nearbyUsers.map((user) => (
          <UserMarker
            key={user.id}
            user={user}
            isSelected={selectedUser?.id === user.id}
            onPress={() => handleMarkerPress(user)}
          />
        ))}
      </MapView>

      {/* Overlay UI */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={colors.transparent.white50} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search location or campus"
              placeholderTextColor={colors.transparent.white40}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.transparent.white50} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={styles.filterButton}
            onPress={() => router.push('/settings/preferences')}
          >
            <Ionicons name="options-outline" size={22} color={colors.transparent.white70} />
          </Pressable>
        </View>

        {/* Saved locations chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.savedLocations}
          contentContainerStyle={styles.savedLocationsContent}
        >
          {savedLocations.map((location) => (
            <Pressable
              key={location.id}
              style={styles.locationChip}
              onPress={() => handleLocationPress(location)}
            >
              <Ionicons
                name={location.type === 'home' ? 'home' : 'school'}
                size={14}
                color={colors.primary.gold}
              />
              <Text style={styles.locationChipText}>{location.name}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.locationChip, styles.addLocationChip]}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={14} color={colors.primary.gold} />
            <Text style={[styles.locationChipText, { color: colors.primary.gold }]}>Add</Text>
          </Pressable>
        </ScrollView>

        {/* Map controls */}
        <View style={styles.mapControls}>
          <Pressable style={styles.mapControlButton} onPress={handleCenterOnUser}>
            <Ionicons name="locate" size={22} color={colors.primary.white} />
          </Pressable>
          <Pressable
            style={styles.mapControlButton}
            onPress={() => {
              const currentRegion = region || FALLBACK_REGION;
              mapRef.current?.animateToRegion({
                ...currentRegion,
                latitudeDelta: currentRegion.latitudeDelta * 0.5,
                longitudeDelta: currentRegion.longitudeDelta * 0.5,
              }, 300);
            }}
          >
            <Ionicons name="add" size={22} color={colors.primary.white} />
          </Pressable>
          <Pressable
            style={styles.mapControlButton}
            onPress={() => {
              const currentRegion = region || FALLBACK_REGION;
              mapRef.current?.animateToRegion({
                ...currentRegion,
                latitudeDelta: currentRegion.latitudeDelta * 2,
                longitudeDelta: currentRegion.longitudeDelta * 2,
              }, 300);
            }}
          >
            <Ionicons name="remove" size={22} color={colors.primary.white} />
          </Pressable>
        </View>

        {/* User count badge */}
        <View style={styles.userCountBadge}>
          <StarOfDavid size={14} color={colors.primary.gold} />
          <Text style={styles.userCountText}>{nearbyUsers.length} nearby</Text>
        </View>

        {/* Loading indicator */}
        {isLoadingLocation && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary.gold} />
            <Text style={styles.loadingText}>Finding your location...</Text>
          </View>
        )}

        {/* Selected user preview */}
        {selectedUser && (
          <ProfilePreview
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onViewProfile={handleViewProfile}
          />
        )}
      </View>

      {/* Add Location Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Add Location</Text>
            <Pressable onPress={handleAddLocation}>
              <Text style={styles.modalSave}>Save</Text>
            </Pressable>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>Location Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., NYU, Home, Gym"
              placeholderTextColor={colors.transparent.white40}
              value={newLocationName}
              onChangeText={setNewLocationName}
              autoFocus
            />

            <Text style={styles.modalLabel}>Type</Text>
            <View style={styles.typeOptions}>
              {[
                { type: 'home' as const, icon: 'home', label: 'Home' },
                { type: 'college' as const, icon: 'school', label: 'Campus' },
              ].map((option) => (
                <Pressable
                  key={option.type}
                  style={[
                    styles.typeOption,
                    newLocationType === option.type && styles.typeOptionActive,
                  ]}
                  onPress={() => setNewLocationType(option.type)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={newLocationType === option.type ? colors.primary.gold : colors.transparent.white50}
                  />
                  <Text
                    style={[
                      styles.typeOptionText,
                      newLocationType === option.type && styles.typeOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalHint}>
              This will save the current map center as your location.
              Saved locations help you discover Jewish singles near places you frequent.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Dark map style
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0A0E1A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0E1A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2d26' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e2640' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0D1B3E' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c3e50' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a252f' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e2640' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1B3E' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0A0E1A' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  // Expo Go fallback styles
  expoGoFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expoGoContent: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  expoGoIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  expoGoTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.white,
    marginBottom: spacing[3],
  },
  expoGoSubtitle: {
    fontSize: 16,
    color: colors.transparent.white60,
    textAlign: 'center',
    marginBottom: spacing[4],
    lineHeight: 24,
  },
  expoGoHint: {
    fontSize: 14,
    color: colors.transparent.white40,
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 22,
  },
  expoGoCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.primary.gold,
  },
  expoGoButton: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
  },
  expoGoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primary.white,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  savedLocations: {
    maxHeight: 50,
  },
  savedLocationsContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
    marginRight: spacing[2],
    ...shadows.sm,
  },
  addLocationChip: {
    borderWidth: 1,
    borderColor: colors.primary.gold,
    borderStyle: 'dashed',
    backgroundColor: colors.transparent.gold10,
  },
  locationChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary.white,
  },
  mapControls: {
    position: 'absolute',
    right: spacing[4],
    top: 140,
    gap: spacing[2],
  },
  mapControlButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  userCountBadge: {
    position: 'absolute',
    bottom: spacing[4],
    left: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    gap: spacing[2],
    ...shadows.card,
  },
  userCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.white,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 26, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[4],
  },
  loadingText: {
    fontSize: 16,
    color: colors.transparent.white70,
  },
  // Marker styles
  markerContainer: {
    alignItems: 'center',
  },
  markerContainerSelected: {
    transform: [{ scale: 1.2 }],
  },
  markerImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.primary.gold,
  },
  markerImageSelected: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  saftaBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.dark.card,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  saftaBadgeText: {
    fontSize: 10,
    color: colors.primary.white,
  },
  // Preview card styles
  previewContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing[4],
    // paddingBottom comes from useDotNavigatorInset() at the call site (MEXA-338).
  },
  previewGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.lg,
  },
  previewCloseButton: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    zIndex: 1,
    padding: spacing[1],
  },
  previewContent: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
  },
  previewInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing[1],
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  previewName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.white,
  },
  previewOccupation: {
    fontSize: 14,
    color: colors.transparent.white60,
  },
  previewTags: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  previewTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.transparent.gold10,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  previewTagText: {
    fontSize: 11,
    color: colors.primary.gold,
    fontWeight: '500',
  },
  saftaApprovedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  saftaApprovedEmoji: {
    fontSize: 12,
  },
  saftaApprovedText: {
    fontSize: 12,
    color: colors.transparent.white60,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
    gap: spacing[3],
  },
  previewPassButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLikeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewViewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
  },
  previewViewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  modalCancel: {
    fontSize: 16,
    color: colors.transparent.white70,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.gold,
  },
  modalContent: {
    padding: spacing[4],
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.white,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  modalInput: {
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 16,
    color: colors.primary.white,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    borderColor: colors.primary.gold,
    backgroundColor: colors.transparent.gold10,
  },
  typeOptionText: {
    marginTop: spacing[2],
    fontSize: 13,
    fontWeight: '500',
    color: colors.transparent.white60,
  },
  typeOptionTextActive: {
    color: colors.primary.gold,
  },
  modalHint: {
    marginTop: spacing[6],
    fontSize: 14,
    color: colors.transparent.white50,
    textAlign: 'center',
    lineHeight: 20,
  },
});
