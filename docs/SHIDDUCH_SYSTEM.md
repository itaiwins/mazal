# Mazal Shidduchim - Complete System Documentation

## Overview

Mazal Shidduchim is a comprehensive Orthodox Jewish matchmaking platform that brings the traditional shidduch process into the digital age while preserving its core values of respect, privacy, and family involvement.

Unlike mainstream dating apps, this system:
- **No swiping** - Only curated suggestions from verified shadchanim
- **Family involvement** - Parents/family can participate in the process
- **Privacy-first** - Photos and info only shared when you decide
- **Community-specific** - Different rules for different communities
- **Shabbat-aware** - Automatically pauses during Shabbat and Yom Tov

---

## Architecture

### Database Schema

Located in: `supabase/migrations/20250114_shidduch_system.sql`

#### Core Tables

| Table | Purpose |
|-------|---------|
| `shidduch_profiles` | Extended user profiles with family, education, hashkafa |
| `shidduch_references` | Reference contacts for verification |
| `shadchanim` | Verified matchmaker profiles |
| `shadchan_notes` | Private notes shadchanim keep on singles |
| `shidduch_suggestions` | Match suggestions (replaces swipes) |
| `shidduch_messages` | Communication through shadchanim |
| `family_connections` | Family member access to profiles |
| `shabbat_schedules` | Per-user Shabbat mode settings |
| `community_settings` | Rules per community type |

### App Structure

```
app/
├── (shidduch-onboarding)/      # 8-step resume builder
│   ├── welcome.tsx             # Introduction
│   ├── basics.tsx              # Personal details
│   ├── family.tsx              # Family background (yichus)
│   ├── education.tsx           # Schools & career
│   ├── hashkafa.tsx            # Religious outlook
│   ├── looking-for.tsx         # Partner preferences
│   ├── references.tsx          # Reference contacts
│   ├── photos.tsx              # Photos with privacy controls
│   └── complete.tsx            # Review & submit
│
├── (shidduch-tabs)/            # Main navigation
│   ├── index.tsx               # Suggestions dashboard
│   ├── shadchanim.tsx          # Matchmaker directory
│   ├── connections.tsx         # Active matches & family portal
│   └── profile.tsx             # Profile management
│
src/
├── stores/
│   └── shidduchOnboardingStore.ts  # Onboarding state
│
├── services/
│   └── shabbatService.ts       # Shabbat mode logic
│
└── components/shidduch/
    └── ShabbatModeScreen.tsx   # Shabbat pause screen
```

---

## The Shidduch Resume (Profile)

### Data Collected

#### Step 1: Personal Details (basics.tsx)
- First name, last name, Hebrew name
- Date of birth (18+ required)
- Gender (man/woman)

#### Step 2: Family Background (family.tsx)
- Father's info: name, occupation, origin
- Mother's info: name, maiden name, occupation, origin
- Parents' marital status
- Number of siblings, birth order
- Paternal/maternal grandfathers
- Notable rabbanim in family (yichus)
- Family minhagim (customs)

#### Step 3: Education & Career (education.tsx)
- Elementary school, high school
- Seminary/Yeshiva + years attended
- College/university
- Highest degree
- Current occupation & company

#### Step 4: Religious Outlook (hashkafa.tsx)
- Community type:
  - Modern Orthodox
  - Yeshivish
  - Chassidish (with specific chassidus)
  - Litvish
  - Sephardic
  - Chabad
- Hashkafa details (free-form)
- For men:
  - Minyan attendance frequency
  - Current learning schedule
  - Future kollel plans

#### Step 5: Looking For (looking-for.tsx)
- Description of ideal match (essay)
- Age range preferences
- Open to which communities
- Marriage timeline
- For men: wife working preferences
- For women: husband learning preferences

#### Step 6: References (references.tsx)
- Minimum 2 references required
- Reference types: Rav, Rosh Yeshiva, Teacher, Family Friend, Employer, Shadchan
- Contact info: name, relationship, phone, email
- Preferred contact method

#### Step 7: Photos (photos.tsx)
- Up to 4 photos
- Main photo designation
- Privacy controls:
  - Only after approval
  - Verified shadchanim only
  - Potential matches

#### Step 8: Review & Submit (complete.tsx)
- Full profile summary
- Confirm accuracy
- Submit to database

---

## The Suggestion System

### How It Works (No Swiping)

