/**
 * Store Exports
 *
 * Central export point for all Zustand stores
 */

export { useAuthStore, selectIsAuthenticated, selectUser, selectIsOnboardingComplete, selectIsLoading } from './authStore';
export { useUserStore } from './userStore';
export { useDiscoveryStore, selectCurrentProfile, selectHasMoreProfiles, selectRemainingProfiles } from './discoveryStore';
export { useMatchStore, selectMatchById, selectRecentMatches } from './matchStore';
export { useMessageStore, selectConversation, selectMessages, selectIsTyping, selectDraft } from './messageStore';
export { useUIStore, useModal, useSheet, useToasts } from './uiStore';
export type { ModalType, SheetType, Toast } from './uiStore';
export { useOnboardingStore, selectProgress, selectIsLastStep, selectIsFirstStep } from './onboardingStore';
export { usePremiumStore, selectIsPremium, selectPlan, selectCanSuperLike, selectCanBoost } from './premiumStore';

/**
 * Reset all stores (for logout)
 */
export function resetAllStores() {
  const { reset: resetAuth } = require('./authStore').useAuthStore.getState();
  const { reset: resetUser } = require('./userStore').useUserStore.getState();
  const { reset: resetDiscovery } = require('./discoveryStore').useDiscoveryStore.getState();
  const { reset: resetMatch } = require('./matchStore').useMatchStore.getState();
  const { reset: resetMessage } = require('./messageStore').useMessageStore.getState();
  const { reset: resetUI } = require('./uiStore').useUIStore.getState();
  const { reset: resetOnboarding } = require('./onboardingStore').useOnboardingStore.getState();
  const { reset: resetPremium } = require('./premiumStore').usePremiumStore.getState();

  resetAuth();
  resetUser();
  resetDiscovery();
  resetMatch();
  resetMessage();
  resetUI();
  resetOnboarding();
  resetPremium();
}
