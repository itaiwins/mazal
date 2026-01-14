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
  // ==========================================
  // JEWISH-THEMED PROMPTS
  // ==========================================
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
  {
    id: 'deli_order',
    text: 'My go-to deli order:',
    category: 'jewish',
    placeholder: 'Pastrami on rye with extra mustard...',
  },
  {
    id: 'israel_memory',
    text: 'My favorite Israel memory:',
    category: 'jewish',
    placeholder: 'Watching sunrise at Masada...',
  },
  {
    id: 'jewish_guilty_pleasure',
    text: 'Jewish guilty pleasure:',
    category: 'jewish',
    placeholder: 'Eating all the gelt before Chanukah...',
  },
  {
    id: 'seder_role',
    text: 'At the Seder, I\'m the one who...',
    category: 'jewish',
    placeholder: 'Actually reads the whole Haggadah...',
  },
  {
    id: 'synagogue_style',
    text: 'My synagogue vibe is...',
    category: 'jewish',
    placeholder: 'Front row singer or back row socializer...',
  },
  {
    id: 'jewish_mother_says',
    text: 'My Jewish mother always says...',
    category: 'jewish',
    placeholder: 'You\'re not wearing that, are you?',
  },
  {
    id: 'best_challah',
    text: 'The secret to great challah is...',
    category: 'jewish',
    placeholder: 'Extra eggs and a lot of love...',
  },
  {
    id: 'jewish_camp',
    text: 'My Jewish camp/youth group experience:',
    category: 'jewish',
    placeholder: 'Color war champion 3 years running...',
  },
  {
    id: 'bagel_opinion',
    text: 'Bagel hot take:',
    category: 'jewish',
    placeholder: 'Everything bagels are overrated. There, I said it.',
  },
  {
    id: 'birthright_story',
    text: 'My Birthright story:',
    category: 'jewish',
    placeholder: 'That time in the Negev when...',
  },

  // ==========================================
  // PERSONALITY PROMPTS
  // ==========================================
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
  {
    id: 'proudest_moment',
    text: 'I\'m most proud of...',
    category: 'personality',
    placeholder: 'Starting my own business, running a marathon...',
  },
  {
    id: 'pet_peeve',
    text: 'My biggest pet peeve:',
    category: 'personality',
    placeholder: 'People who don\'t RSVP...',
  },
  {
    id: 'life_motto',
    text: 'My life motto:',
    category: 'personality',
    placeholder: 'Work hard, brunch harder...',
  },
  {
    id: 'comfort_zone',
    text: 'I\'m trying to get better at...',
    category: 'personality',
    placeholder: 'Speaking up, cooking, being patient...',
  },
  {
    id: 'superpower',
    text: 'If I had a superpower, it would be...',
    category: 'personality',
    placeholder: 'Reading minds or teleportation...',
  },
  {
    id: 'passionate_about',
    text: 'I\'m weirdly passionate about...',
    category: 'personality',
    placeholder: 'Spreadsheets, coffee beans, architecture...',
  },
  {
    id: 'introvert_extrovert',
    text: 'On the introvert/extrovert scale:',
    category: 'personality',
    placeholder: 'Extroverted introvert who needs recharge time...',
  },
  {
    id: 'hill_to_die_on',
    text: 'The hill I\'ll die on:',
    category: 'personality',
    placeholder: 'Pineapple belongs on pizza...',
  },
  {
    id: 'love_language',
    text: 'My love language is...',
    category: 'personality',
    placeholder: 'Quality time and acts of service...',
  },
  {
    id: 'biggest_fear',
    text: 'My irrational fear:',
    category: 'personality',
    placeholder: 'Birds. Don\'t ask...',
  },
  {
    id: 'overuse_phrase',
    text: 'A phrase I overuse:',
    category: 'personality',
    placeholder: '"That\'s so funny" even when it\'s not...',
  },

  // ==========================================
  // DATING PROMPTS
  // ==========================================
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
  {
    id: 'green_flag',
    text: 'A green flag I look for:',
    category: 'dating',
    placeholder: 'They\'re kind to waiters and call their mom...',
  },
  {
    id: 'relationship_goal',
    text: 'My relationship goal:',
    category: 'dating',
    placeholder: 'Finding my person to build a life with...',
  },
  {
    id: 'together_we_could',
    text: 'Together we could...',
    category: 'dating',
    placeholder: 'Travel the world, start a family, eat our way through NYC...',
  },
  {
    id: 'non_negotiable',
    text: 'A non-negotiable for me:',
    category: 'dating',
    placeholder: 'Sense of humor and ambition...',
  },
  {
    id: 'perfect_night_in',
    text: 'Perfect night in looks like:',
    category: 'dating',
    placeholder: 'Cooking together, wine, and a good movie...',
  },
  {
    id: 'swipe_right_if',
    text: 'Swipe right if you...',
    category: 'dating',
    placeholder: 'Love adventure and appreciate a good pun...',
  },
  {
    id: 'date_me_if',
    text: 'You should date me if...',
    category: 'dating',
    placeholder: 'You want someone who will always make you laugh...',
  },
  {
    id: 'first_date_energy',
    text: 'My first date energy is...',
    category: 'dating',
    placeholder: 'Nervous but excited with lots of questions...',
  },
  {
    id: 'meet_the_parents',
    text: 'When you meet my parents...',
    category: 'dating',
    placeholder: 'Be prepared for a lot of food and questions...',
  },
  {
    id: 'worst_date_story',
    text: 'My worst date story:',
    category: 'dating',
    placeholder: 'They brought their mom. Seriously.',
  },
  {
    id: 'flirting_style',
    text: 'My flirting style:',
    category: 'dating',
    placeholder: 'Awkward jokes and too many compliments...',
  },

  // ==========================================
  // LIFESTYLE PROMPTS
  // ==========================================
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
  {
    id: 'morning_routine',
    text: 'My morning routine:',
    category: 'lifestyle',
    placeholder: 'Snooze three times, rush out, grab coffee...',
  },
  {
    id: 'guilty_pleasure_show',
    text: 'My guilty pleasure show:',
    category: 'lifestyle',
    placeholder: 'Reality TV that I\'m not ashamed of...',
  },
  {
    id: 'favorite_cuisine',
    text: 'Cuisine I could eat forever:',
    category: 'lifestyle',
    placeholder: 'Italian, sushi, or anything Mediterranean...',
  },
  {
    id: 'workout_style',
    text: 'My workout style:',
    category: 'lifestyle',
    placeholder: 'Morning runs, yoga, or does walking to brunch count?',
  },
  {
    id: 'travel_style',
    text: 'My travel style:',
    category: 'lifestyle',
    placeholder: 'Detailed itinerary or go with the flow...',
  },
  {
    id: 'dream_vacation',
    text: 'Dream vacation:',
    category: 'lifestyle',
    placeholder: 'Beach resort, European adventure, or safari...',
  },
  {
    id: 'weekend_plans',
    text: 'My ideal weekend:',
    category: 'lifestyle',
    placeholder: 'A mix of adventure and lazy mornings...',
  },
  {
    id: 'cooking_specialty',
    text: 'My cooking specialty:',
    category: 'lifestyle',
    placeholder: 'Reservations. Just kidding, I make great pasta...',
  },
  {
    id: 'spotify_wrapped',
    text: 'My Spotify Wrapped says:',
    category: 'lifestyle',
    placeholder: 'Top 1% listener of Taylor Swift...',
  },
  {
    id: 'book_or_tv',
    text: 'Book I\'m reading / Show I\'m watching:',
    category: 'lifestyle',
    placeholder: 'Currently binging...',
  },
  {
    id: 'social_battery',
    text: 'My social battery:',
    category: 'lifestyle',
    placeholder: 'Fully charged on weekends, need recharge Mondays...',
  },
  {
    id: 'coffee_order',
    text: 'My coffee order:',
    category: 'lifestyle',
    placeholder: 'Oat milk latte, no questions asked...',
  },
  {
    id: 'nightlife_vibe',
    text: 'My idea of a night out:',
    category: 'lifestyle',
    placeholder: 'Cocktail bar with friends, not a club...',
  },

  // ==========================================
  // FUN PROMPTS
  // ==========================================
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
  {
    id: 'celebrity_crush',
    text: 'Celebrity crush:',
    category: 'fun',
    placeholder: 'Timothée Chalamet and I\'m not sorry...',
  },
  {
    id: 'karaoke_song',
    text: 'My go-to karaoke song:',
    category: 'fun',
    placeholder: 'Don\'t Stop Believin\' - every time...',
  },
  {
    id: 'bucket_list',
    text: 'On my bucket list:',
    category: 'fun',
    placeholder: 'See the Northern Lights, learn to surf...',
  },
  {
    id: 'childhood_dream',
    text: 'My childhood dream job:',
    category: 'fun',
    placeholder: 'Astronaut, but here I am in marketing...',
  },
  {
    id: 'never_have_i_ever',
    text: 'Never have I ever:',
    category: 'fun',
    placeholder: 'Broken a bone (knock on wood)...',
  },
  {
    id: 'two_truths_lie',
    text: 'Two truths and a lie:',
    category: 'fun',
    placeholder: 'I\'ve met a celebrity, I can\'t whistle, I\'ve been skydiving...',
  },
  {
    id: 'desert_island',
    text: 'Desert island essentials:',
    category: 'fun',
    placeholder: 'Sunscreen, a good book, and endless hummus...',
  },
  {
    id: 'embarrassing_moment',
    text: 'Most embarrassing moment:',
    category: 'fun',
    placeholder: 'Waved back at someone who wasn\'t waving at me...',
  },
  {
    id: 'worst_habit',
    text: 'My worst habit:',
    category: 'fun',
    placeholder: 'Snoozing my alarm 10 times...',
  },
  {
    id: 'would_you_rather',
    text: 'Would you rather...',
    category: 'fun',
    placeholder: 'Always be 10 minutes late or 20 minutes early?',
  },
  {
    id: 'zombie_apocalypse',
    text: 'In a zombie apocalypse, I\'d be:',
    category: 'fun',
    placeholder: 'The strategist who finds all the snacks...',
  },
  {
    id: 'random_fact',
    text: 'Random thing I know too much about:',
    category: 'fun',
    placeholder: 'The history of pizza or true crime...',
  },
  {
    id: 'unpopular_opinion',
    text: 'My unpopular opinion:',
    category: 'fun',
    placeholder: 'The book is not always better than the movie...',
  },
  {
    id: 'party_trick',
    text: 'My party trick:',
    category: 'fun',
    placeholder: 'I can name all 50 states in under a minute...',
  },
  {
    id: 'spirit_animal',
    text: 'My spirit animal:',
    category: 'fun',
    placeholder: 'A golden retriever - friendly and food-motivated...',
  },
  {
    id: 'last_google_search',
    text: 'My last Google search:',
    category: 'fun',
    placeholder: '"Is it normal to talk to your plants?"',
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
