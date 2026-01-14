# Mazal - Jewish Dating App

## Overview

Mazal is a React Native/Expo dating app designed specifically for Jewish users with three distinct user modes:

- **Regular User Mode**: Standard swiping/matching experience
- **Orthodox/Shidduch Mode**: Comprehensive shidduch matchmaking platform with shadchanim, family portal, and no swiping
- **Safta Mode**: Grandparent/parent matchmaker mode where family members can set up younger relatives

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native (Expo SDK 52) |
| Navigation | Expo Router (file-based) |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| State Management | Zustand (persisted to AsyncStorage) |
| Data Fetching | React Query (@tanstack/react-query) |
| Monetization | RevenueCat |
| Maps | React Native Maps |
| Animations | Reanimated 3 |

## Project Structure

```
mazal/
├── app/                      # Expo Router navigation (file-based routing)
│   ├── index.tsx            # Root routing hub
│   ├── _layout.tsx          # Root providers (auth, theme, query)
│   ├── (auth)/              # Regular user auth flows
│   ├── (onboarding)/        # 13-step profile setup
│   ├── (tabs)/              # Main app tabs (Discover, Map, Matches, Profile)
│   ├── (shidduch-onboarding)/ # 8-step shidduch resume builder
│   ├── (shidduch-tabs)/     # Shidduch mode main tabs
│   ├── (safta-auth)/        # Safta/grandparent auth
│   ├── (safta-tabs)/        # Safta mode tabs
│   ├── profile/             # Profile editing modal stack
│   ├── settings/            # Settings screens
│   ├── premium/             # Premium paywall modal
│   └── legal/               # Privacy & terms
│
├── src/
│   ├── api/                 # API layer
│   │   ├── supabase/       # Supabase client & auth
│   │   ├── queries/        # React Query read operations
│   │   ├── mutations/      # React Query write operations
│   │   ├── realtime/       # Supabase realtime subscriptions
│   │   └── storage/        # File upload handlers
│   │
│   ├── stores/             # Zustand state management
│   │   ├── authStore.ts    # Authentication & dual-mode state
│   │   ├── userStore.ts    # Current user profile
│   │   ├── discoveryStore.ts # Swiping state & filters
│   │   ├── matchStore.ts   # Matches & conversations
│   │   ├── premiumStore.ts # Premium features & limits
│   │   ├── saftaPremiumStore.ts # Safta Pro features
│   │   ├── onboardingStore.ts # Onboarding progress
│   │   └── shidduchOnboardingStore.ts # Shidduch resume state
│   │
│   ├── components/         # Reusable UI components
│   │   ├── discovery/      # Card deck, swipe gestures
│   │   ├── chat/           # Messaging UI
│   │   ├── premium/        # Paywall components
│   │   ├── shidduch/       # Shidduch-specific components
│   │   └── ui/             # Generic UI elements
│   │
│   ├── services/           # Business logic services
│   │   └── shabbatService.ts # Shabbat mode with zmanim
│   │
│   ├── lib/                # Utilities & configuration
│   │   ├── config/         # App config (revenuecat, queryClient)
│   │   └── constants/      # App constants
│   │
│   ├── theme/              # Design system
│   │   ├── colors.ts       # Color palette
│   │   ├── spacing.ts      # Spacing, shadows
│   │   └── index.ts        # Theme provider
│   │
│   └── types/              # TypeScript definitions
│
├── assets/                  # Images, fonts, icons
├── supabase/               # Database migrations
└── docs/                   # Documentation
    └── post-launch/        # Future feature specs
```

## User Modes

### 1. Regular User Mode

**Flow:** `(auth)/welcome → login/register → (onboarding)/[13 steps] → (tabs)/`

**Onboarding Steps:**
1. welcome - Introduction
2. basics - Name, age, gender, preferences
3. photos - Upload 2+ photos
4. jewish-identity - Background, observance
5. location - Current city
6. education - School, occupation
7. lifestyle - Height, children preferences
8. relationship-goals - Goals, relocation
9. dealbreakers - Must-haves
10. preferences - Age/distance filters
11. prompts - Answer 3 icebreakers
12. notifications - Push opt-in
13. complete - Review & submit

**Main Tabs:**
- Discover - Swipe cards
- Map - Geographic browse
- Matches - Conversations
- Profile - View/edit profile

### 2. Orthodox/Shidduch Mode

**Flow:** `(auth)/welcome → register → (shidduch-onboarding)/[8 steps] → (shidduch-tabs)/`

**Shidduch Onboarding (8 Steps):**
1. welcome - Introduction to shidduch process
2. basics - Personal details, Hebrew name
3. family - Family background, yichus
4. education - Schools, seminary/yeshiva, career
5. hashkafa - Religious outlook, community
6. looking-for - Partner preferences
7. references - 2+ reference contacts
8. photos - Optional with privacy controls
9. complete - Review & submit

**Main Tabs:**
- Suggestions - Curated matches from shadchanim (NO swiping)
- Shadchanim - Directory of verified matchmakers
- Connections - Active matches & family portal
- Profile - View/edit shidduch resume

