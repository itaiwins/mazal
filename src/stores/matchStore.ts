/**
 * Match Store
 *
 * Manages matches and match-related state
 */

import { create } from 'zustand';
import type { MatchWithUser } from '@/types';

interface MatchState {
  // Matches
  matches: MatchWithUser[];
  totalMatches: number;
  unreadMatchesCount: number;

  // Current match celebration
  newMatch: MatchWithUser | null;
  showMatchCelebration: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setMatches: (matches: MatchWithUser[]) => void;
  addMatch: (match: MatchWithUser) => void;
  removeMatch: (matchId: string) => void;
  updateMatch: (matchId: string, updates: Partial<MatchWithUser>) => void;
  setNewMatch: (match: MatchWithUser | null) => void;
  showCelebration: (match: MatchWithUser) => void;
  hideCelebration: () => void;
  markMatchAsRead: (matchId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  matches: [],
  totalMatches: 0,
  unreadMatchesCount: 0,
  newMatch: null,
  showMatchCelebration: false,
  isLoading: false,
  error: null,
};

export const useMatchStore = create<MatchState>()((set, get) => ({
  ...initialState,

  setMatches: (matches) =>
    set({
      matches,
      totalMatches: matches.length,
      unreadMatchesCount: matches.filter((m) => m.unread_count > 0).length,
    }),

  addMatch: (match) =>
    set((state) => ({
      matches: [match, ...state.matches],
      totalMatches: state.totalMatches + 1,
    })),

  removeMatch: (matchId) =>
    set((state) => ({
      matches: state.matches.filter((m) => m.id !== matchId),
      totalMatches: state.totalMatches - 1,
    })),

  updateMatch: (matchId, updates) =>
    set((state) => ({
      matches: state.matches.map((m) =>
        m.id === matchId ? { ...m, ...updates } : m
      ),
    })),

  setNewMatch: (newMatch) => set({ newMatch }),

  showCelebration: (match) =>
    set({
      newMatch: match,
      showMatchCelebration: true,
    }),

  hideCelebration: () =>
    set({
      showMatchCelebration: false,
      newMatch: null,
    }),

  markMatchAsRead: (matchId) =>
    set((state) => {
      const match = state.matches.find((m) => m.id === matchId);
      if (match && match.unread_count > 0) {
        return {
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, unread_count: 0 } : m
          ),
          unreadMatchesCount: state.unreadMatchesCount - 1,
        };
      }
      return state;
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));

// Selectors
export const selectMatchById = (matchId: string) => (state: MatchState) =>
  state.matches.find((m) => m.id === matchId);

export const selectRecentMatches = (limit: number = 5) => (state: MatchState) =>
  state.matches.slice(0, limit);
