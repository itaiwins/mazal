/**
 * Web shim: a module that exports nothing.  (MEXA-328, see ../../metro.config.js)
 *
 * Stands in for react-native-google-mobile-ads and react-native-maps when the app is
 * exported for web to be screenshotted. Every consumer of those two loads them with a
 * guarded `require()` and falls back when a member comes back undefined:
 *
 *   AdBanner.tsx            BannerAd === undefined  -> renders null (no banner)
 *   useInterstitialAd.ts    InterstitialAd undefined -> adsAvailable false, no-op hook
 *   mazal-map.tsx           MapView undefined       -> renders its own "map unavailable" screen
 *
 * Exporting nothing is the point. A fake banner or a picture of a map would let a
 * reviewer sign off on something the app has never actually drawn.
 */

module.exports = {};
