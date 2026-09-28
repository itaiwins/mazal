/**
 * Ad Configuration
 *
 * Build-time switch between Google's reserved test ad units and Mazal's real
 * AdMob units.
 *
 * Serving real ads to our own testers is an AdMob policy violation (invalid
 * traffic) and can get the account suspended, so every build that is not a
 * public App Store release must use test ads. `EXPO_PUBLIC_*` is inlined by
 * Metro at build time, so the real unit IDs are dead code when this is on.
 *
 * Pinned to "true" in every eas.json build profile. See docs/ROADMAP.md before
 * flipping it: that needs Itai's sign-off and only happens for the public
 * App Store release.
 *
 * NOTE: AdBanner.tsx and useInterstitialAd.ts deliberately read the env var
 * inline instead of importing this. Metro inlines `process.env.EXPO_PUBLIC_*`
 * per module, so an inline read lets the minifier fold the test/real ternary and
 * drop the real unit ID strings from the bundle; importing a const from here
 * defeats that (verified: the IDs stay in the .hbc). Both read the same variable,
 * so the value can never diverge. Use this export anywhere else that needs the flag.
 */
export const USE_TEST_ADS = process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';
