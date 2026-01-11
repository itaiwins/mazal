/**
 * Profile Prompts
 *
 * Questions users can answer on their profile
 */

export interface ProfilePrompt {
  id: string;
  text: string;
  category: 'jewish' | 'personality' | 'dating' | 'lifestyle' | 'fun';
  placeholder?: string;
}

export const PROFILE_PROMPTS: ProfilePrompt[] = [
  // Jewish-themed prompts
  {
    id: 'shabbat_looks_like',
    text: 'My Shabbat looks like...',
    category: 'jewish',
    placeholder: 'Friday night dinners with friends...',
  },
  {
    id: 'jewish_food_take',
    text: 'Best Jewish food take:',
    category: 'jewish',
    placeholder: 'Lox should be silky, never chunky...',
  },
  {
    id: 'bubbe_describes',
    text: 'My bubbe would describe me as...',
    category: 'jewish',
    placeholder: 'A good boy who needs to eat more...',
  },
  {
    id: 'favorite_holiday',
    text: 'Favorite Jewish holiday because...',
    category: 'jewish',
    placeholder: 'Passover - 4 cups of wine...',
  },
  {
    id: 'hebrew_name',
    text: 'My Hebrew name is...',
    category: 'jewish',
    placeholder: 'And here\'s the story behind it...',
  },
  {
    id: 'jewish_tradition',
    text: 'A Jewish tradition I love is...',
    category: 'jewish',
    placeholder: 'Breaking the glass at weddings...',
  },

  // Personality prompts
  {
    id: 'geek_out_on',
    text: 'I geek out on...',
    category: 'personality',
    placeholder: 'Jewish history, podcasts, finding the best shakshuka...',
  },
  {
    id: 'friends_describe',
    text: 'My friends would say I\'m...',
    category: 'personality',
    placeholder: 'The one who always has a plan...',
  },
  {
    id: 'unusual_skill',
    text: 'An unusual skill I have:',
    category: 'personality',
    placeholder: 'I can make a mean challah...',
  },
  {
    id: 'controversial_opinion',
    text: 'My most controversial opinion:',
    category: 'personality',
    placeholder: 'Pastrami > Corned beef. Fight me.',
  },

  // Dating prompts
  {
    id: 'way_to_heart',
    text: 'The way to my heart is...',
    category: 'dating',
    placeholder: 'Good food, good conversation, meeting my mom...',
  },
  {
    id: 'ideal_date',
    text: 'My ideal first date:',
    category: 'dating',
    placeholder: 'Coffee, walking, and discovering we both...',
  },
  {
    id: 'looking_for',
    text: 'I\'m looking for someone who...',
    category: 'dating',
    placeholder: 'Can make me laugh and appreciates...',
  },
  {
    id: 'knew_wanted_app',
    text: 'I knew I wanted to try this app when...',
    category: 'dating',
    placeholder: 'My bubbe asked about grandkids again...',
  },

  // Lifestyle prompts
  {
    id: 'sunday_looks_like',
    text: 'A typical Sunday looks like...',
    category: 'lifestyle',
    placeholder: 'Bagels, brunch, and...',
  },
  {
    id: 'cant_live_without',
    text: 'I can\'t live without...',
    category: 'lifestyle',
    placeholder: 'My morning coffee, my dog, and...',
  },
  {
    id: 'currently_obsessed',
    text: 'Currently obsessed with:',
    category: 'lifestyle',
    placeholder: 'This new restaurant, a book, a show...',
  },
  {
    id: 'after_work',
    text: 'After work you\'ll find me...',
    category: 'lifestyle',
    placeholder: 'At the gym, cooking, or...',
  },

  // Fun prompts
  {
    id: 'fun_fact',
    text: 'A fun fact about me:',
    category: 'fun',
    placeholder: 'I\'ve been to 20 countries...',
  },
  {
    id: 'most_spontaneous',
    text: 'Most spontaneous thing I\'ve done:',
    category: 'fun',
    placeholder: 'Booked a trip at 2am...',
  },
  {
    id: 'hidden_talent',
    text: 'My hidden talent:',
    category: 'fun',
    placeholder: 'I can juggle, speak backwards, or...',
  },
  {
    id: 'weirdly_good_at',
    text: 'I\'m weirdly good at:',
    category: 'fun',
    placeholder: 'Parallel parking, trivia, or...',
  },
] as const;

// Get prompts by category
export function getPromptsByCategory(category: ProfilePrompt['category']): ProfilePrompt[] {
  return PROFILE_PROMPTS.filter(p => p.category === category);
}

// Get prompt by ID
export function getPromptById(id: string): ProfilePrompt | undefined {
  return PROFILE_PROMPTS.find(p => p.id === id);
}

// Prompts organized by category for easy access
export const PROMPTS: Record<string, { id: string; question: string }[]> = {
  jewish: PROFILE_PROMPTS.filter(p => p.category === 'jewish').map(p => ({ id: p.id, question: p.text })),
  personality: PROFILE_PROMPTS.filter(p => p.category === 'personality').map(p => ({ id: p.id, question: p.text })),
  dating: PROFILE_PROMPTS.filter(p => p.category === 'dating').map(p => ({ id: p.id, question: p.text })),
  lifestyle: PROFILE_PROMPTS.filter(p => p.category === 'lifestyle').map(p => ({ id: p.id, question: p.text })),
  fun: PROFILE_PROMPTS.filter(p => p.category === 'fun').map(p => ({ id: p.id, question: p.text })),
};

// Icebreaker suggestions for chat
export const ICEBREAKERS = [
  'What\'s your favorite Jewish holiday tradition?',
  'Best challah in town?',
  'Shabbat dinner at your place or mine? 😉',
  'What would your Bubbe say about me?',
  'If you could only eat one Jewish food forever...',
  'Tell me about your last Birthright trip!',
  'What\'s your go-to order at a Jewish deli?',
  'Beach vacation or ski trip?',
  'Dogs or cats?',
  'Early bird or night owl?',
] as const;
