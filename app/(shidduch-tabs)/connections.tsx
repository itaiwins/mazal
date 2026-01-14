/**
 * Connections Screen
 *
 * Active matches and communication with potential matches through shadchanim
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';

// Mock connections data
const MOCK_CONNECTIONS = [
  {
    id: '1',
    name: 'Rivka',
    age: 22,
    photoUrl: null,
    status: 'dating',
    totalDates: 3,
    lastActivity: '2 days ago',
    shadchan: 'Rabbi Weiss',
    unreadMessages: 2,
    nextStep: 'Waiting for date #4 to be scheduled',
  },
  {
    id: '2',
    name: 'Sarah',
    age: 23,
    photoUrl: null,
    status: 'researching',
    totalDates: 0,
    lastActivity: '1 hour ago',
    shadchan: 'Mrs. Goldstein',
    unreadMessages: 0,
    nextStep: 'References being checked',
  },
];

const MOCK_FAMILY_MEMBERS = [
  {
    id: '1',
    name: 'Mom',
    relationship: 'mother',
    canViewSuggestions: true,
    canRespond: false,
    lastActive: '1 hour ago',
  },
  {
    id: '2',
    name: 'Dad',
    relationship: 'father',
    canViewSuggestions: true,
    canRespond: true,
    lastActive: '3 hours ago',
  },
];

const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  researching: { label: 'Researching', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
  dating: { label: 'Dating', color: '#4ade80', bgColor: 'rgba(74, 222, 128, 0.15)' },
  serious: { label: 'Getting Serious', color: '#d4af37', bgColor: 'rgba(212, 175, 55, 0.15)' },
  ended: { label: 'Ended', color: '#ff6b6b', bgColor: 'rgba(255, 107, 107, 0.15)' },
};

export default function ConnectionsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'family'>('matches');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

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
        {/* Header */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
          <Text style={styles.hebrewTitle}>קשרים</Text>
          <Text style={styles.title}>Connections</Text>
        </Animated.View>

        {/* Tab Switcher */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.tabSwitcher}>
          <Pressable
            style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
            onPress={() => setActiveTab('matches')}
          >
            <Ionicons
              name="heart-outline"
              size={18}
              color={activeTab === 'matches' ? '#0a1628' : 'rgba(255,255,255,0.6)'}
            />
            <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
              Active Matches
            </Text>
            {MOCK_CONNECTIONS.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'matches' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'matches' && styles.tabBadgeTextActive]}>
                  {MOCK_CONNECTIONS.length}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'family' && styles.tabActive]}
            onPress={() => setActiveTab('family')}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={activeTab === 'family' ? '#0a1628' : 'rgba(255,255,255,0.6)'}
            />
            <Text style={[styles.tabText, activeTab === 'family' && styles.tabTextActive]}>
              Family Portal
            </Text>
          </Pressable>
        </Animated.View>

        {/* Active Matches Tab */}
        {activeTab === 'matches' && (
          <>
            {MOCK_CONNECTIONS.length === 0 ? (
              <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="heart-outline" size={40} color="#d4af37" />
                </View>
                <Text style={styles.emptyTitle}>No Active Connections</Text>
                <Text style={styles.emptyText}>
                  When you and a suggestion both express interest, they'll appear here.
                </Text>
              </Animated.View>
            ) : (
              <>
                {MOCK_CONNECTIONS.map((connection, index) => {
                  const statusInfo = STATUS_MAP[connection.status] || STATUS_MAP.researching;

                  return (
                    <Animated.View
                      key={connection.id}
                      entering={FadeInDown.delay(300 + index * 100)}
                      style={styles.connectionCard}
                    >
                      <Pressable style={styles.connectionContent}>
                        {/* Header */}
                        <View style={styles.connectionHeader}>
                          <View style={styles.connectionLeft}>
                            {connection.photoUrl ? (
                              <Image source={{ uri: connection.photoUrl }} style={styles.avatar} />
                            ) : (
                              <View style={styles.avatarPlaceholder}>
                                <Ionicons name="person" size={24} color="#d4af37" />
                              </View>
                            )}
                            <View style={styles.connectionInfo}>
                              <Text style={styles.connectionName}>
                                {connection.name}, {connection.age}
                              </Text>
                              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                  {statusInfo.label}
                                </Text>
                              </View>
                            </View>
                          </View>
                          {connection.unreadMessages > 0 && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadText}>{connection.unreadMessages}</Text>
                            </View>
                          )}
                        </View>

                        {/* Progress */}
                        <View style={styles.progressSection}>
                          <View style={styles.progressItem}>
                            <Ionicons name="calendar-outline" size={16} color="#d4af37" />
                            <Text style={styles.progressLabel}>
                              {connection.totalDates === 0
                                ? 'Not yet dating'
                                : `${connection.totalDates} dates`}
                            </Text>
                          </View>
                          <View style={styles.progressItem}>
                            <Ionicons name="people-outline" size={16} color="#d4af37" />
                            <Text style={styles.progressLabel}>Via {connection.shadchan}</Text>
                          </View>
                        </View>

                        {/* Next Step */}
                        <View style={styles.nextStepBox}>
                          <Ionicons name="arrow-forward-circle-outline" size={16} color="rgba(255,255,255,0.5)" />
                          <Text style={styles.nextStepText}>{connection.nextStep}</Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.actionRow}>
                          <Pressable style={styles.messageButton}>
                            <Ionicons name="chatbubble-outline" size={16} color="#d4af37" />
                            <Text style={styles.messageText}>Message Shadchan</Text>
                          </Pressable>
                          <Pressable style={styles.viewButton}>
                            <Text style={styles.viewText}>View Details</Text>
                            <Ionicons name="chevron-forward" size={16} color="#d4af37" />
                          </Pressable>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}

                {/* Communication Note */}
                <Animated.View entering={FadeInDown.delay(600)} style={styles.noteBox}>
                  <Ionicons name="information-circle-outline" size={20} color="#d4af37" />
                  <Text style={styles.noteText}>
                    All communication during the early stages goes through your shadchan.
                    This ensures proper guidance and protects both parties.
                  </Text>
                </Animated.View>
              </>
            )}
          </>
        )}

        {/* Family Portal Tab */}
        {activeTab === 'family' && (
          <>
            <Animated.View entering={FadeIn.delay(300)} style={styles.familyHeader}>
              <Text style={styles.familyTitle}>Family Members</Text>
              <Pressable style={styles.inviteButton}>
                <Ionicons name="add" size={18} color="#0a1628" />
                <Text style={styles.inviteText}>Invite</Text>
              </Pressable>
            </Animated.View>

            {MOCK_FAMILY_MEMBERS.length === 0 ? (
              <Animated.View entering={FadeIn.delay(400)} style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="people-outline" size={40} color="#d4af37" />
                </View>
                <Text style={styles.emptyTitle}>No Family Members Connected</Text>
                <Text style={styles.emptyText}>
                  Invite your parents to view suggestions and help with the shidduch process.
                </Text>
                <Pressable style={styles.inviteLargeButton}>
                  <Text style={styles.inviteLargeText}>Invite Family Member</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <>
                {MOCK_FAMILY_MEMBERS.map((member, index) => (
                  <Animated.View
                    key={member.id}
                    entering={FadeInDown.delay(400 + index * 100)}
                    style={styles.familyCard}
                  >
                    <View style={styles.familyCardLeft}>
                      <View style={styles.familyAvatar}>
                        <Ionicons name="person-outline" size={24} color="#d4af37" />
                      </View>
                      <View style={styles.familyInfo}>
                        <Text style={styles.familyName}>{member.name}</Text>
                        <Text style={styles.familyRelationship}>
                          {member.relationship.charAt(0).toUpperCase() + member.relationship.slice(1)}
                        </Text>
                        <Text style={styles.familyLastActive}>Active {member.lastActive}</Text>
                      </View>
                    </View>
                    <View style={styles.familyPermissions}>
                      <View style={styles.permissionItem}>
                        <Ionicons
                          name={member.canViewSuggestions ? 'eye' : 'eye-off'}
                          size={14}
                          color={member.canViewSuggestions ? '#4ade80' : 'rgba(255,255,255,0.3)'}
                        />
                        <Text style={[
                          styles.permissionText,
                          !member.canViewSuggestions && styles.permissionTextDisabled,
                        ]}>
                          Can view
                        </Text>
                      </View>
                      <View style={styles.permissionItem}>
                        <Ionicons
                          name={member.canRespond ? 'chatbubble' : 'chatbubble-outline'}
                          size={14}
                          color={member.canRespond ? '#4ade80' : 'rgba(255,255,255,0.3)'}
                        />
                        <Text style={[
                          styles.permissionText,
                          !member.canRespond && styles.permissionTextDisabled,
                        ]}>
                          Can respond
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                ))}

                {/* Family Info */}
                <Animated.View entering={FadeInDown.delay(700)} style={styles.familyInfoBox}>
                  <View style={styles.familyInfoHeader}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#d4af37" />
                    <Text style={styles.familyInfoTitle}>Family Involvement</Text>
                  </View>
                  <Text style={styles.familyInfoText}>
                    Connected family members can view your suggestions and help research potential
                    matches. You control their permissions and can revoke access at any time.
                  </Text>
                  <Pressable style={styles.manageButton}>
                    <Text style={styles.manageText}>Manage Permissions</Text>
                  </Pressable>
                </Animated.View>
              </>
            )}
          </>
        )}
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
  header: {
    marginBottom: 20,
  },
  hebrewTitle: {
    fontSize: 32,
    color: '#d4af37',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#d4af37',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  tabTextActive: {
    color: '#0a1628',
  },
  tabBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(10, 22, 40, 0.3)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d4af37',
  },
  tabBadgeTextActive: {
    color: '#0a1628',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  connectionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    overflow: 'hidden',
  },
  connectionContent: {
    padding: 16,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  connectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  connectionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  connectionName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#d4af37',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a1628',
  },
  progressSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  nextStepBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  nextStepText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    gap: 6,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d4af37',
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    gap: 4,
  },
  viewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d4af37',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  familyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  familyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4af37',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a1628',
  },
  inviteLargeButton: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  inviteLargeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a1628',
  },
  familyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  familyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  familyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  familyInfo: {
    marginLeft: 12,
  },
  familyName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  familyRelationship: {
    fontSize: 12,
    color: '#d4af37',
    marginBottom: 2,
  },
  familyLastActive: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  familyPermissions: {
    gap: 4,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  permissionText: {
    fontSize: 11,
    color: '#4ade80',
  },
  permissionTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  familyInfoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  familyInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  familyInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  familyInfoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    marginBottom: 14,
  },
  manageButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  manageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d4af37',
  },
});
