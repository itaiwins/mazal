/**
 * Animation Constants
 *
 * Shared spring configurations and timing for premium Apple-like animations.
 * All interactive elements should use these configs for consistency.
 */

import { Easing } from 'react-native-reanimated';

/**
 * Spring configurations for physics-based animations
 * - damping: How quickly the spring settles (higher = faster settling)
 * - stiffness: How "tight" the spring feels (higher = snappier)
 * - mass: Weight of the element (higher = more momentum)
 */
export const SPRING_CONFIGS = {
  // Snappy response for interactive elements (buttons, taps)
  INTERACTIVE: { damping: 15, stiffness: 300, mass: 0.8 },

  // Gentle motion for reveals and subtle movements
  GENTLE: { damping: 20, stiffness: 100, mass: 1 },

  // Bouncy feel for celebrations and emphasis
  BOUNCY: { damping: 8, stiffness: 200, mass: 0.6 },

  // Heavy motion for cards with perceived weight
  HEAVY: { damping: 25, stiffness: 150, mass: 1.5 },

  // Quick micro-interactions
  QUICK: { damping: 20, stiffness: 400, mass: 0.5 },

  // Card swipe dismiss
  SWIPE_DISMISS: { damping: 18, stiffness: 180, mass: 1 },

  // Bounce back when swipe cancelled
  BOUNCE_BACK: { damping: 15, stiffness: 300, mass: 0.8 },

  // Card lift on interaction
  CARD_LIFT: { damping: 12, stiffness: 200, mass: 0.5 },

  // Scale with subtle spring
  SCALE_SUBTLE: { damping: 20, stiffness: 400 },

  // Profile expand animation
  EXPAND_PROFILE: { damping: 22, stiffness: 150, mass: 1.2 },
} as const;

/**
 * Timing configurations for non-spring animations
 */
export const TIMING_CONFIGS = {
  INSTANT: { duration: 100 },
  FAST: { duration: 150 },
  NORMAL: { duration: 300 },
  SLOW: { duration: 500 },
  EXTRA_SLOW: { duration: 800 },
} as const;

/**
 * Custom easing functions
 */
export const EASING = {
  // Smooth ease in/out for most animations
  SMOOTH: Easing.bezier(0.25, 0.1, 0.25, 1),

  // Decelerate for elements coming to rest
  DECELERATE: Easing.out(Easing.cubic),

  // Accelerate for elements starting motion
  ACCELERATE: Easing.in(Easing.cubic),

  // Bounce overshoot for playful animations
  BOUNCE: Easing.bezier(0.68, -0.55, 0.265, 1.55),

  // Linear for continuous animations
  LINEAR: Easing.linear,
} as const;

/**
 * Animation delay patterns for staggered effects
 */
export const STAGGER_DELAYS = {
  // Fast stagger for list items
  FAST: 40,

  // Standard stagger
  NORMAL: 80,

  // Slow stagger for dramatic reveals
  SLOW: 120,
} as const;

/**
 * Swipe thresholds and velocities
 */
export const SWIPE_CONFIG = {
  // Minimum distance to trigger swipe action
  THRESHOLD: 120,

  // Minimum velocity to trigger swipe regardless of distance
  VELOCITY_THRESHOLD: 500,

  // Maximum rotation angle during swipe
  MAX_ROTATION: 15,

  // How much the Y axis dampens during swipe
  Y_DAMPING: 0.3,
} as const;

/**
 * Card stack configuration
 */
export const CARD_STACK_CONFIG = {
  // Number of visible cards in stack
  VISIBLE_CARDS: 3,

  // Scale for background cards [furthest, middle, front]
  SCALES: [0.85, 0.92, 1.0],

  // Vertical offset for stacked cards
  Y_OFFSETS: [-16, -8, 0],

  // Opacity for background cards
  OPACITIES: [0.6, 0.8, 1.0],
} as const;

/**
 * Match celebration timing
 */
export const CELEBRATION_TIMING = {
  BACKGROUND_BLUR: 300,
  PARTICLES_START: 300,
  PARTICLES_DURATION: 600,
  STAR_ENTER: 600,
  STAR_DURATION: 400,
  TEXT_START: 1000,
  TEXT_DURATION: 500,
  PHOTOS_START: 1500,
  PHOTOS_DURATION: 300,
  BUTTONS_START: 1800,
  TOTAL: 2500,
} as const;

export type SpringConfig = typeof SPRING_CONFIGS[keyof typeof SPRING_CONFIGS];
export type TimingConfig = typeof TIMING_CONFIGS[keyof typeof TIMING_CONFIGS];
