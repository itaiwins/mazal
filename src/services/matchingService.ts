/**
 * Shidduch Matching Service
 *
 * AI-powered compatibility scoring algorithm for shidduch matching
 * Uses a balanced approach with multiple factors
 */

import { supabase } from '@/api/supabase/client';

interface ProfileForMatching {
  id: string;
  user_id: string;
  community: string | null;
  chassidus: string | null;
  hashkafa_details: string | null;
  father_occupation: string | null;
  mother_occupation: string | null;
  parents_status: string | null;
  family_minhagim: string | null;
  high_school: string | null;
  seminary_yeshiva: string | null;
  college_university: string | null;
  highest_degree: string | null;
  minyan_frequency: string | null;
  learning_schedule: string | null;
  kollel_interest: string | null;
  looking_for_description: string | null;
  age_range_min: number | null;
  age_range_max: number | null;
  preferred_communities: string[] | null;
  marriage_timeline: string | null;
  wife_working: string | null;
  husband_learning: string | null;
  users?: {
    first_name: string | null;
    // An age, not a date of birth (MEXA-320). A candidate's comes straight off
    // `user_public_profiles.age`; the source profile is the caller's own, so its age is
    // still computed here from `users.date_of_birth`, which only they can read.
    age: number | null;
    gender: string | null;
    current_city: string | null;
    current_state: string | null;
    current_country: string | null;
  };
}

export interface CompatibilityScore {
  total: number;
  breakdown: {
    community: number;
    age: number;
    location: number;
    family: number;
    hashkafa: number;
    preferences: number;
  };
  reasons: string[];
}

export interface MatchSuggestion {
  profile: ProfileForMatching;
  score: CompatibilityScore;
}

// Weight constants for each factor (should sum to 100)
const WEIGHTS = {
  COMMUNITY: 20,
  AGE: 15,
  LOCATION: 15,
  FAMILY: 15,
  HASHKAFA: 15,
  PREFERENCES: 20, // Combined preferences and must-haves
};

/**
 * Calculate compatibility score between two profiles
 */
export function calculateCompatibility(
  profileA: ProfileForMatching,
  profileB: ProfileForMatching
): CompatibilityScore {
  const breakdown = {
    community: 0,
    age: 0,
    location: 0,
    family: 0,
    hashkafa: 0,
    preferences: 0,
  };
  const reasons: string[] = [];

  // 1. Community Match (20 points)
  breakdown.community = calculateCommunityScore(profileA, profileB, reasons);

  // 2. Age Compatibility (15 points)
  breakdown.age = calculateAgeScore(profileA, profileB, reasons);

  // 3. Location (15 points)
  breakdown.location = calculateLocationScore(profileA, profileB, reasons);

  // 4. Family Background (15 points)
  breakdown.family = calculateFamilyScore(profileA, profileB, reasons);

  // 5. Hashkafa Alignment (15 points)
  breakdown.hashkafa = calculateHashkafaScore(profileA, profileB, reasons);

  // 6. Preferences Match (20 points)
  breakdown.preferences = calculatePreferencesScore(profileA, profileB, reasons);

  const total = Math.round(
    breakdown.community +
      breakdown.age +
      breakdown.location +
      breakdown.family +
      breakdown.hashkafa +
      breakdown.preferences
  );

  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown,
    reasons,
  };
}

/**
 * Community match scoring
 */
function calculateCommunityScore(
  profileA: ProfileForMatching,
  profileB: ProfileForMatching,
  reasons: string[]
): number {
  if (!profileA.community || !profileB.community) {
    return WEIGHTS.COMMUNITY * 0.5; // Partial score if unknown
  }

  // Exact match
  if (profileA.community === profileB.community) {
    reasons.push('Same community background');
    return WEIGHTS.COMMUNITY;
  }

  // Check if in preferred communities
  if (profileA.preferred_communities?.includes(profileB.community)) {
    reasons.push('Community is within preferences');
    return WEIGHTS.COMMUNITY * 0.8;
  }

  // Compatible communities (Modern Orthodox and Yeshivish can be compatible)
  const compatibleGroups = [
    ['modern_orthodox', 'yeshivish'],
    ['yeshivish', 'litvish'],
    ['chassidish', 'yeshivish'],
  ];

  for (const group of compatibleGroups) {
    if (group.includes(profileA.community) && group.includes(profileB.community)) {
      reasons.push('Compatible community backgrounds');
      return WEIGHTS.COMMUNITY * 0.6;
    }
  }

  return WEIGHTS.COMMUNITY * 0.2;
}

