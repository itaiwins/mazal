/**
 * App Constants
 *
 * Application-wide constants and configuration
 */

export const APP_NAME = 'Mazal';
export const APP_TAGLINE = "L'chaim to love";

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const DISCOVERY_BATCH_SIZE = 10;
export const MESSAGES_PAGE_SIZE = 50;

// Limits
export const MAX_PHOTOS = 6;
export const MIN_PHOTOS = 2;
export const MAX_PROMPTS = 3;
export const MIN_PROMPTS = 2;
export const MAX_BIO_LENGTH = 500;
export const MAX_PROMPT_ANSWER_LENGTH = 300;
export const MAX_SAFTA_CONNECTIONS = 5;

/**
 * Shortest password the app will let someone choose.
 *
 * This is a **client-only** rule and it is stricter than the server's: the Supabase
 * project's own `password_min_length` is 6. So an account created before this, or
 * through any other route, can legitimately have a 6- or 7-character password —
 * never gate a *current*-password field on this, only a new one (MEXA-264).
 *
 * It used to be declared separately in the two password screens and written as a bare
 * `8` in three more, which is five places to disagree with each other.
 */
export const MIN_PASSWORD_LENGTH = 8;

// Age
export const MIN_AGE = 18;
export const MAX_AGE = 99;
export const DEFAULT_AGE_RANGE = { min: 22, max: 35 };

// Distance (miles)
export const MIN_DISTANCE = 1;
export const MAX_DISTANCE = 100;
export const DEFAULT_DISTANCE = 25;

// Swipe thresholds
export const SWIPE_THRESHOLD = 0.4; // 40% of screen width
export const SWIPE_VELOCITY_THRESHOLD = 500; // px/s

// Animation durations (ms)
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  celebration: 2500,
  cardSwipe: 250,
} as const;

// DEAD. The free tier lives in `FEATURE_LIMITS.free` in `src/lib/config/revenuecat.ts`.
//
// Removed rather than left in place (MEXA-373): `git grep FREE_TIER` found only this
// definition - nothing has ever imported it - and it disagreed with the live tier on both
// axes. It said `dailyLikes: 25` where `FEATURE_LIMITS.free` says `dailySwipes: 25` (a cap on
// *likes* and a cap on *swipes* are different products, because passes count), and
// `superLikesPerDay: 1` where the real limit is `superLikesPerWeek: 1`.
//
// That cost real time: Gojo's MEXA-373 scope quoted this constant, which made item 2 look
// like it needed a product decision between two rival free tiers, and `rewinds: 0` made
// item 3 look like it would refuse every caller. Both readings came from a constant no code
// has ever run. Migration 00035 enforces `FEATURE_LIMITS.free` server-side.
//
// If you are looking for the free tier: `FEATURE_LIMITS` in `src/lib/config/revenuecat.ts`
// is what `premiumStore` counts against and what `00035_server_side_swipe_quota.sql` encodes.

// Premium tiers
export const PREMIUM_TIERS = {
  mazal_plus: {
    name: 'Mazal Plus',
    price: 19.99,
    dailyLikes: 100,
    superLikesPerDay: 5,
    rewinds: Infinity,
    boostsPerMonth: 1,
  },
  mazal_gold: {
    name: 'Mazal Gold',
    price: 34.99,
    dailyLikes: Infinity,
    superLikesPerDay: Infinity,
    rewinds: Infinity,
    boostsPerMonth: 4,
  },
} as const;

// ELO scoring
export const ELO = {
  initial: 1000,
  kFactor: 32,
  min: 100,
  max: 2500,
} as const;

// Shabbat mode defaults
export const SHABBAT_MODE = {
  defaultStart: '18:00',
  defaultEnd: '21:00',
  autoReplyMessage: "I have Shabbat Mode on and will respond after Shabbat. Shabbat Shalom! 🕯️",
} as const;

// Storage bucket names
export const STORAGE_BUCKETS = {
  avatars: 'avatars',
  photos: 'photos',
  chat: 'chat-media',
} as const;

// Realtime channels
export const REALTIME_CHANNELS = {
  matches: 'matches',
  messages: 'messages',
  typing: 'typing',
  presence: 'presence',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  generic: 'Oy vey, something went wrong. Let\'s try again.',
  network: 'We lost connection. Check your wifi?',
  auth: 'Please sign in to continue.',
  notFound: 'That doesn\'t exist anymore.',
  permission: 'You don\'t have permission to do that.',
} as const;

// Loading messages
export const LOADING_MESSAGES = [
  'Aligning the stars...',
  'Finding your Mazal...',
  'Checking the constellations...',
  'Almost there...',
] as const;

// Empty state messages
export const EMPTY_STATES = {
  noProfiles: "You've seen everyone nearby!",
  noMatches: 'Your Mazal is out there',
  noMessages: 'When you match, start the conversation here',
} as const;
