/**
 * Mazal Map Screen
 *
 * Geographic discovery - browse users on a map
 * Note: Full map functionality requires a development build
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors } from '@/theme/colors';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

// Sample data for demo
const SAVED_LOCATIONS = [
  { id: '1', name: 'Home', type: 'home' },
  { id: '2', name: 'Work', type: 'work' },
  { id: '3', name: 'NYU', type: 'college' },
];

const NEARBY_USERS = [
  {
    id: '1',
    name: 'Sarah',
    age: 27,
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    distance: 0.5,
  },
  {
    id: '2',
    name: 'David',
    age: 29,
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    distance: 1.2,
  },
  {
    id: '3',
    name: 'Rachel',
    age: 25,
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    distance: 0.8,
  },
  {
    id: '4',
    name: 'Michael',
    age: 31,
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    distance: 2.1,
  },
];

export default function MazalMapScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationType, setNewLocationType] = useState<'home' | 'work' | 'college'>('home');
  const [savedLocations, setSavedLocations] = useState(SAVED_LOCATIONS);

  const handleAddLocation = () => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }
    const newLocation = {
      id: Date.now().toString(),
      name: newLocationName.trim(),
      type: newLocationType,
    };
    setSavedLocations([...savedLocations, newLocation]);
    setNewLocationName('');
    setShowAddModal(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.neutral[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location or campus"
            placeholderTextColor={colors.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={styles.filterButton}
          onPress={() => router.push('/settings/preferences')}
        >
          <Ionicons name="options-outline" size={22} color={colors.primary.navy} />
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
          <Pressable key={location.id} style={styles.locationChip}>
            <Ionicons
              name={
                location.type === 'home' ? 'home' :
                location.type === 'work' ? 'briefcase' : 'school'
              }
              size={14}
              color={colors.primary.navy}
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

      {/* Map placeholder */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapIconContainer}>
          <Ionicons name="map" size={64} color={colors.primary.gold} />
        </View>
        <Text style={styles.mapPlaceholderTitle}>Map View</Text>
        <Text style={styles.mapPlaceholderText}>
          Full map functionality requires a development build.
          {'\n'}Browse nearby users below.
        </Text>
      </View>

      {/* Nearby users list */}
      <View style={styles.nearbySection}>
        <Text style={styles.nearbyTitle}>Nearby Users ({NEARBY_USERS.length})</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.nearbyList}
        >
          {NEARBY_USERS.map((user) => (
            <Pressable
              key={user.id}
              style={styles.userCard}
              onPress={() => Alert.alert(
                `${user.name}, ${user.age}`,
                `${user.distance} mi away\n\nView full profile and swipe on the Discover tab.`,
                [{ text: 'OK' }]
              )}
            >
              <Image
                source={{ uri: user.photo }}
                style={styles.userCardImage}
                contentFit="cover"
              />
              <View style={styles.userCardContent}>
                <Text style={styles.userCardName}>{user.name}, {user.age}</Text>
                <Text style={styles.userCardDistance}>{user.distance} mi away</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
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
              placeholderTextColor={colors.neutral[400]}
              value={newLocationName}
              onChangeText={setNewLocationName}
              autoFocus
            />

            <Text style={styles.modalLabel}>Type</Text>
            <View style={styles.typeOptions}>
              {[
                { type: 'home' as const, icon: 'home', label: 'Home' },
                { type: 'work' as const, icon: 'briefcase', label: 'Work' },
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
                    color={newLocationType === option.type ? colors.primary.gold : colors.neutral[400]}
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
              Saved locations help you discover Jewish singles near places you frequent.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
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
    backgroundColor: colors.primary.white,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
    ...shadows.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primary.navy,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.primary.white,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
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
    backgroundColor: colors.primary.white,
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
    backgroundColor: 'transparent',
  },
  locationChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary.navy,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  mapIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  mapPlaceholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary.navy,
    marginBottom: spacing[2],
  },
  mapPlaceholderText: {
    fontSize: 15,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  nearbySection: {
    paddingBottom: spacing[4],
  },
  nearbyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.navy,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  nearbyList: {
    paddingHorizontal: spacing[4],
  },
  userCard: {
    width: 140,
    backgroundColor: colors.primary.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginRight: spacing[3],
    ...shadows.md,
  },
  userCardImage: {
    width: '100%',
    height: 140,
  },
  userCardContent: {
    padding: spacing[3],
  },
  userCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.navy,
  },
  userCardDistance: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.primary.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  modalCancel: {
    fontSize: 16,
    color: colors.neutral[600],
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.navy,
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
    color: colors.primary.navy,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  modalInput: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 16,
    color: colors.primary.navy,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    borderColor: colors.primary.gold,
    backgroundColor: colors.transparent.gold20,
  },
  typeOptionText: {
    marginTop: spacing[2],
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  typeOptionTextActive: {
    color: colors.primary.gold,
  },
  modalHint: {
    marginTop: spacing[6],
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
  },
});