/**
 * Age compatibility scoring
 */
function calculateAgeScore(
  profileA: ProfileForMatching,
  profileB: ProfileForMatching,
  reasons: string[]
): number {
  const ageA = profileA.users?.age;
  const ageB = profileB.users?.age;

  if (ageA == null || ageB == null) {
    return WEIGHTS.AGE * 0.5;
  }

  // Check if B's age is within A's preferred range
  const minAge = profileA.age_range_min || ageA - 3;
  const maxAge = profileA.age_range_max || ageA + 3;

  if (ageB >= minAge && ageB <= maxAge) {
    reasons.push('Age within preferred range');
    return WEIGHTS.AGE;
  }

  // Close to range (within 2 years)
  if (ageB >= minAge - 2 && ageB <= maxAge + 2) {
    reasons.push('Age close to preferred range');
    return WEIGHTS.AGE * 0.7;
  }

  // Within reasonable range (within 5 years)
  if (ageB >= minAge - 5 && ageB <= maxAge + 5) {
    return WEIGHTS.AGE * 0.4;
  }

  return 0;
}

/**
 * Location proximity scoring
 */
function calculateLocationScore(
  profileA: ProfileForMatching,
  profileB: ProfileForMatching,
  reasons: string[]
): number {
  const cityA = profileA.users?.current_city?.toLowerCase();
  const stateA = profileA.users?.current_state?.toLowerCase();
  const cityB = profileB.users?.current_city?.toLowerCase();
  const stateB = profileB.users?.current_state?.toLowerCase();

  if (!cityA && !stateA && !cityB && !stateB) {
    return WEIGHTS.LOCATION * 0.5;
  }

  // Same city
  if (cityA && cityB && cityA === cityB) {
    reasons.push('Same city');
    return WEIGHTS.LOCATION;
  }

  // Same state
  if (stateA && stateB && stateA === stateB) {
    reasons.push('Same state/region');
    return WEIGHTS.LOCATION * 0.7;
  }

  // Major Jewish communities (can be considered close)
  const majorCommunities = [
    ['new york', 'new jersey', 'brooklyn', 'lakewood', 'monsey'],
    ['los angeles', 'la'],
    ['miami', 'boca raton'],
    ['chicago'],
    ['baltimore'],
    ['toronto'],
    ['israel', 'jerusalem', 'bnei brak'],
  ];

  for (const group of majorCommunities) {
    const aInGroup = cityA && group.some((c) => cityA.includes(c));
    const bInGroup = cityB && group.some((c) => cityB.includes(c));
    if (aInGroup && bInGroup) {
      reasons.push('In same Jewish community region');
      return WEIGHTS.LOCATION * 0.8;
    }
  }

  return WEIGHTS.LOCATION * 0.3;
}

/**
 * Family background scoring
 */
