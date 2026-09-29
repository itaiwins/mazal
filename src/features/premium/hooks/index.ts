/**
 * Premium Hooks Index
 *
 * Export all premium-related hooks
 */

export {
  usePremium,
  useFeatureGate,
  useSuperLikes,
  useSwipeLimits,
  useBoost,
  usePaywall,
} from './usePremium';

export { useOrthodoxEntitlement } from './useOrthodoxEntitlement';
export { useEntitlement } from './useEntitlement';
export type { EntitlementOutcome } from './useEntitlement';
