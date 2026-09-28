/**
 * Ad Banner Component
 *
 * Shows banner ads only to free users.
 * Gold and Platinum subscribers see no ads.
 *
 * NOTE: Ads require a development build. They won't work in Expo Go.
 */

import { useState, useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { usePremiumStore } from '@/stores/premiumStore';
import { useUIStore } from '@/stores/uiStore';

// Same env var as src/lib/config/ads.ts, read inline on purpose: Metro inlines
// `process.env.EXPO_PUBLIC_*` as a literal per module, so reading it here lets the
// minifier fold the ternary below and strip the real unit IDs out of the bundle
// entirely. An imported const would leave them in as reachable-looking strings.
const USE_TEST_ADS = process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';

// Check if we're running in Expo Go (ads don't work there)
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy load the ads module only when not in Expo Go
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

if (!isExpoGo) {
  try {
    const adsModule = require('react-native-google-mobile-ads');
    BannerAd = adsModule.BannerAd;
    BannerAdSize = adsModule.BannerAdSize;
    TestIds = adsModule.TestIds;
  } catch (e) {
    console.log('[AdBanner] Google Mobile Ads module not available');
  }
}

// Ad Unit IDs. Test units everywhere except a public App Store release, so our
// own testers never generate real impressions (see src/lib/config/ads.ts).
const AD_UNIT_IDS = {
  ios: {
    banner: (__DEV__ || USE_TEST_ADS) ? TestIds?.BANNER : 'ca-app-pub-3550432802315468/2502393800',
  },
  android: {
    banner: (__DEV__ || USE_TEST_ADS) ? TestIds?.BANNER : 'ca-app-pub-3550432802315468/8876230461',
  },
};

const getBannerAdUnitId = () => {
  return Platform.select({
    ios: AD_UNIT_IDS.ios.banner,
    android: AD_UNIT_IDS.android.banner,
    default: TestIds?.BANNER,
  });
};

type AdBannerProps = {
  size?: any;
};

export function AdBanner({ size }: AdBannerProps) {
  const entitlements = usePremiumStore((s) => s.entitlements);
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const [adsAvailable, setAdsAvailable] = useState(false);

  useEffect(() => {
    // Check if ads module is available
    setAdsAvailable(!isExpoGo && BannerAd !== null);
  }, []);

  // Don't show ads to Gold or Platinum users
  const isPremium = entitlements.plan === 'mazal_gold' || entitlements.plan === 'mazal_platinum';

  // Don't render if premium, in demo mode (for screenshots), in Expo Go, or ads not available
  if (isPremium || isDemoMode || isExpoGo || !adsAvailable || !BannerAd) {
    return null;
  }

  const adSize = size || BannerAdSize?.ANCHORED_ADAPTIVE_BANNER;
  const unitId = getBannerAdUnitId();

  if (!unitId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={unitId}
        size={adSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          console.log('Ad loaded');
        }}
        onAdFailedToLoad={(error: any) => {
          console.log('Ad failed to load:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdBanner;
