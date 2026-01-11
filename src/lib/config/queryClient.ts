/**
 * React Query Configuration
 *
 * Configures the QueryClient with optimal defaults for a mobile dating app
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * Create QueryClient with optimized settings
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh
      staleTime: 1000 * 60 * 5, // 5 minutes

      // GC time: how long inactive data stays in cache
      gcTime: 1000 * 60 * 30, // 30 minutes

      // Retry logic
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch settings
      refetchOnWindowFocus: false, // Mobile doesn't have window focus
      refetchOnReconnect: true, // Refetch when network comes back
      refetchOnMount: true,

      // Network mode
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * Query Keys Factory
 *
 * Centralized query key definitions for type safety and consistency
 */
export const queryKeys = {
  // User
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    preferences: () => [...queryKeys.user.all, 'preferences'] as const,
    photos: () => [...queryKeys.user.all, 'photos'] as const,
    prompts: () => [...queryKeys.user.all, 'prompts'] as const,
    badges: () => [...queryKeys.user.all, 'badges'] as const,
  },

  // Discovery
  discovery: {
    all: ['discovery'] as const,
    profiles: (filters: Record<string, unknown>) =>
      [...queryKeys.discovery.all, 'profiles', filters] as const,
    profile: (id: string) =>
      [...queryKeys.discovery.all, 'profile', id] as const,
  },

  // Matches
  matches: {
    all: ['matches'] as const,
    list: () => [...queryKeys.matches.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.matches.all, 'detail', id] as const,
  },

  // Messages
  messages: {
    all: ['messages'] as const,
    conversation: (matchId: string) =>
      [...queryKeys.messages.all, 'conversation', matchId] as const,
    unread: () => [...queryKeys.messages.all, 'unread'] as const,
  },

  // Safta
  safta: {
    all: ['safta'] as const,
    account: () => [...queryKeys.safta.all, 'account'] as const,
    connections: () => [...queryKeys.safta.all, 'connections'] as const,
    likes: () => [...queryKeys.safta.all, 'likes'] as const,
    likesForUser: (userId: string) =>
      [...queryKeys.safta.all, 'likes', userId] as const,
  },

  // Locations
  locations: {
    all: ['locations'] as const,
    saved: () => [...queryKeys.locations.all, 'saved'] as const,
    colleges: (query?: string) =>
      [...queryKeys.locations.all, 'colleges', query] as const,
    nearby: (lat: number, lng: number, radius: number) =>
      [...queryKeys.locations.all, 'nearby', lat, lng, radius] as const,
  },

  // Premium
  premium: {
    all: ['premium'] as const,
    entitlements: () => [...queryKeys.premium.all, 'entitlements'] as const,
    offerings: () => [...queryKeys.premium.all, 'offerings'] as const,
  },

  // Swipes
  swipes: {
    all: ['swipes'] as const,
    likes: () => [...queryKeys.swipes.all, 'likes'] as const,
    whoLikedMe: () => [...queryKeys.swipes.all, 'who-liked-me'] as const,
  },
} as const;

/**
 * QueryClientProvider wrapper component
 */
interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children
  );
}

/**
 * Invalidate all user-related queries (e.g., after profile update)
 */
export function invalidateUserQueries() {
  queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
}

/**
 * Invalidate discovery queries (e.g., after filter change)
 */
export function invalidateDiscoveryQueries() {
  queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
}

/**
 * Invalidate matches queries (e.g., after new match)
 */
export function invalidateMatchesQueries() {
  queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
}

/**
 * Clear all queries and cache (e.g., on logout)
 */
export function clearAllQueries() {
  queryClient.clear();
}
