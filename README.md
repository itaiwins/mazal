# Mazal

A modern Jewish dating app built with React Native and Expo, featuring unique family-assisted matchmaking.

## Overview

Mazal connects Jewish singles through a thoughtful, community-driven approach to dating. What sets Mazal apart is the **Safta Matchmaking** feature, where family members can participate as matchmakers to help their loved ones find meaningful connections.

## Features

### Core Dating
- **Discovery Feed** - Swipe-based profile browsing with rich profile stories
- **Smart Matching** - Algorithm-based compatibility scoring
- **Real-time Messaging** - Instant chat with matches
- **Mazal Map** - Location-based discovery with saved locations

### Safta Matchmaking
Family members can join as "Saftas" (matchmakers) to:
- Browse profiles on behalf of their family member
- Send recommendations with personal notes
- Chat directly about potential matches
- Track their matchmaking activity

### Jewish Identity
- Multiple observance levels supported
- Orthodox mode with dedicated features
- Jewish background preferences
- Hebrew language support

### Premium Tiers

| Feature | Free | Gold | Platinum |
|---------|------|------|----------|
| Daily Swipes | 25 | Unlimited | Unlimited |
| Super Likes | 1/week | 5/week | Unlimited |
| See Who Likes You | - | Yes | Yes |
| Rewind Last Swipe | - | Yes | Yes |
| Advanced Filters | - | Yes | Yes |
| Read Receipts | - | Yes | Yes |
| Weekly Boosts | - | - | 1/week |
| Priority Discovery | - | - | Yes |
| Incognito Mode | - | - | Yes |
| Ad-Free | - | Yes | Yes |

## Tech Stack

### Frontend
- **React Native** 0.81.5
- **Expo** 54 with Expo Router
- **TypeScript** (strict mode)
- **React** 19.1

### State Management
- **Zustand** - Global state
- **React Query** - Server state & caching

### Backend & Services
- **Supabase** - Database, auth, real-time subscriptions
- **RevenueCat** - Subscription management
- **Google Mobile Ads** - Monetization
- **AWS Rekognition** - Image verification

### UI/UX
- **React Native Reanimated** - Animations
- **Lottie** - Complex animations
- **React Native Maps** - Map features
- **Expo Camera/Image Picker** - Photo capture

## Project Structure

```
mazal/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication
│   ├── (onboarding)/      # User onboarding
│   ├── (tabs)/            # Main app tabs
│   ├── (safta-auth)/      # Safta authentication
│   ├── (safta-tabs)/      # Safta interface
│   ├── (orthodox)/        # Orthodox mode
│   ├── settings/          # Settings screens
│   ├── profile/           # Profile management
│   └── premium/           # Subscription screens
│
├── src/
│   ├── api/               # Data layer
│   │   ├── queries/       # React Query hooks
│   │   ├── mutations/     # Data mutations
│   │   ├── realtime/      # Subscriptions
│   │   └── supabase/      # Client config
│   │
│   ├── stores/            # Zustand stores
│   │   ├── authStore.ts
│   │   ├── premiumStore.ts
│   │   ├── discoveryStore.ts
│   │   └── ...
│   │
│   ├── components/        # Reusable components
│   │   ├── discovery/
│   │   ├── chat/
│   │   ├── premium/
│   │   └── ui/
│   │
│   ├── lib/               # Utilities
│   │   ├── config/
│   │   ├── constants/
│   │   └── demo/
│   │
│   ├── theme/             # Design system
│   └── types/             # TypeScript types
│
├── assets/                # Images & fonts
├── supabase/              # Migrations & functions
└── docs/                  # Documentation
```

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator / Android Emulator (or physical device)
- Supabase project
- RevenueCat account

### Environment Setup

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your-ios-key
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your-android-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key
EXPO_PUBLIC_APP_ENV=development
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Development Build

For features requiring native modules (ads, camera, maps):

```bash
# Create development build
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Run on iOS simulator |
| `npm run android` | Run on Android emulator |
| `npm run web` | Run in web browser |

## Database

The app uses Supabase with the following main tables:
- `users` - User profiles
- `user_photos` - Profile photos
- `user_prompts` - Profile prompts/answers
- `user_badges` - Verification badges
- `swipes` - Like/pass actions
- `matches` - Mutual matches
- `messages` - Chat messages
- `safta_accounts` - Matchmaker accounts
- `safta_connections` - User-Safta relationships
- `safta_likes` - Safta recommendations

## Design System

### Colors
- **Primary Navy**: `#0D1B3E`
- **Gold Accent**: `#C9A227`
- **White**: `#FFFFFF`

### Typography
- System fonts with responsive sizing
- Hebrew support included

## Building for Production

```bash
# iOS App Store
npx eas build --profile production --platform ios

# Android Play Store
npx eas build --profile production --platform android
```

## License

Proprietary - All rights reserved

## Contact

For questions or support, please contact the development team.
