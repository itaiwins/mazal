/**
 * Interstitial Ad Hook
 *
 * Shows full-screen interstitial ads after every X swipes.
 * Premium users (Gold/Platinum) never see interstitial ads.
 *
 * NOTE: Ads require a development build. They won't work in Expo Go.
 */

import { useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { usePremiumStore } from '@/stores/premiumStore';

// Same env var as src/lib/config/ads.ts, read inline on purpose: Metro inlines
// `process.env.EXPO_PUBLIC_*` as a literal per module, so reading it here lets the
// minifier fold the ternary below and strip the real unit IDs out of the bundle
// entirely. An imported const would leave them in as reachable-looking strings.
const USE_TEST_ADS = process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';

// Check if we're running in Expo Go (ads don't work there)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy load the ads module only when not in Expo Go
let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;
let interstitial: any = null;

if (!isExpoGo) {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    InterstitialAd = adsModule.InterstitialAd;
    AdEventType = adsModule.AdEventType;
    TestIds = adsModule.TestIds;
  } catch (e) {
    console.log('[useInterstitialAd] Google Mobile Ads module not available');
  }
}

// Interstitial Ad Unit IDs. Test units everywhere except a public App Store
// release, so our own testers never generate real impressions (src/lib/config/ads.ts).
const AD_UNIT_IDS = {
  ios: (__DEV__ || USE_TEST_ADS) ? TestIds?.INTERSTITIAL : 'ca-app-pub-3550432802315468/6025855781',
  android: (__DEV__ || USE_TEST_ADS) ? TestIds?.INTERSTITIAL : 'ca-app-pub-3550432802315468/8564389211',
};

const getInterstitialAdUnitId = () => {
  return Platform.select({
    ios: AD_UNIT_IDS.ios,
    android: AD_UNIT_IDS.android,
    default: TestIds?.INTERSTITIAL,
  });
};

// Show interstitial every X swipes
const SWIPES_BETWEEN_ADS = 10;

// Create the interstitial ad instance (only if module is available)
if (InterstitialAd && !isExpoGo) {
  const unitId = getInterstitialAdUnitId();
  if (unitId) {
    try {
      interstitial = InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
      });
    } catch (e) {
      console.log('[useInterstitialAd] Failed to create interstitial ad');
    }
  }
}

export function useInterstitialAd() {
  const entitlements = usePremiumStore((s) => s.entitlements);
  const swipeCountRef = useRef(0);
  const isLoadedRef = useRef(false);

  // Don't show ads to Gold or Platinum users
  const isPremium = entitlements.plan === 'mazal_gold' || entitlements.plan === 'mazal_platinum';

  // Check if ads are available
  const adsAvailable = !isExpoGo && interstitial !== null && AdEventType !== null;

  // Load the ad
  useEffect(() => {
    if (isPremium || !adsAvailable) return;

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      isLoadedRef.current = true;
      console.log('Interstitial ad loaded');
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      isLoadedRef.current = false;
      // Preload the next ad
      interstitial.load();
    });

    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
      console.log('Interstitial ad error:', error);
      isLoadedRef.current = false;
    });

    // Initial load
    interstitial.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, [isPremium, adsAvailable]);

  // Track swipe and show ad if needed
  const trackSwipe = useCallback(() => {
    if (isPremium || !adsAvailable) return;

    swipeCountRef.current += 1;

    if (swipeCountRef.current >= SWIPES_BETWEEN_ADS) {
      if (isLoadedRef.current) {
        interstitial.show();
        swipeCountRef.current = 0;
      }
    }
  }, [isPremium, adsAvailable]);

  // Force show ad (e.g., when leaving a screen)
  const showAdIfLoaded = useCallback(() => {
    if (isPremium || !adsAvailable) return false;

    if (isLoadedRef.current) {
      interstitial.show();
      swipeCountRef.current = 0;
      return true;
    }
    return false;
  }, [isPremium, adsAvailable]);

  return {
    trackSwipe,
    showAdIfLoaded,
    swipeCount: swipeCountRef.current,
  };
}

export default useInterstitialAd;