function calculateFamilyScore(
  profileA: ProfileForMatching,
  profileB: ProfileForMatching,
  reasons: string[]
): number {
  let score = 0;

  // Parents status compatibility
  if (profileA.parents_status && profileB.parents_status) {
    if (profileA.parents_status === profileB.parents_status) {
      score += WEIGHTS.FAMILY * 0.3;
    } else if (
      profileA.parents_status === 'married' &&
      profileB.parents_status === 'married'
    ) {
      score += WEIGHTS.FAMILY * 0.3;
      reasons.push('Similar family structure');
    }
  } else {
    score += WEIGHTS.FAMILY * 0.15;
  }

  // Minhagim compatibility
  if (profileA.family_minhagim && profileB.family_minhagim) {
    if (profileA.family_minhagim === profileB.family_minhagim) {
      score += WEIGHTS.FAMILY * 0.4;
      reasons.push('Same family minhagim');
    } else {
      score += WEIGHTS.FAMILY * 0.1;
    }
  } else {
    score += WEIGHTS.FAMILY * 0.2;
  }

  // Education background similarity
  if (profileA.highest_degree && profileB.highest_degree) {
    const degreeOrder = ['high_school', 'some_college', 'associates', 'bachelors', 'masters', 'doctorate', 'rabbinical'];
    const indexA = degreeOrder.indexOf(profileA.highest_degree);
    const indexB = degreeOrder.indexOf(profileB.highest_degree);

    if (Math.abs(indexA - indexB) <= 1) {
      score += WEIGHTS.FAMILY * 0.3;
      reasons.push('Similar education level');
    } else {
      score += WEIGHTS.FAMILY * 0.1;
    }
  } else {
    score += WEIGHTS.FAMILY * 0.15;
  }

  return score;
}

/**
 * Hashkafa (religious outlook) scoring
 */
function calculateHashkafaScore(
  profileA: ProfileForMatching,
  profileB: ProfileForMatching,
  reasons: string[]
): number {
  let score = 0;

  // Learning schedule compatibility (for men)
  if (profileA.learning_schedule && profileB.learning_schedule) {
    if (profileA.learning_schedule === profileB.learning_schedule) {
      score += WEIGHTS.HASHKAFA * 0.3;
      reasons.push('Compatible learning schedules');
    } else {
      // Check if schedules are adjacent (e.g., full_time and night_seder)
      const scheduleOrder = ['full_time', 'night_seder', 'daf_yomi', 'chavrusas', 'shiurim', 'self_study'];
      const indexA = scheduleOrder.indexOf(profileA.learning_schedule);
      const indexB = scheduleOrder.indexOf(profileB.learning_schedule);
      if (Math.abs(indexA - indexB) <= 1) {
        score += WEIGHTS.HASHKAFA * 0.2;
      }
    }
  } else {
    score += WEIGHTS.HASHKAFA * 0.15;
  }

  // Minyan frequency compatibility
  if (profileA.minyan_frequency && profileB.minyan_frequency) {
    if (profileA.minyan_frequency === profileB.minyan_frequency) {
      score += WEIGHTS.HASHKAFA * 0.3;
      reasons.push('Similar davening practices');
    } else {
      score += WEIGHTS.HASHKAFA * 0.1;
    }
  } else {
    score += WEIGHTS.HASHKAFA * 0.15;
  }

  // Chassidus alignment
  if (profileA.chassidus && profileB.chassidus) {
    if (profileA.chassidus.toLowerCase() === profileB.chassidus.toLowerCase()) {
      score += WEIGHTS.HASHKAFA * 0.4;
      reasons.push('Same chassidus');
    } else {
      score += WEIGHTS.HASHKAFA * 0.1;
    }
  } else if (!profileA.chassidus && !profileB.chassidus) {
    score += WEIGHTS.HASHKAFA * 0.4; // Both non-chassidish
  } else {
    score += WEIGHTS.HASHKAFA * 0.2;
  }

  return score;
}

/**
 * Preferences and must-haves scoring
 */
