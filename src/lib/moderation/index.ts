/**
 * Content Moderation Utility
 *
 * Filters explicit, inappropriate, or harmful content from user inputs.
 * Provides both detection and sanitization functions.
 *
 * Two rules for every pattern in here (MEXA-337):
 *
 * 1. **No trailing `\w*` on a short stem.** A stem plus `\w*` matches the start of any
 *    longer word: `\b(wh+o+r+e+|h+o+)\w*` flagged "home", "hope", "host", "holiday" and
 *    "honestly", and `\b(s+h+i+t+|sht)\w*` flagged "shtetl", "shtick" and "shtreimel".
 *    Each pattern instead ends at `\b`, with the real suffixes spelled out.
 * 2. **No lookbehind and no named groups.** Hermes, the engine the app runs on, does not
 *    support them, so a pattern that works in Node can throw on device.
 *
 * `scripts/check-moderation.mjs` is the corpus: it runs offline and it is the thing that
 * proves a change here did not start rejecting ordinary answers. Run it after any edit.
 */

// Explicit / harmful words and patterns. Each one blocks the content outright.
const EXPLICIT_PATTERNS = [
  // Explicit sexual terms and insults
  /\b(?:f+u+c+k+|f+\*+c+k+|fvck+|fuk+)(?:s|ed|er|ers|ing|face|faces|tard|tards)?\b/gi,
  /\b(?:bull)?(?:s+h+i+t+|sh\*t)(?:s|y|ty|tier|tiest|ed|ing|head|heads|hole|holes)?\b/gi,
  /\b(?:a+s+s+h+o+l+e+s*|a\*\*hole|a\*\*holes)\b/gi,
  /\b(?:b+i+t+c+h+|b\*tch)(?:es|ed|ing|y)?\b/gi,
  /\b(?:d+i+c+k+|d\*ck)(?:s|head|heads|ish)?\b/gi,
  /\b(?:p+u+s+s+y+|pussies|p\*ssy)\b/gi,
  /\b(?:c+u+n+t+s*|c\*nt|c\*nts)\b/gi,
  /\b(?:c+o+c+k+s*)\b/gi,
  // Spelled out rather than `nigg\w*`, which also caught "niggle" and "niggardly".
  /\b(?:n+i+g+g+(?:a+|e+r+)s*|n\*gg(?:a|er)s?)\b/gi,
  /\b(?:f+a+g+s*|f+a+g+g+o+t+s*)\b/gi,
  /\b(?:r+e+t+a+r+d+(?:s|ed|ing)?)\b/gi,
  // Bare "ho" is gone: it is the word-boundary bug from MEXA-337. "hoe"/"hoes" stay.
  /\b(?:wh+o+r+e+s*|wh+o+r+i+n+g+|h+o+e+s*)\b/gi,
  /\b(?:sl+u+t+(?:s|y|ty)?)\b/gi,
  /\b(?:p+o+r+n+(?:o|os|hub|ography|ographic)?)\b/gi,
  /\b(?:xxx+|x+[-\s]?rated)\b/gi,

  // Violence and threats. Threats are phrases, not single words: bare "die" blocked
  // "I will die on that hill" and bare "murder" blocked "a good murder mystery". The
  // phrase has to match the *target*, not the speaker, or the filter only catches a
  // first-person threat and misses "someone should murder you" (MEXA-342, Guts).
  //
  // Who is doing it, named: "kill you", "murder you", "stab you".
  /\b(?:k+i+l+l+\s+(?:you|yourself|u|ur\s*self)|kys)\b/gi,
  /\b(?:m+u+r+d+e+r+|s+t+a+b+)(?:s|ing)?\s+(?:you|u|yourself|her|him|them)\b/gi,
  /\bdeath\s+threats?\b/gi,
  /\b(?:i\s*(?:'|’)?(?:ll|m)|i\s+(?:will|am)|im|we\s+(?:will|are)|gonna|going\s+to)\s+(?:gonna\s+|going\s+to\s+)?(?:kill|murder|rape|stab|hurt)\s+(?:you|u|her|him|them|yourself)\b/gi,
  // Nobody named, so the harm lands on "you": "you're gonna get murdered".
  /\byou(?:\s*(?:'|’)?re|\s+are)?\s+(?:going\s+to\s+|gonna\s+|will\s+|about\s+to\s+|deserve\s+to\s+|should\s+)?(?:get|be)\s+(?:murdered|killed|stabbed|shot|raped|beaten\s+up)\b/gi,
  // "hurt" needs the intent spelled out, because "did you get hurt?" is a kind question.
  /\byou(?:\s*(?:'|’)?re|\s+are)?\s+(?:going\s+to|gonna|will|deserve\s+to)\s+(?:get|be)\s+hurt\b/gi,
  /\b(?:you\s+should\s+die|you\s+(?:deserve|ought)\s+to\s+die|go\s+die|die\s+in\s+a\s+fire)\b/gi,
  /\bhope\s+(?:that\s+)?(?:you|u)\s+(?:get\s+)?(?:die|dies|hurt|murdered|killed|stabbed|shot|raped)\b/gi,
  /\bwish\s+(?:you|u)\s+(?:were\s+dead|would\s+die)\b/gi,
  /\b(?:someone|somebody|some\s?one|he|she|they|everyone)\s+(?:should|ought\s+to|will|is\s+going\s+to|needs\s+to|is\s+gonna)\s+(?:kill|murder|stab|hurt|rape|shoot)\s+(?:you|u|her|him|them)\b/gi,
  /\brap(?:e|es|ed|ing|ist|ists)\b/gi,

  // Drugs (context-dependent)
  /\b(?:cocaine|heroin|meth)\b/gi,

  // Scam/spam patterns
  /\b(?:venmo|cashapp|cash\s*app|paypal|zelle)\s*(?:me|now)\b/gi,
  // The old `(money|cash|$)` used `$` as an end-of-string anchor, not a dollar sign, so
  // any message ending in "send" was blocked.
  /\b(?:send|wire)\s+(?:me\s+)?(?:money|cash|\$\s*\d+)\b/gi,
  /\bcrypto\s*invest(?:ment|ments|ing)?\b/gi,
];

/**
 * Matches that look explicit but are not, compared case-sensitively so the insult still
 * blocks. "Dick" is a name a grandfather on this app plausibly has; "dick" is not.
 */
const ALLOWED_MATCHES = new Set(['Dick', 'Dicks']);

// Contact info patterns (for dating app safety)
const CONTACT_INFO_PATTERNS = [
  // Phone numbers (various formats)
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{10,11}\b/g,

  // Social media handles (allow but flag). The leading space or line start keeps this off
  // the local part of an email address, which the email pattern below already covers.
  /(?:^|[\s(])@[A-Za-z][A-Za-z0-9._]{2,}/g,

  // URLs
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,

  // Emails
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

// Sensitive personal info patterns
const PERSONAL_INFO_PATTERNS = [
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,

  // Credit card numbers
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
];

export interface ModerationResult {
  isClean: boolean;
  containsExplicit: boolean;
  containsContactInfo: boolean;
  containsPersonalInfo: boolean;
  flaggedPatterns: string[];
  sanitizedContent: string;
  warnings: string[];
}

/**
 * All matches for a global pattern, with `lastIndex` reset first.
 *
 * Every pattern here is a module-level `/g` regex, so it carries `lastIndex` between
 * calls. `pattern.test(content)` used to leak that state: the same message moderated
 * twice got two different verdicts.
 */
function findMatches(content: string, pattern: RegExp): string[] {
  pattern.lastIndex = 0;
  return content.match(pattern) ?? [];
}

/** Keep the first character, asterisk the rest: "fuck" -> "f***". */
function maskMatch(match: string): string {
  return match[0] + '*'.repeat(Math.max(match.length - 1, 0));
}

/**
 * Check if content contains explicit or inappropriate material
 */
export function moderateContent(content: string): ModerationResult {
  const warnings: string[] = [];
  const flagged = new Set<string>();

  let containsExplicit = false;
  let containsContactInfo = false;
  let containsPersonalInfo = false;
  let sanitizedContent = content;

  // Check for explicit content
  for (const pattern of EXPLICIT_PATTERNS) {
    const matches = findMatches(content, pattern).filter((m) => !ALLOWED_MATCHES.has(m.trim()));
    if (matches.length === 0) continue;

    containsExplicit = true;
    for (const match of matches) flagged.add(match);
    pattern.lastIndex = 0;
    sanitizedContent = sanitizedContent.replace(pattern, (match) =>
      ALLOWED_MATCHES.has(match.trim()) ? match : maskMatch(match)
    );
  }

  // Check for contact info (warn but don't block)
  for (const pattern of CONTACT_INFO_PATTERNS) {
    if (findMatches(content, pattern).length > 0) {
      containsContactInfo = true;
      warnings.push('Content may contain contact information');
      break;
    }
  }

  // Check for personal info (block)
  for (const pattern of PERSONAL_INFO_PATTERNS) {
    const matches = findMatches(content, pattern);
    if (matches.length === 0) continue;

    containsPersonalInfo = true;
    for (const match of matches) flagged.add(match);
    pattern.lastIndex = 0;
    sanitizedContent = sanitizedContent.replace(pattern, '***-**-****');
  }

  const isClean = !containsExplicit && !containsPersonalInfo;

  return {
    isClean,
    containsExplicit,
    containsContactInfo,
    containsPersonalInfo,
    flaggedPatterns: [...flagged],
    sanitizedContent,
    warnings,
  };
}

/**
 * Quick check if content is appropriate
 */
export function isContentClean(content: string): boolean {
  const result = moderateContent(content);
  return result.isClean;
}

/**
 * Sanitize content by removing/replacing inappropriate content
 */
export function sanitizeContent(content: string): string {
  const result = moderateContent(content);
  return result.sanitizedContent;
}

/**
 * The word that tripped the filter, trimmed and quoted for an error message. Without it
 * the user is told to "revise" a sentence with no idea which part to change (MEXA-337).
 */
function quoteFirstFlagged(result: ModerationResult): string {
  const term = result.flaggedPatterns[0]?.trim();
  return term ? ` (“${term}”)` : '';
}

/**
 * Validate content for profile fields (stricter than messages)
 */
export function validateProfileContent(content: string): {
  isValid: boolean;
  error?: string;
} {
  const result = moderateContent(content);

  if (result.containsExplicit) {
    return {
      isValid: false,
      error: `This content contains inappropriate language${quoteFirstFlagged(result)}. Please revise.`,
    };
  }

  if (result.containsPersonalInfo) {
    return {
      isValid: false,
      error: 'Please do not share sensitive personal information like SSN or credit card numbers.',
    };
  }

  return { isValid: true };
}

/**
 * Validate message content (slightly more lenient than profile)
 */
export function validateMessageContent(content: string): {
  isValid: boolean;
  warning?: string;
  error?: string;
} {
  const result = moderateContent(content);

  if (result.containsExplicit) {
    return {
      isValid: false,
      error: `Your message contains inappropriate content${quoteFirstFlagged(result)} and cannot be sent.`,
    };
  }

  if (result.containsPersonalInfo) {
    return {
      isValid: false,
      error: 'For your safety, please do not share sensitive personal information.',
    };
  }

  if (result.containsContactInfo) {
    return {
      isValid: true,
      warning: 'Be careful when sharing contact information with people you just met.',
    };
  }

  return { isValid: true };
}

export default {
  moderateContent,
  isContentClean,
  sanitizeContent,
  validateProfileContent,
  validateMessageContent,
};
