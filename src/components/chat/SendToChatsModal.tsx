/**
 * Send to Chats Modal
 *
 * Modal for selecting chats to send a profile or filters to
 * Used by both users and Saftas
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

// Types
interface ChatItem {
  id: string;
  name: string;
  photo: string;
  isSafta?: boolean;
  relationship?: string;
  lastActive?: string;
}

interface ProfileToSend {
  id: string;
  name: string;
  age: number;
  photo: string;
}

interface FiltersToSend {
  ageRange: [number, number];
  distance: number;
  jewishBackgrounds: string[];
}

interface SendToChatsModalProps {
  visible: boolean;
  onClose: () => void;
  profile?: ProfileToSend;
  filters?: FiltersToSend;
  onSend: (chatIds: string[], message?: string) => void;
  title?: string;
}

// Sample chat data - in production this would come from your API
const SAMPLE_CHATS: ChatItem[] = [
  {
    id: 'safta-1',
    name: 'Bubbe Ruth',
    photo: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=200',
    isSafta: true,
    relationship: 'Grandmother',
    lastActive: 'Online',
  },
  {
    id: 'match-1',
    name: 'Rachel',
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200',
    lastActive: '2h ago',
  },
  {
    id: 'match-2',
    name: 'David',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    lastActive: '1d ago',
  },
];

function ChatItemCard({
  chat,
  selected,
  onToggle,
}: {
  chat: ChatItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={[styles.chatItem, selected && styles.chatItemSelected]}
      onPress={onToggle}
    >
      <View style={styles.chatAvatarContainer}>
        <Image source={{ uri: chat.photo }} style={styles.chatAvatar} />
        {chat.isSafta && (
          <View style={styles.saftaBadge}>
            <Text style={styles.saftaBadgeText}>👵</Text>
          </View>
        )}
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{chat.name}</Text>
        {chat.isSafta ? (
          <Text style={styles.chatSubtitle}>{chat.relationship}</Text>
        ) : (
          <Text style={styles.chatSubtitle}>{chat.lastActive}</Text>
        )}
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && <Ionicons name="checkmark" size={16} color={colors.primary.navy} />}
      </View>
    </Pressable>
  );
}

export function SendToChatsModal({
  visible,
  onClose,
  profile,
  filters,
  onSend,
  title = 'Send to Chat',
}: SendToChatsModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter chats based on search
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return SAMPLE_CHATS;
    const query = searchQuery.toLowerCase();
    return SAMPLE_CHATS.filter((chat) =>
      chat.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Separate saftas and matches
  const { saftas, matches } = useMemo(() => ({
    saftas: filteredChats.filter((c) => c.isSafta),
    matches: filteredChats.filter((c) => !c.isSafta),
  }), [filteredChats]);

  const handleToggleChat = useCallback((chatId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChats((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  }, []);

  const handleSend = useCallback(() => {
    if (selectedChats.length === 0) {
      Alert.alert('Select a Chat', 'Please select at least one chat to send to.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSend(selectedChats, message.trim() || undefined);
    // Reset state
    setSelectedChats([]);
    setMessage('');
    setSearchQuery('');
    onClose();
  }, [selectedChats, message, onSend, onClose]);

  const handleClose = useCallback(() => {
    setSelectedChats([]);
    setMessage('');
    setSearchQuery('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.transparent.white70} />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Preview what's being sent */}
        {profile && (
          <View style={styles.previewSection}>
            <Image source={{ uri: profile.photo }} style={styles.previewPhoto} />
            <View style={styles.previewInfo}>
              <Text style={styles.previewLabel}>Sending profile</Text>
              <Text style={styles.previewName}>{profile.name}, {profile.age}</Text>
            </View>
          </View>
        )}

        {filters && (
          <View style={styles.previewSection}>
            <View style={styles.filterIconContainer}>
              <Ionicons name="options" size={24} color={colors.primary.gold} />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewLabel}>Sending filters</Text>
              <Text style={styles.previewFilters}>
                Ages {filters.ageRange[0]}-{filters.ageRange[1]}, {filters.distance}mi
              </Text>
            </View>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.transparent.white40} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats..."
            placeholderTextColor={colors.transparent.white40}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.transparent.white40} />
            </Pressable>
          )}
        </View>

        {/* Chat List */}
        <ScrollView style={styles.chatList} contentContainerStyle={styles.chatListContent}>
          {/* Saftas Section */}
          {saftas.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Saftas</Text>
              {saftas.map((chat) => (
                <ChatItemCard
                  key={chat.id}
                  chat={chat}
                  selected={selectedChats.includes(chat.id)}
                  onToggle={() => handleToggleChat(chat.id)}
                />
              ))}
            </View>
          )}

          {/* Matches Section */}
          {matches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Matches</Text>
              {matches.map((chat) => (
                <ChatItemCard
                  key={chat.id}
                  chat={chat}
                  selected={selectedChats.includes(chat.id)}
                  onToggle={() => handleToggleChat(chat.id)}
                />
              ))}
            </View>
          )}

          {filteredChats.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No chats found</Text>
            </View>
          )}
        </ScrollView>

        {/* Message Input */}
        <View style={styles.messageSection}>
          <Text style={styles.messageLabel}>Add a message (optional)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder={profile ? "Why do you think they'd be a great match?" : "Any notes about these filters?"}
            placeholderTextColor={colors.transparent.white30}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={200}
          />
        </View>

        {/* Send Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
          <Pressable
            style={[styles.sendButton, selectedChats.length === 0 && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={selectedChats.length === 0}
          >
            <Ionicons name="send" size={20} color={colors.primary.navy} />
            <Text style={styles.sendButtonText}>
              Send{selectedChats.length > 0 ? ` to ${selectedChats.length} chat${selectedChats.length > 1 ? 's' : ''}` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.transparent.white10,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.white,
  },
  placeholder: {
    width: 40,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.transparent.gold10,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  previewPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  filterIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.transparent.gold20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 12,
    color: colors.transparent.white50,
    marginBottom: spacing[0.5],
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  previewFilters: {
    fontSize: 14,
    color: colors.primary.gold,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primary.white,
    paddingVertical: spacing[1],
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.transparent.white50,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
    gap: spacing[3],
  },
  chatItemSelected: {
    backgroundColor: colors.transparent.gold10,
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  chatAvatarContainer: {
    position: 'relative',
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  saftaBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.dark.card,
  },
  saftaBadgeText: {
    fontSize: 10,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.white,
  },
  chatSubtitle: {
    fontSize: 13,
    color: colors.transparent.white50,
    marginTop: spacing[0.5],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.transparent.white30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary.gold,
    borderColor: colors.primary.gold,
  },
  emptyState: {
    padding: spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.transparent.white50,
  },
  messageSection: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.transparent.white10,
  },
  messageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.transparent.white60,
    marginBottom: spacing[2],
  },
  messageInput: {
    backgroundColor: colors.dark.card,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 15,
    color: colors.primary.white,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  footer: {
    padding: spacing[4],
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary.gold,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.navy,
  },
});