function calculatePreferencesScore(
  profileA: ProfileForMatching,
  profileB: ProfileForMatching,
  reasons: string[]
): number {
  let score = 0;

  // Marriage timeline alignment
  if (profileA.marriage_timeline && profileB.marriage_timeline) {
    if (profileA.marriage_timeline === profileB.marriage_timeline) {
      score += WEIGHTS.PREFERENCES * 0.25;
      reasons.push('Same marriage timeline');
    } else if (
      (profileA.marriage_timeline === 'ready_now' && profileB.marriage_timeline === '6_months') ||
      (profileA.marriage_timeline === '6_months' && profileB.marriage_timeline === 'ready_now')
    ) {
      score += WEIGHTS.PREFERENCES * 0.2;
    } else {
      score += WEIGHTS.PREFERENCES * 0.1;
    }
  } else {
    score += WEIGHTS.PREFERENCES * 0.125;
  }

  // Kollel interest alignment (for women looking at men's profiles)
  if (profileA.kollel_interest && profileB.husband_learning) {
    if (profileA.kollel_interest === profileB.husband_learning) {
      score += WEIGHTS.PREFERENCES * 0.25;
      reasons.push('Learning plans align');
    } else {
      score += WEIGHTS.PREFERENCES * 0.1;
    }
  } else if (profileA.husband_learning && profileB.kollel_interest) {
    if (profileA.husband_learning === profileB.kollel_interest) {
      score += WEIGHTS.PREFERENCES * 0.25;
      reasons.push('Learning expectations align');
    } else {
      score += WEIGHTS.PREFERENCES * 0.1;
    }
  } else {
    score += WEIGHTS.PREFERENCES * 0.125;
  }

  // Wife working preference alignment
  if (profileA.wife_working && profileB.wife_working) {
    if (profileA.wife_working === profileB.wife_working) {
      score += WEIGHTS.PREFERENCES * 0.25;
      reasons.push('Work expectations align');
    } else if (profileA.wife_working === 'flexible' || profileB.wife_working === 'flexible') {
      score += WEIGHTS.PREFERENCES * 0.15;
    } else {
      score += WEIGHTS.PREFERENCES * 0.05;
    }
  } else {
    score += WEIGHTS.PREFERENCES * 0.125;
  }

  // Looking for description similarity (text analysis)
  if (profileA.looking_for_description && profileB.looking_for_description) {
    const similarity = calculateTextSimilarity(
      profileA.looking_for_description,
      profileB.looking_for_description
    );
    score += WEIGHTS.PREFERENCES * 0.25 * similarity;
    if (similarity > 0.5) {
      reasons.push('Similar preferences');
    }
  } else {
    score += WEIGHTS.PREFERENCES * 0.125;
  }

  return score;
}

/**
 * Simple text similarity using keyword overlap
 */
function calculateTextSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(textA.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(textB.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return 0.5;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  return overlap / Math.min(wordsA.size, wordsB.size);
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get AI-generated match suggestions for a profile
 * Production-ready version with:
 * - Pagination to get more candidates
 * - Already-suggested profile exclusion
 * - Better error handling and logging
 */
export async function getAIRecommendations(
  profileId: string,
  limit: number = 10
): Promise<MatchSuggestion[]> {
  try {
    console.log('[AI Matching] Getting recommendations for profile:', profileId);

    // The source profile belongs to the *caller*, so its user row is read from `users` and
    // not from `user_public_profiles` - the view deliberately excludes the signed-in user
    // (`auth_id IS DISTINCT FROM auth.uid()`), so embedding it here would return null and
    // the gender check below would abandon the whole call. The caller's own row is exactly
    // what `users` still serves after 00013 (MEXA-261), so this is two queries, not one.
    const { data: sourceProfileRow, error: sourceError } = await supabase
      .from('shidduch_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (sourceError || !sourceProfileRow) {
      console.error('[AI Matching] Error fetching source profile:', sourceError);
      return [];
    }

    const { data: sourceUser, error: sourceUserError } = await supabase
      .from('users')
      .select('first_name, date_of_birth, gender, current_city, current_state, current_country')
      .eq('id', sourceProfileRow.user_id)
      .maybeSingle();

    if (sourceUserError) {
      console.error('[AI Matching] Error fetching source profile user:', sourceUserError);
      return [];
    }

    // Reassembled under `users` so calculateCompatibility() sees the shape the embedded
    // query used to produce - with an `age` in place of the `date_of_birth` it selected,
    // because that is what a candidate now carries (MEXA-320). This one is the caller's own
    // row, so the birthdate is theirs to read and the age is computed here.
    const sourceProfile = {
      ...sourceProfileRow,
      users: sourceUser
        ? { ...sourceUser, age: calculateAge(sourceUser.date_of_birth) }
        : undefined,
    };

    // Handle missing gender data
    const sourceGender = sourceProfile.users?.gender;
    if (!sourceGender) {
      console.warn('[AI Matching] Source profile has no gender set, returning empty results');
      return [];
    }

    // Determine opposite gender for matching (traditional shidduch model)
    const oppositeGender = sourceGender === 'male' ? 'female' : 'male';

    // Get profiles that have already been suggested to avoid duplicates
    const { data: existingSuggestions } = await supabase
      .from('shidduch_suggestions')
      .select('profile_b_id')
      .eq('profile_a_id', profileId);

    const alreadySuggestedIds = new Set(
      (existingSuggestions || []).map((s) => s.profile_b_id)
    );

    // Fetch potential candidates - get more to ensure enough after filtering
    // Using a larger limit since we filter down after.
    //
    // This used to embed `users:users!shidduch_profiles_user_id_fkey(...)`. Candidates are
    // other people, and `users` has been own-row-only since 00013 (MEXA-261), so every
    // candidate's embed came back null - which the gender filter below reads as "not a
    // match", so the whole list came back empty. The user columns come from
    // `user_public_profiles` in a second query keyed on the candidates' user ids.
    const { data: candidates, error: candidatesError } = await supabase
      .from('shidduch_profiles')
      .select('*')
      .eq('profile_visible', true)
      .eq('accepting_suggestions', true)
      .neq('id', profileId)
      .limit(500); // Fetch more to have enough after filtering

    if (candidatesError) {
      console.error('[AI Matching] Error fetching candidates:', candidatesError);
      return [];
    }

    const candidateUserIds = [
      ...new Set((candidates ?? []).map((candidate) => candidate.user_id)),
    ].filter((id): id is string => !!id);

    const { data: candidateUsers, error: candidateUsersError } = await supabase
      .from('user_public_profiles')
      .select('id, first_name, age, gender, current_city, current_state, current_country')
      .in('id', candidateUserIds);

    if (candidateUsersError) {
      console.error('[AI Matching] Error fetching candidate users:', candidateUsersError);
      return [];
    }

    // The view withholds anyone inactive, blocked either way, or the caller themselves, so a
    // candidate with no entry here drops out at the gender filter below. The embedded version
    // scored and returned those profiles.
    const candidateUsersById = new Map((candidateUsers ?? []).map((u) => [u.id, u]));

    console.log('[AI Matching] Found', candidates?.length || 0, 'candidate profiles');

    // Filter and score candidates
    const scoredMatches: MatchSuggestion[] = (candidates || [])
      .map((candidate) => ({
        ...candidate,
        users: candidate.user_id ? candidateUsersById.get(candidate.user_id) : undefined,
      }))
      .filter((candidate) => {
        // Must be opposite gender
        if (candidate.users?.gender !== oppositeGender) return false;
        // Skip already suggested profiles (unless you want to show them again)
        // Uncomment the next line to exclude already suggested profiles:
        // if (alreadySuggestedIds.has(candidate.id)) return false;
        return true;
      })
      .map((candidate) => ({
        profile: candidate as ProfileForMatching,
        score: calculateCompatibility(
          sourceProfile as ProfileForMatching,
          candidate as ProfileForMatching
        ),
      }))
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, limit);

    console.log('[AI Matching] Returning', scoredMatches.length, 'top matches');
    if (scoredMatches.length > 0) {
      console.log('[AI Matching] Top match score:', scoredMatches[0].score.total);
    }

    return scoredMatches;
  } catch (error) {
    console.error('[AI Matching] Error getting AI recommendations:', error);
    return [];
  }
}

/**
 * Save AI suggestion to database
 */
export async function saveAISuggestion(
  profileAId: string,
  profileBId: string,
  score: CompatibilityScore
): Promise<boolean> {
  try {
    const { error } = await supabase.from('shidduch_suggestions').insert({
      profile_a_id: profileAId,
      profile_b_id: profileBId,
      suggested_by_type: 'algorithm',
      compatibility_score: score.total,
      score_breakdown: score.breakdown,
      status: 'pending',
    });

    if (error) {
      console.error('Error saving AI suggestion:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving AI suggestion:', error);
    return false;
  }
}