1. **User completes shidduch resume**
2. **Connects with shadchanim** (matchmakers)
3. **Shadchanim review profiles** and make suggestions
4. **User receives curated suggestions** with:
   - Basic profile info
   - Shadchan's reasoning for the match
   - Why they think it's compatible

### Response Options

| Option | Description |
|--------|-------------|
| **Interested** | Want to proceed, possibly research |
| **Need to Think** | Taking time, may discuss with family |
| **Not for Me** | Polite decline (reason optional) |

### Match Flow

```
Suggestion Created
       ↓
Both Sides Research
       ↓
Both Say "Interested"
       ↓
Contact Info Shared
       ↓
First Date Arranged
       ↓
Dating Progress Tracked
       ↓
Engagement / End
```

### Database Structure

```sql
shidduch_suggestions:
- profile_a_id, profile_b_id (the two people)
- suggested_by_type (shadchan/algorithm/family)
- suggestion_reason
- profile_a_status, profile_b_status (pending/interested/declined/thinking)
- is_mutual_interest
- current_status (suggested/researching/dating/serious/engaged/married/ended)
- total_dates
```

---

## Shadchan (Matchmaker) System

### Shadchan Features

- **Directory listing** with specialties
- **Rating & reviews** from successful matches
- **Connection system** - singles connect with relevant shadchanim
- **Private notes** - shadchanim can keep notes on singles
- **Match tracking** - see status of all suggestions

### Becoming a Verified Shadchan

1. Sign up with credentials
2. Verification by Mazal team
3. Profile includes:
   - Specialties (Young professionals, BT, Second marriages, etc.)
   - Communities served
   - Languages spoken
   - Availability
   - Fee structure
   - Success statistics

### Fee Structures

Common models supported:
- Free / donation upon engagement
- Fixed fee upon engagement
- Sliding scale
- Per-meeting fees

---

## Family Portal

### Overview

Parents and family members can be involved in the shidduch process, reflecting traditional practice.

### Features

- **View suggestions** received by their child
- **Research matches** - see profile details
- **Respond to suggestions** (if permitted)
- **Receive notifications** about new matches

### Permission Levels

| Permission | Description |
|------------|-------------|
| `can_view_suggestions` | See incoming suggestions |
| `can_respond_to_suggestions` | Accept/decline on behalf |
| `can_view_messages` | Read shadchan communications |
| `can_suggest_matches` | Suggest matches themselves |
| `receives_notifications` | Get notified of updates |

### Setup Flow

1. Single invites family member
2. Family member creates account
3. Accepts connection
4. Single sets permissions
5. Family can now participate

---

## Community-Specific Settings

### Pre-configured Communities

| Community | Photos | Direct Msg | Shadchan Req | Parent Approval | Browsing |
|-----------|--------|------------|--------------|-----------------|----------|
| Modern Orthodox | Required | Yes | No | No | Yes |
| MO Machmir | Required | Yes | No | No | Yes |
| Yeshivish | Optional | No | Yes | Yes | No |
| Chassidish | No | No | Yes | Yes | No |
| Sephardic | Required | Yes | No | No | Yes |
| Chabad | Optional | Yes | No | No | Yes |

### Customizable Rules

- `photos_allowed` - Can users upload photos?
- `photos_required` - Must they?
- `direct_messaging_allowed` - Can matches message directly?
- `shadchan_required` - Must go through matchmaker?
- `parent_approval_required` - Need parent sign-off?
- `browsing_allowed` - Can users browse or only receive?
- `show_photos_by_default` - Are photos visible initially?

---

## Shabbat Mode

### Overview

The app automatically pauses during Shabbat and Yom Tov, respecting the sanctity of these times.

### Technical Implementation

Located in: `src/services/shabbatService.ts`

```typescript
// Key functions
calculateZmanim(date, lat, lng, settings) - Calculate halachic times
checkShabbatMode() - Determine if currently Shabbat
initShabbatMode() - Start the checking service
useShabbatGuard() - Hook for components to check status
```

### Features

- **Location-based zmanim** - Accurate times for user's city
- **Configurable cushion** - Minutes before candle lighting (default: 18)
- **After havdalah** - Resume minutes after tzeis
- **Yom Tov support** - Includes Jewish holidays
- **Beautiful pause screen** - Animated candles, zmanim display

### Settings

```typescript
interface ShabbatSettings {
  isEnabled: boolean;
  minutesBeforeCandles: number;  // Default: 18
  minutesAfterHavdalah: number;  // Default: 0
  includeYomTov: boolean;
  latitude: number;
  longitude: number;
  city: string;
  timezone: string;
}
```

