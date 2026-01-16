/**
 * Demo Profiles for App Store Screenshots
 *
 * These fake profiles are used when demo mode is enabled.
 * Replace photo URLs with actual stock photos before taking screenshots.
 *
 * To enable demo mode:
 * 1. Open the app
 * 2. Go to Settings > tap version number 5 times
 * 3. Toggle "Demo Mode" on
 */

import type { DiscoveryUser } from '@/types/user.types';

// Demo profile photos - replace these with actual stock photos
// Use royalty-free Jewish/diverse photos from Unsplash or similar
const DEMO_PHOTOS = {
  sarah: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
  ],
  david: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800',
  ],
  rachel: [
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
    'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=800',
  ],
  michael: [
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800',
  ],
  leah: [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800',
    'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=800',
  ],
};

// Note: Demo profiles only include Jewish fields asked during onboarding
// Onboarding asks: jewish_background, observance_level
export const DEMO_PROFILES = [
  {
    id: 'demo-1',
    first_name: 'Sarah',
    last_name: 'Cohen',
    email: 'demo@mazal.app',
    gender: 'female',
    date_of_birth: '1996-03-15',
    jewish_background: 'conservative', // From JEWISH_BACKGROUNDS
    bio: 'Lawyer by day, amateur chef by night. Looking for someone to share Shabbat dinners and spontaneous adventures with.',
    current_city: 'New York',
    current_latitude: 40.7128,
    current_longitude: -74.006,
    height_cm: 165,
    occupation: 'Attorney',
    education: 'Columbia Law School',
    is_active: true,
    onboarding_complete: true,
    elo_score: 1500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    age: 28,
    distance: 3,
    compatibility_score: 92,
    has_liked_me: true,
    safta_approved_count: 4,
    // Jewish Life Fields (only what's asked in onboarding)
    observance_level: 'somewhat_observant', // From OBSERVANCE_LEVELS
    photos: DEMO_PHOTOS.sarah.map((url, i) => ({
      id: `demo-1-photo-${i}`,
      user_id: 'demo-1',
      photo_url: url,
      photo_order: i,
      is_primary: i === 0,
      is_verified: true,
      created_at: new Date().toISOString(),
    })),
    prompts: [
      {
        id: 'demo-1-prompt-1',
        user_id: 'demo-1',
        prompt_id: 'perfect_first_date',
        answer: 'Starting with coffee at a cozy cafe, wandering through a bookstore, and ending with dinner somewhere we can actually talk.',
        display_order: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-1-prompt-2',
        user_id: 'demo-1',
        prompt_id: 'ideal_shabbat',
        answer: 'Friday night dinner with friends, sleeping in Saturday, then a long walk in the park before havdalah.',
        display_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
    badges: [
      {
        id: 'demo-1-badge-1',
        user_id: 'demo-1',
        badge_type: 'verified',
        verified: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'demo-2',
    first_name: 'David',
    last_name: 'Levy',
    email: 'demo2@mazal.app',
    gender: 'male',
    date_of_birth: '1994-07-22',
    jewish_background: 'Reform',
    bio: 'Tech founder who still makes time for Shabbat dinner. Love hiking, board games, and debating the best bagel in NYC.',
    current_city: 'Brooklyn',
    current_latitude: 40.6782,
    current_longitude: -73.9442,
    height_cm: 183,
    occupation: 'Software Engineer',
    education: 'MIT',
    is_active: true,
    onboarding_complete: true,
    elo_score: 1550,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    age: 30,
    distance: 5,
    compatibility_score: 88,
    has_liked_me: false,
    safta_approved_count: 2,
    // Jewish Life Fields (only what's asked in onboarding)
    observance_level: 'culturally_jewish', // From OBSERVANCE_LEVELS
    photos: DEMO_PHOTOS.david.map((url, i) => ({
      id: `demo-2-photo-${i}`,
      user_id: 'demo-2',
      photo_url: url,
      photo_order: i,
      is_primary: i === 0,
      is_verified: true,
      created_at: new Date().toISOString(),
    })),
    prompts: [
      {
        id: 'demo-2-prompt-1',
        user_id: 'demo-2',
        prompt_id: 'way_to_my_heart',
        answer: 'Through intellectual conversation, a good sense of humor, and maybe some homemade challah.',
        display_order: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-2-prompt-2',
        user_id: 'demo-2',
        prompt_id: 'looking_for',
        answer: 'Values family, has ambition, and can laugh at themselves. Bonus points if you can beat me at Settlers of Catan.',
        display_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
    badges: [
      {
        id: 'demo-2-badge-1',
        user_id: 'demo-2',
        badge_type: 'verified',
        verified: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'demo-3',
    first_name: 'Rachel',
    last_name: 'Goldstein',
    email: 'demo3@mazal.app',
    gender: 'female',
    date_of_birth: '1997-11-08',
    jewish_background: 'Modern Orthodox',
    bio: 'Pediatric nurse with a passion for travel. Spent a year in Israel and can\'t wait to go back. Dog mom to a rescue named Latke.',
    current_city: 'Manhattan',
    current_latitude: 40.7831,
    current_longitude: -73.9712,
    height_cm: 160,
    occupation: 'Pediatric Nurse',
    education: 'NYU Nursing',
    is_active: true,
    onboarding_complete: true,
    elo_score: 1480,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    age: 27,
    distance: 2,
    compatibility_score: 95,
    has_liked_me: false,
    safta_approved_count: 6,
    // Jewish Life Fields (only what's asked in onboarding)
    observance_level: 'very_observant', // From OBSERVANCE_LEVELS
    photos: DEMO_PHOTOS.rachel.map((url, i) => ({
      id: `demo-3-photo-${i}`,
      user_id: 'demo-3',
      photo_url: url,
      photo_order: i,
      is_primary: i === 0,
      is_verified: true,
      created_at: new Date().toISOString(),
    })),
    prompts: [
      {
        id: 'demo-3-prompt-1',
        user_id: 'demo-3',
        prompt_id: 'two_truths_and_lie',
        answer: 'I\'ve been to 23 countries, I make the best matzah ball soup, I\'m afraid of heights.',
        display_order: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-3-prompt-2',
        user_id: 'demo-3',
        prompt_id: 'favorite_holiday',
        answer: 'Sukkot! There\'s something magical about eating outside under the stars.',
        display_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
    badges: [
      {
        id: 'demo-3-badge-1',
        user_id: 'demo-3',
        badge_type: 'verified',
        verified: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-3-badge-2',
        user_id: 'demo-3',
        badge_type: 'safta_favorite',
        verified: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'demo-4',
    first_name: 'Michael',
    last_name: 'Rosen',
    email: 'demo4@mazal.app',
    gender: 'male',
    date_of_birth: '1993-02-14',
    jewish_background: 'Conservative',
    bio: 'Doctor by profession, musician by passion. Looking for my partner in crime for life\'s adventures.',
    current_city: 'Upper West Side',
    current_latitude: 40.7870,
    current_longitude: -73.9754,
    height_cm: 178,
    occupation: 'Physician',
    education: 'Johns Hopkins Medical',
    is_active: true,
    onboarding_complete: true,
    elo_score: 1520,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    age: 31,
    distance: 4,
    compatibility_score: 85,
    has_liked_me: true,
    safta_approved_count: 3,
    // Jewish Life Fields (only what's asked in onboarding)
    observance_level: 'somewhat_observant', // From OBSERVANCE_LEVELS
    photos: DEMO_PHOTOS.michael.map((url, i) => ({
      id: `demo-4-photo-${i}`,
      user_id: 'demo-4',
      photo_url: url,
      photo_order: i,
      is_primary: i === 0,
      is_verified: true,
      created_at: new Date().toISOString(),
    })),
    prompts: [
      {
        id: 'demo-4-prompt-1',
        user_id: 'demo-4',
        prompt_id: 'after_work',
        answer: 'Playing guitar, trying a new recipe, or catching up on the latest medical journals (I know, very exciting).',
        display_order: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-4-prompt-2',
        user_id: 'demo-4',
        prompt_id: 'important_value',
        answer: 'Family. Everything else flows from there.',
        display_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
    badges: [
      {
        id: 'demo-4-badge-1',
        user_id: 'demo-4',
        badge_type: 'verified',
        verified: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'demo-5',
    first_name: 'Leah',
    last_name: 'Shapiro',
    email: 'demo5@mazal.app',
    gender: 'female',
    date_of_birth: '1995-09-03',
    jewish_background: 'Reform',
    bio: 'Marketing director who believes in work-life balance. Weekend warrior - you\'ll find me at brunch, yoga, or exploring the city.',
    current_city: 'Hoboken',
    current_latitude: 40.7440,
    current_longitude: -74.0324,
    height_cm: 170,
    occupation: 'Marketing Director',
    education: 'University of Pennsylvania',
    is_active: true,
    onboarding_complete: true,
    elo_score: 1490,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    age: 29,
    distance: 7,
    compatibility_score: 90,
    has_liked_me: false,
    safta_approved_count: 5,
    // Jewish Life Fields (only what's asked in onboarding)
    observance_level: 'not_observant', // From OBSERVANCE_LEVELS
    photos: DEMO_PHOTOS.leah.map((url, i) => ({
      id: `demo-5-photo-${i}`,
      user_id: 'demo-5',
      photo_url: url,
      photo_order: i,
      is_primary: i === 0,
      is_verified: true,
      created_at: new Date().toISOString(),
    })),
    prompts: [
      {
        id: 'demo-5-prompt-1',
        user_id: 'demo-5',
        prompt_id: 'geek_out_on',
        answer: 'True crime podcasts, interior design, and finding the best happy hour deals in the city.',
        display_order: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-5-prompt-2',
        user_id: 'demo-5',
        prompt_id: 'green_flags',
        answer: 'Someone who texts back, remembers the little things, and doesn\'t take themselves too seriously.',
        display_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
    badges: [
      {
        id: 'demo-5-badge-1',
        user_id: 'demo-5',
        badge_type: 'verified',
        verified: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
] as unknown as DiscoveryUser[];

// Demo Matches (for the matches/messages screen)
export const DEMO_MATCHES = [
  {
    id: 'demo-match-1',
    user1_id: 'current-user',
    user2_id: 'demo-1',
    is_active: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    otherUser: {
      id: 'demo-1',
      first_name: 'Sarah',
      age: 28,
      photos: DEMO_PHOTOS.sarah.map((url, i) => ({
        id: `demo-1-photo-${i}`,
        user_id: 'demo-1',
        photo_url: url,
        photo_order: i,
        is_primary: i === 0,
        is_verified: true,
        created_at: new Date().toISOString(),
      })),
    },
  },
  {
    id: 'demo-match-2',
    user1_id: 'current-user',
    user2_id: 'demo-4',
    is_active: true,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    otherUser: {
      id: 'demo-4',
      first_name: 'Michael',
      age: 31,
      photos: DEMO_PHOTOS.michael.map((url, i) => ({
        id: `demo-4-photo-${i}`,
        user_id: 'demo-4',
        photo_url: url,
        photo_order: i,
        is_primary: i === 0,
        is_verified: true,
        created_at: new Date().toISOString(),
      })),
    },
  },
];

// Demo Messages (conversations)
export const DEMO_MESSAGES: Record<string, Array<{
  id: string;
  content: string;
  sender_id: string;
  match_id: string;
  created_at: string;
  is_read: boolean;
}>> = {
  'demo-match-1': [
    {
      id: 'msg-1',
      content: 'Hey! I noticed we both love hiking. Have you done any trails recently?',
      sender_id: 'current-user',
      match_id: 'demo-match-1',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: true,
    },
    {
      id: 'msg-2',
      content: 'Hi! Yes, I did Bear Mountain last weekend. The views were incredible! 🏔️',
      sender_id: 'demo-1',
      match_id: 'demo-match-1',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      is_read: true,
    },
    {
      id: 'msg-3',
      content: 'That sounds amazing! I\'ve been wanting to check that one out. Would you want to go together sometime?',
      sender_id: 'current-user',
      match_id: 'demo-match-1',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: true,
    },
    {
      id: 'msg-4',
      content: 'I\'d love that! Maybe this weekend if the weather holds up? ☀️',
      sender_id: 'demo-1',
      match_id: 'demo-match-1',
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      is_read: true,
    },
  ],
  'demo-match-2': [
    {
      id: 'msg-5',
      content: 'Your profile says you play guitar - what kind of music do you play?',
      sender_id: 'current-user',
      match_id: 'demo-match-2',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: true,
    },
    {
      id: 'msg-6',
      content: 'A little bit of everything! Mostly acoustic stuff - James Taylor, John Mayer, some Israeli music too',
      sender_id: 'demo-4',
      match_id: 'demo-match-2',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
      is_read: true,
    },
    {
      id: 'msg-7',
      content: 'Israeli music! That\'s awesome. Do you know any Idan Raichel?',
      sender_id: 'current-user',
      match_id: 'demo-match-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: true,
    },
  ],
};

// Demo Safta Accounts (Matchmakers in Safta Mode)
// These are the grandparents/parents/aunts who are doing the matchmaking
export const DEMO_SAFTA_ACCOUNTS = [
  {
    id: 'safta-1',
    first_name: 'Ruth',
    last_name: 'Goldberg',
    email: 'bubbe.ruth@mazal.app',
    phone: '+1234567890',
    relationship_to_user: 'grandmother',
    is_verified: true,
    is_premium: true,
    profile_photo: 'https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?w=400',
    bio: 'Looking for a nice Jewish match for my grandchild! I have a great eye for compatibility.',
    location: 'Boca Raton, FL',
    daily_recommendations_remaining: 10,
    total_recommendations: 47,
    successful_matches: 3,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'safta-2',
    first_name: 'Linda',
    last_name: 'Schwartz',
    email: 'aunt.linda@mazal.app',
    phone: '+1234567891',
    relationship_to_user: 'aunt',
    is_verified: true,
    is_premium: false,
    profile_photo: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400',
    bio: 'My niece/nephew deserves the best! Happy to help find their bashert.',
    location: 'Great Neck, NY',
    daily_recommendations_remaining: 3,
    total_recommendations: 12,
    successful_matches: 1,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'safta-3',
    first_name: 'Miriam',
    last_name: 'Cohen',
    email: 'safta.miriam@mazal.app',
    phone: '+1234567892',
    relationship_to_user: 'grandmother',
    is_verified: true,
    is_premium: true,
    profile_photo: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=400',
    bio: 'Former shadchan with 40 years of experience. Let me help!',
    location: 'Brooklyn, NY',
    daily_recommendations_remaining: 10,
    total_recommendations: 156,
    successful_matches: 12,
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'safta-4',
    first_name: 'Barbara',
    last_name: 'Levy',
    email: 'mom.barb@mazal.app',
    phone: '+1234567893',
    relationship_to_user: 'mother',
    is_verified: true,
    is_premium: true,
    profile_photo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400',
    bio: 'I know my child better than anyone. Let me help find their perfect match!',
    location: 'Scarsdale, NY',
    daily_recommendations_remaining: 8,
    total_recommendations: 34,
    successful_matches: 2,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo Safta Connections
export const DEMO_SAFTA_CONNECTIONS = [
  {
    id: 'safta-conn-1',
    saftaId: 'safta-1',
    saftaName: 'Bubbe Ruth',
    saftaPhoto: 'https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?w=400',
    relationship: 'grandmother',
    status: 'accepted' as const,
    connectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastMessage: 'I found someone perfect for you! Check your recommendations 💕',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unreadCount: 1,
  },
  {
    id: 'safta-conn-2',
    saftaId: 'safta-2',
    saftaName: 'Aunt Linda',
    saftaPhoto: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400',
    relationship: 'aunt',
    status: 'accepted' as const,
    connectedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastMessage: 'How did the date go?',
    lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
  },
];

// Demo Safta Messages
export const DEMO_SAFTA_MESSAGES: Record<string, Array<{
  id: string;
  connectionId: string;
  senderType: 'safta' | 'user';
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}>> = {
  'safta-conn-1': [
    {
      id: 'safta-msg-1',
      connectionId: 'safta-conn-1',
      senderType: 'safta',
      senderId: 'safta-1',
      content: 'Mazel tov on joining! I\'m so excited to help you find your bashert!',
      isRead: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'safta-msg-2',
      connectionId: 'safta-conn-1',
      senderType: 'user',
      senderId: 'current-user',
      content: 'Thanks Bubbe! I\'m looking forward to your recommendations 😊',
      isRead: true,
      createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'safta-msg-3',
      connectionId: 'safta-conn-1',
      senderType: 'safta',
      senderId: 'safta-1',
      content: 'I found someone perfect for you! Check your recommendations 💕',
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'safta-conn-2': [
    {
      id: 'safta-msg-4',
      connectionId: 'safta-conn-2',
      senderType: 'safta',
      senderId: 'safta-2',
      content: 'Hey sweetie! Your mom told me you\'re on Mazal now. Let me know if you need any help!',
      isRead: true,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'safta-msg-5',
      connectionId: 'safta-conn-2',
      senderType: 'user',
      senderId: 'current-user',
      content: 'Hi Aunt Linda! Yes, I just matched with someone nice actually',
      isRead: true,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'safta-msg-6',
      connectionId: 'safta-conn-2',
      senderType: 'safta',
      senderId: 'safta-2',
      content: 'How did the date go?',
      isRead: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

// Demo Nearby Users (for the map)
export const DEMO_NEARBY_USERS = [
  {
    id: 'demo-1',
    name: 'Sarah',
    age: 28,
    photo: DEMO_PHOTOS.sarah[0],
    distance: 0.8,
    latitude: 40.7580,
    longitude: -73.9855,
    jewishBackground: 'Conservative',
    occupation: 'Attorney',
    isVerified: true,
    saftaApproved: 4,
  },
  {
    id: 'demo-3',
    name: 'Rachel',
    age: 27,
    photo: DEMO_PHOTOS.rachel[0],
    distance: 1.2,
    latitude: 40.7614,
    longitude: -73.9776,
    jewishBackground: 'Modern Orthodox',
    occupation: 'Pediatric Nurse',
    isVerified: true,
    saftaApproved: 6,
  },
  {
    id: 'demo-5',
    name: 'Leah',
    age: 29,
    photo: DEMO_PHOTOS.leah[0],
    distance: 2.1,
    latitude: 40.7484,
    longitude: -73.9857,
    jewishBackground: 'Reform',
    occupation: 'Marketing Director',
    isVerified: true,
    saftaApproved: 5,
  },
  {
    id: 'demo-2',
    name: 'David',
    age: 30,
    photo: DEMO_PHOTOS.david[0],
    distance: 1.5,
    latitude: 40.7549,
    longitude: -73.9840,
    jewishBackground: 'Reform',
    occupation: 'Software Engineer',
    isVerified: true,
    saftaApproved: 2,
  },
  {
    id: 'demo-4',
    name: 'Michael',
    age: 31,
    photo: DEMO_PHOTOS.michael[0],
    distance: 0.5,
    latitude: 40.7589,
    longitude: -73.9851,
    jewishBackground: 'Conservative',
    occupation: 'Physician',
    isVerified: true,
    saftaApproved: 3,
  },
];

// Helper to get conversation preview for matches list
export function getDemoConversations() {
  return DEMO_MATCHES.map((match) => {
    const messages = DEMO_MESSAGES[match.id] || [];
    const lastMessage = messages[messages.length - 1];
    return {
      id: match.id,
      name: match.otherUser.first_name,
      photo: match.otherUser.photos[0]?.photo_url || '',
      lastMessage: lastMessage?.content || 'Say hello!',
      lastMessageTime: lastMessage ? new Date(lastMessage.created_at) : new Date(match.created_at),
      unread: 0,
      isOnline: Math.random() > 0.5,
      category: 'matches' as const,
    };
  });
}

export default DEMO_PROFILES;
