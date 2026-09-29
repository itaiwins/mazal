/**
 * Metro config - web screenshot shims only.  (MEXA-328)
 *
 * The app has no web target. It is exported for web only to render every screen for
 * a reviewer who cannot run an iOS build (MEXA-273). Three native-only packages have
 * no web implementation and break the web bundle at resolve time:
 *
 *   react-native-google-mobile-ads   imports react-native/Libraries/.../codegenNativeComponent
 *   react-native-maps                native view, Google/Apple Maps SDK
 *   react-native-purchases           native StoreKit / Play Billing bridge
 *
 * All three are already loaded through a guarded `require()` in a try/catch in app
 * code (AdBanner.tsx, useInterstitialAd.ts, mazal-map.tsx), so the app's own
 * "module not available" branch is what renders once the shim returns nothing. The
 * shims deliberately export nothing usable rather than a stand-in view: a reviewer
 * must not mistake a placeholder for the real ad slot, map or paywall.
 *
 * INERT UNLESS ASKED FOR. Two guards, both required:
 *   1. MAZAL_WEB_SHIMS=1 in the environment, and
 *   2. platform === 'web' for the module being resolved.
 * So `eas build`, `expo run:ios` and `expo start` are untouched by this file.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

if (process.env.MAZAL_WEB_SHIMS === '1') {
  const SHIMS = {
    'react-native-google-mobile-ads': path.join(__dirname, 'walkthrough/web-shims/empty.js'),
    'react-native-maps': path.join(__dirname, 'walkthrough/web-shims/empty.js'),
    'react-native-purchases': path.join(__dirname, 'walkthrough/web-shims/react-native-purchases.js'),
  };

  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && SHIMS[moduleName]) {
      return { type: 'sourceFile', filePath: SHIMS[moduleName] };
    }
    return (upstream || context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
