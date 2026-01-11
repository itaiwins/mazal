/**
 * Message Store
 *
 * Manages messaging state, conversations, and real-time updates
 */

import { create } from 'zustand';
import type { MessageWithSender } from '@/types';

interface Conversation {
  matchId: string;
  messages: MessageWithSender[];
  isLoading: boolean;
  hasMore: boolean;
  cursor: string | null;
}

interface MessageState {
  // Conversations
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;

  // Typing indicators
  typingUsers: Record<string, boolean>; // matchId -> isTyping

  // Message drafts
  drafts: Record<string, string>; // matchId -> draft text

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  initConversation: (matchId: string) => void;
  setMessages: (matchId: string, messages: MessageWithSender[], hasMore: boolean, cursor: string | null) => void;
  addMessage: (matchId: string, message: MessageWithSender) => void;
  addMessages: (matchId: string, messages: MessageWithSender[], cursor: string | null) => void;
  updateMessage: (matchId: string, messageId: string, updates: Partial<MessageWithSender>) => void;
  markMessagesAsRead: (matchId: string) => void;
  setActiveConversation: (matchId: string | null) => void;
  setTyping: (matchId: string, isTyping: boolean) => void;
  setDraft: (matchId: string, text: string) => void;
  clearDraft: (matchId: string) => void;
  setConversationLoading: (matchId: string, loading: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  conversations: {},
  activeConversationId: null,
  typingUsers: {},
  drafts: {},
  isLoading: false,
  error: null,
};

export const useMessageStore = create<MessageState>()((set, get) => ({
  ...initialState,

  initConversation: (matchId) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [matchId]: state.conversations[matchId] || {
          matchId,
          messages: [],
          isLoading: false,
          hasMore: true,
          cursor: null,
        },
      },
    })),

  setMessages: (matchId, messages, hasMore, cursor) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [matchId]: {
          matchId,
          messages,
          isLoading: false,
          hasMore,
          cursor,
        },
      },
    })),

  addMessage: (matchId, message) =>
    set((state) => {
      const conversation = state.conversations[matchId];
      if (!conversation) return state;

      // Check for duplicate
      if (conversation.messages.some((m) => m.id === message.id)) {
        return state;
      }

      return {
        conversations: {
          ...state.conversations,
          [matchId]: {
            ...conversation,
            messages: [...conversation.messages, message],
          },
        },
      };
    }),

  addMessages: (matchId, messages, cursor) =>
    set((state) => {
      const conversation = state.conversations[matchId];
      if (!conversation) return state;

      // Filter out duplicates
      const existingIds = new Set(conversation.messages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));

      return {
        conversations: {
          ...state.conversations,
          [matchId]: {
            ...conversation,
            messages: [...newMessages, ...conversation.messages],
            hasMore: messages.length > 0,
            cursor,
            isLoading: false,
          },
        },
      };
    }),

  updateMessage: (matchId, messageId, updates) =>
    set((state) => {
      const conversation = state.conversations[matchId];
      if (!conversation) return state;

      return {
        conversations: {
          ...state.conversations,
          [matchId]: {
            ...conversation,
            messages: conversation.messages.map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          },
        },
      };
    }),

  markMessagesAsRead: (matchId) =>
    set((state) => {
      const conversation = state.conversations[matchId];
      if (!conversation) return state;

      return {
        conversations: {
          ...state.conversations,
          [matchId]: {
            ...conversation,
            messages: conversation.messages.map((m) => ({
              ...m,
              is_read: true,
            })),
          },
        },
      };
    }),

  setActiveConversation: (activeConversationId) =>
    set({ activeConversationId }),

  setTyping: (matchId, isTyping) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [matchId]: isTyping,
      },
    })),

  setDraft: (matchId, text) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [matchId]: text,
      },
    })),

  clearDraft: (matchId) =>
    set((state) => {
      const { [matchId]: _, ...rest } = state.drafts;
      return { drafts: rest };
    }),

  setConversationLoading: (matchId, loading) =>
    set((state) => {
      const conversation = state.conversations[matchId];
      if (!conversation) return state;

      return {
        conversations: {
          ...state.conversations,
          [matchId]: {
            ...conversation,
            isLoading: loading,
          },
        },
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));

// Selectors
export const selectConversation = (matchId: string) => (state: MessageState) =>
  state.conversations[matchId];

export const selectMessages = (matchId: string) => (state: MessageState) =>
  state.conversations[matchId]?.messages ?? [];

export const selectIsTyping = (matchId: string) => (state: MessageState) =>
  state.typingUsers[matchId] ?? false;

export const selectDraft = (matchId: string) => (state: MessageState) =>
  state.drafts[matchId] ?? '';
