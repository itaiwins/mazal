/**
 * Jewish Identity Constants
 *
 * All options for Jewish backgrounds, observance, and cultural elements
 */

export const JEWISH_BACKGROUNDS = [
  { id: 'orthodox', label: 'Orthodox', emoji: '✡️' },
  { id: 'modern_orthodox', label: 'Modern Orthodox', emoji: '✡️' },
  { id: 'hasidic', label: 'Hasidic', emoji: '✡️' },
  { id: 'chabad', label: 'Chabad', emoji: '✡️' },
  { id: 'conservative', label: 'Conservative', emoji: '✡️' },
  { id: 'reform', label: 'Reform', emoji: '✡️' },
  { id: 'reconstructionist', label: 'Reconstructionist', emoji: '✡️' },
  { id: 'secular', label: 'Secular / Cultural', emoji: '🌟' },
  { id: 'just_jewish', label: 'Just Jewish', emoji: '💫' },
  { id: 'converting', label: 'Converting', emoji: '🌱' },
  { id: 'sephardic', label: 'Sephardic', emoji: '🌍' },
  { id: 'mizrachi', label: 'Mizrachi', emoji: '🌍' },
] as const;

export const OBSERVANCE_LEVELS = [
  { id: 'very_observant', label: 'Very Observant', description: 'I follow halacha closely' },
  { id: 'somewhat_observant', label: 'Somewhat Observant', description: 'I pick and choose traditions' },
  { id: 'culturally_jewish', label: 'Culturally Jewish', description: 'Jewish identity without religious practice' },
  { id: 'not_observant', label: 'Not Observant', description: 'Secular' },
] as const;

export const SHABBAT_OBSERVANCE = [
  { id: 'always', label: 'Every Week', description: 'Shomer Shabbat' },
  { id: 'sometimes', label: 'Sometimes', description: 'When I can' },
  { id: 'rarely', label: 'Rarely', description: 'High holidays mainly' },
  { id: 'never', label: 'Not Really', description: 'It\'s just Saturday' },
] as const;

export const KOSHER_LEVELS = [
  { id: 'strict', label: 'Strictly Kosher', description: 'Glatt, separate dishes, the whole deal' },
  { id: 'kosher_style', label: 'Kosher Style', description: 'No pork or shellfish, but flexible' },
  { id: 'at_home', label: 'Kosher at Home', description: 'Keep it at home, flexible outside' },
  { id: 'not_kosher', label: 'Not Kosher', description: 'I eat everything' },
] as const;

export const SYNAGOGUE_ATTENDANCE = [
  { id: 'weekly', label: 'Weekly', description: 'Every Shabbat' },
  { id: 'holidays', label: 'Holidays', description: 'High holidays and some others' },
  { id: 'rarely', label: 'Rarely', description: 'Special occasions' },
  { id: 'never', label: 'Never', description: 'Not for me' },
] as const;

export const JEWISH_EDUCATION = [
  { id: 'day_school', label: 'Day School', description: 'Jewish day school education' },
  { id: 'hebrew_school', label: 'Hebrew School', description: 'Afternoon/Sunday school' },
  { id: 'yeshiva', label: 'Yeshiva', description: 'Yeshiva/seminary experience' },
  { id: 'seminary', label: 'Seminary', description: 'Women\'s seminary' },
  { id: 'none', label: 'No Formal', description: 'No formal Jewish education' },
  { id: 'other', label: 'Other', description: 'Different path' },
] as const;

export const LOOKING_FOR = [
  { id: 'serious', label: 'Something Serious', description: 'Looking for a real relationship' },
  { id: 'marriage_minded', label: 'Marriage-Minded', description: 'Ready to find my person' },
  { id: 'open', label: 'Let\'s See', description: 'Open to what happens' },
  { id: 'casual', label: 'Something Casual', description: 'Keeping it light' },
] as const;

export const WANTS_CHILDREN = [
  { id: 'yes', label: 'Want Kids', description: 'Definitely want children' },
  { id: 'have_and_want_more', label: 'Have & Want More', description: 'Have kids, open to more' },
  { id: 'have_and_done', label: 'Have Kids, Done', description: 'Have kids, not having more' },
  { id: 'no', label: 'Don\'t Want Kids', description: 'Kids aren\'t for me' },
  { id: 'open', label: 'Open to Kids', description: 'Could go either way' },
] as const;

export const BADGES = [
  { id: 'birthright', label: 'Birthright Alum', emoji: '✈️', description: 'Did Birthright Israel' },
  { id: 'day_school', label: 'Day School', emoji: '🎓', description: 'Jewish day school educated' },
  { id: 'hebrew_speaker', label: 'Speaks Hebrew', emoji: '🗣️', description: 'Conversational or fluent' },
  { id: 'yiddish_speaker', label: 'Speaks Yiddish', emoji: '🗣️', description: 'Conversational or fluent' },
  { id: 'israeli', label: 'Israeli', emoji: '🇮🇱', description: 'From Israel' },
  { id: 'greek_life', label: 'Greek Life', emoji: '🏛️', description: 'Fraternity or sorority member' },
  { id: 'verified_jewish', label: 'Verified Jewish', emoji: '🔯', description: 'Jewish identity verified' },
  { id: 'photo_verified', label: 'Photo Verified', emoji: '✓', description: 'Photos verified as real' },
] as const;

/**
 * Label lookups for the lists above (MEXA-338, walkthrough finding 8).
 *
 * The columns on `users` store the `id` of an option, not its label, so anything that
 * renders one straight from the row shows "modern_orthodox" to the user. Every display
 * site goes through these instead.
 *
 * An unknown id gets title-cased rather than dropped: rows written before a list changed
 * still have to render as something, and a blank chip reads as missing data rather than
 * stale data.
 */
const titleCase = (value: string): string =>
  value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

type Option = { readonly id: string; readonly label: string; readonly description?: string };

const labelFrom = (options: readonly Option[]) => (id?: string | null): string => {
  if (!id) return '';
  return options.find((o) => o.id === id)?.label ?? titleCase(id);
};

export const jewishBackgroundLabel = labelFrom(JEWISH_BACKGROUNDS);
export const observanceLevelLabel = labelFrom(OBSERVANCE_LEVELS);
export const shabbatObservanceLabel = labelFrom(SHABBAT_OBSERVANCE);
export const kosherLevelLabel = labelFrom(KOSHER_LEVELS);
export const synagogueAttendanceLabel = labelFrom(SYNAGOGUE_ATTENDANCE);
export const jewishEducationLabel = labelFrom(JEWISH_EDUCATION);
export const lookingForLabel = labelFrom(LOOKING_FOR);
export const wantsChildrenLabel = labelFrom(WANTS_CHILDREN);

/** The one-line description under an observance level, or '' when the id is unknown. */
export const observanceLevelDescription = (id?: string | null): string => {
  if (!id) return '';
  return OBSERVANCE_LEVELS.find((o) => o.id === id)?.description ?? '';
};

// Holiday greetings for notifications/features
export const HOLIDAY_GREETINGS = {
  shabbat: 'Shabbat Shalom! 🕯️',
  rosh_hashanah: 'Shanah Tovah! 🍎🍯',
  yom_kippur: 'G\'mar Chatimah Tovah 📜',
  sukkot: 'Chag Sameach! 🌿',
  chanukah: 'Happy Chanukah! 🕎',
  purim: 'Chag Purim Sameach! 🎭',
  passover: 'Chag Pesach Sameach! 🍷',
  shavuot: 'Chag Sameach! 📜',
  tisha_bav: '', // No greeting
} as const;
