/**
 * Web shim: react-native-purchases.  (MEXA-328, see ../../metro.config.js)
 *
 * RevenueCat is a native StoreKit / Play Billing bridge, so it cannot be bundled for
 * web at all. Unlike the ads and maps modules, `src/lib/config/revenuecat.ts` imports
 * it statically, so the module has to exist for the bundle to resolve.
 *
 * Every method rejects. That is not a stand-in for the store: the app's own
 * try/catch in revenuecat.ts turns each rejection into the same "offerings
 * unavailable" state a device with no App Store connection is in, which is what the
 * paywall then draws. Since MEXA-387 that state shows no price at all: the web
 * paywall draws "Prices unavailable, check your connection" with Subscribe
 * disabled, which is what walkthrough/check-paywall-prices.mjs asserts. Before
 * MEXA-387 it fell back to the app's own hardcoded copy. Either way the real
 * price rows come from App Store Connect and can only be seen on a device.
 *
 * `configure()` is never reached in practice: initializeRevenueCat() returns early
 * because neither EXPO_PUBLIC_REVENUECAT_*_KEY is set in .env.
 */

const unavailable = (name) => () =>
  Promise.reject(new Error(`[web-shim] Purchases.${name} is native-only (MEXA-328)`));

const Purchases = {
  setLogLevel: () => {},
  configure: unavailable('configure'),
  logIn: unavailable('logIn'),
  logOut: unavailable('logOut'),
  getCustomerInfo: unavailable('getCustomerInfo'),
  getOfferings: unavailable('getOfferings'),
  purchasePackage: unavailable('purchasePackage'),
  restorePurchases: unavailable('restorePurchases'),
  addCustomerInfoUpdateListener: () => () => {},
};

module.exports = Purchases;
module.exports.default = Purchases;
module.exports.LOG_LEVEL = { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };
