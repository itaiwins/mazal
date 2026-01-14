/**
 * Content Moderation Utility
 *
 * Filters explicit, inappropriate, or harmful content from user inputs.
 * Provides both detection and sanitization functions.
 */

// Common explicit/harmful words and patterns (basic list - extend as needed)
const EXPLICIT_PATTERNS = [
  // Explicit sexual terms
  /\b(f+u+c+k+|f+\*+c+k+|fvck|fuk)\w*/gi,
  /\b(s+h+i+t+|sh\*t|sht)\w*/gi,
  /\b(a+s+s+h+o+l+e+|a\*\*hole)\w*/gi,
  /\b(b+i+t+c+h+|b\*tch)\w*/gi,
  /\b(d+i+c+k+|d\*ck)\w*/gi,
  /\b(p+u+s+s+y+|p\*ssy)\w*/gi,
  /\b(c+u+n+t+|c\*nt)\w*/gi,
  /\b(c+o+c+k+)\b/gi,
  /\b(n+i+g+g+\w*|n\*gger)\w*/gi,
  /\b(f+a+g+g*o*t*)\w*/gi,
  /\b(r+e+t+a+r+d+)\w*/gi,
  /\b(wh+o+r+e+|h+o+)\w*/gi,
  /\b(sl+u+t+)\w*/gi,
  /\b(p+o+r+n+)\w*/gi,
  /\b(xxx+|x+rated)\b/gi,

  // Violence and threats
  /\b(k+i+l+l+\s+(you|yourself|u))\b/gi,
  /\b(die|death\s+threat)\b/gi,
  /\b(murder|rape)\b/gi,

  // Drugs (context-dependent)
  /\b(cocaine|heroin|meth)\b/gi,

  // Scam/spam patterns
  /\b(venmo|cashapp|paypal)\s*(me|now)/gi,
  /\b(send\s*(me\s*)?(money|cash|$))/gi,
  /\b(crypto\s*invest(ment)?)\b/gi,
];

// Contact info patterns (for dating app safety)
const CONTACT_INFO_PATTERNS = [
  // Phone numbers (various formats)
  /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  /\b\d{10,11}\b/g,

  // Social media handles (allow but flag)
  /@\w{3,}/g,

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
 * Check if content contains explicit or inappropriate material
 */
export function moderateContent(content: string): ModerationResult {
  const warnings: string[] = [];
  const flaggedPatterns: string[] = [];

  let containsExplicit = false;
  let containsContactInfo = false;
  let containsPersonalInfo = false;
  let sanitizedContent = content;

  // Check for explicit content
  for (const pattern of EXPLICIT_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      containsExplicit = true;
      flaggedPatterns.push(...matches);
      // Replace with asterisks
      sanitizedContent = sanitizedContent.replace(pattern, (match) =>
        match[0] + '*'.repeat(match.length - 1)
      );
    }
  }

  // Check for contact info (warn but don't block)
  for (const pattern of CONTACT_INFO_PATTERNS) {
    if (pattern.test(content)) {
      containsContactInfo = true;
      warnings.push('Content may contain contact information');
      break;
    }
  }

  // Check for personal info (block)
  for (const pattern of PERSONAL_INFO_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      containsPersonalInfo = true;
      flaggedPatterns.push(...matches);
      // Mask personal info
      sanitizedContent = sanitizedContent.replace(pattern, '***-**-****');
    }
  }

  const isClean = !containsExplicit && !containsPersonalInfo;

  return {
    isClean,
    containsExplicit,
    containsContactInfo,
    containsPersonalInfo,
    flaggedPatterns,
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
      error: 'This content contains inappropriate language. Please revise.',
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
      error: 'Your message contains inappropriate content and cannot be sent.',
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