**Key Features:**
- NO swiping - Only curated suggestions from shadchanim
- Family Portal - Parents can view suggestions & participate
- Privacy Controls - Photos only shown when you decide
- Shabbat Mode - Auto-pauses during Shabbat with zmanim
- Community-Specific - Different rules per community
- Reference System - Verified references
- $49.99/month subscription

**See detailed docs:** `docs/SHIDDUCH_SYSTEM.md`

### 3. Safta Mode (Matchmaking)

**Flow:** `(safta-auth)/welcome → signup → enter-code → profile-setup → (safta-tabs)/`

**How It Works:**
- Parents/grandparents sign up to matchmake
- Connect with family members via invite code
- Browse profiles and recommend matches
- Send profiles to family members
- Track recommendation success

**Safta Pro ($14.99/month):**
- Unlimited daily recommendations (free: 10/day)
- Unlimited family connections (free: 1)
- Notes/CRM for tracking
- Analytics dashboard
- Verified badge

## State Management

### Key Stores

| Store | Purpose |
|-------|---------|
| `authStore` | Session, user profile, current mode |
| `discoveryStore` | Swipe deck, filters, daily limits |
| `matchStore` | Matches, conversations |
| `premiumStore` | Subscription tier, feature gates |
| `saftaPremiumStore` | Safta Pro features, daily limits |
| `onboardingStore` | Regular onboarding step & draft data |
| `shidduchOnboardingStore` | Shidduch resume data |
| `shabbatStore` | Shabbat mode settings & state |

### Dual-Mode System

Users can be BOTH a regular dater AND a Safta matchmaker:

```typescript
// authStore
currentMode: 'user' | 'safta'  // Active mode
hasSaftaProfile: boolean       // Has completed Safta setup
```

## Database Schema (Key Tables)

```sql
users - User profiles
user_photos - Profile photos
user_prompts - Icebreaker answers
swipes - Like/pass/super_like actions
matches - Mutual matches
messages - Chat messages
safta_accounts - Safta matchmaker profiles
safta_connections - Family connections
safta_daily_usage - Daily limit tracking
```

## Premium Tiers

| Tier | Price | Key Features |
|------|-------|--------------|
| Free | $0 | 25 swipes/day, 1 super like/week |
| Gold | $14.99/mo | Unlimited swipes, see likes, rewind |
| Platinum | $29.99/mo | Gold + boost, message before match |
| Orthodox | $49.99/mo | Dedicated pool, shadchan, shabbat mode |
| Safta Pro | $14.99/mo | Unlimited recommendations & connections |

## Entry Point Logic

```typescript
// app/index.tsx
if (!isInitialized) → Loading
else if (!isAuthenticated) → (auth)/welcome
else if (currentMode === 'safta')
  if (hasSaftaProfile) → (safta-tabs)/
  else → (safta-auth)/welcome
else // Regular mode
  if (isOnboardingComplete) → (tabs)/
  else → (onboarding)/welcome
```

## Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_APP_ENV=development
```

## Key Patterns

### API Queries (React Query)
```typescript
// Fetching data
const { data, isLoading } = useDiscoveryProfiles(filters);
const { data: matches } = useMatches();
```

### API Mutations
```typescript
// Writing data
const swipeMutation = useSwipe();
swipeMutation.mutate({ targetId, action: 'like' });
```

### Premium Feature Gates
```typescript
const { canRecommend, useRecommendation } = useSaftaPremiumStore();

if (!canRecommend()) {
  router.push('/(safta-auth)/paywall');
  return;
}
useRecommendation(); // Decrement daily count
```

### Realtime Subscriptions
```typescript
// Messages update in real-time via Supabase
supabase
  .channel('messages')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handler)
  .subscribe();
```

## Common Tasks

### Adding a New Screen
1. Create file in appropriate `app/(group)/` folder
2. Add to `_layout.tsx` Stack if needed
3. Navigate with `router.push('/(group)/screen-name')`

### Adding a New Store
1. Create in `src/stores/newStore.ts`
2. Use Zustand with persist middleware
3. Export selectors for derived state

### Adding a New API Query
1. Create hook in `src/api/queries/`
2. Use React Query's `useQuery`
3. Define return types

### Adding Premium Feature
1. Add to `FEATURE_LIMITS` in `src/lib/config/revenuecat.ts`
2. Add selector to appropriate premium store
3. Gate feature with `if (!hasFeature()) showPaywall()`

## Age Verification

The app requires users to be 18+. This is enforced:
1. Date of birth input during onboarding (`basics.tsx`)
2. Age calculated and validated before profile creation
3. Under-18 users blocked from completing onboarding

## Testing Checklist

### Regular User Flow
- [ ] Login/signup works
- [ ] Onboarding completes (all 13 steps)
- [ ] Discovery loads profiles
- [ ] Swiping creates matches
- [ ] Messaging works
- [ ] Premium paywall displays

### Safta Flow
- [ ] Safta signup works
- [ ] Profile setup completes
- [ ] Discovery shows candidates
- [ ] Daily limit enforced (10 free)
- [ ] Paywall triggers at limit
- [ ] Pro features unlock after purchase

### Orthodox Flow
- [ ] Orthodox registration works
- [ ] Dedicated pool filters correctly
- [ ] Shadchan directory loads
- [ ] Shabbat mode toggles