---

## Privacy Features

### Photo Privacy

1. **Only After Approval** - Photos only shared when you approve a specific match
2. **Verified Shadchanim** - Only verified matchmakers can see
3. **Potential Matches** - People suggested to you can see

### Profile Visibility

- `profile_visible` - Is profile active/searchable
- `accepting_suggestions` - Receiving new suggestions
- `photos_visible_to` - Who can see photos

### Data Protection

- References only contacted after mutual interest
- Sensitive info (health) only visible to assigned shadchan
- Family members have configurable access levels

---

## Messaging System

### Mediated Communication

Early-stage communication goes through the shadchan:
- No direct messaging until appropriate stage
- Shadchan can facilitate conversations
- Date requests managed through system

### Message Types

- **Text** - Regular messages
- **Date Request** - Propose a date with time/location
- **Date Response** - Accept/decline/suggest alternative
- **Status Update** - Milestone notifications

---

## User Flows

### New User Journey

```
1. Download app, select "Orthodox/Shidduch Mode"
2. Create account (email/phone)
3. Complete 8-step shidduch resume
4. Browse & connect with shadchanim
5. Wait for suggestions
6. Respond to suggestions
7. Research approved matches
8. Begin dating process
```

### Receiving a Suggestion

```
1. Notification: "New suggestion from Mrs. Goldstein"
2. Open app, view suggestion card
3. See: Name, age, community, city
4. See: Shadchan's reasoning
5. Options: Interested / Think / Decline
6. If interested + mutual: Contact shared
7. Shadchan facilitates first date
```

### Family Member Journey

```
1. Receive invite link from child
2. Create Mazal account
3. Accept family connection
4. View child's profile
5. Receive suggestion notifications
6. Research potential matches
7. Provide feedback/approval
```

---

## Technical Considerations

### State Management

- **shidduchOnboardingStore** - Zustand store for onboarding data
- **shabbatStore** - Shabbat mode settings and state
- Persisted to AsyncStorage

### Database Functions

```sql
-- Get suggestions for a user
get_shidduch_suggestions(user_id)

-- Respond to a suggestion
respond_to_suggestion(suggestion_id, user_id, response, decline_reason)
```

### RLS Policies

- Users can only view/edit their own profiles
- Suggestions visible to involved parties
- Shadchanim see profiles of connected users
- Family see profiles they're connected to

---

## Pricing Model

### Orthodox/Shidduch Tier

- **Price**: $49.99/month
- **Includes**:
  - Full shidduch resume
  - Unlimited shadchan connections
  - Family portal
  - Shabbat mode
  - Priority support
  - Dedicated Orthodox dating pool

### Shadchan Tools

- Free for verified shadchanim
- Access to single profiles
- Suggestion management
- Success tracking

---

## Future Enhancements

### Planned Features

1. **Video introductions** - Optional video profiles
2. **Enhanced zmanim** - Integration with external zmanim API
3. **Shadchan dashboard** - Web portal for matchmakers
4. **Reference automation** - Digital reference forms
5. **Dating timeline** - Visual progress tracker
6. **Community events** - In-app event listings
7. **Success stories** - Anonymous testimonials
8. **AI matching assistance** - Smart suggestions for shadchanim

### API Integrations

- Hebrew calendar API for Yom Tov dates
- Zmanim API for accurate times worldwide
- Background check services (optional)
- Genetic testing organizations (Dor Yeshorim, JScreen)

---

## Glossary

| Term | Meaning |
|------|---------|
| **Shidduch** | Arranged match/matchmaking |
| **Shadchan/Shadchanit** | Matchmaker (male/female) |
| **Bashert** | Destined one, soulmate |
| **Hashkafa** | Religious worldview/outlook |
| **Yichus** | Family lineage/pedigree |
| **Minhag** | Custom/tradition |
| **Zmanim** | Halachic times |
| **Havdalah** | End of Shabbat ceremony |
| **Tzeis** | Nightfall |
| **BT (Baal Teshuva)** | Someone who became religious |
| **FFB (Frum From Birth)** | Born into observant family |
| **Kollel** | Full-time Torah study institution |

---

## Support

For technical issues or questions:
- In-app: Help & Support section
- Email: support@mazalapp.com
- Website: mazalapp.com/help

---

*This document was generated as part of the Mazal Shidduchim implementation. Last updated: January 2026.*
