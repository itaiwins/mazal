# Mazal Website - Visual Design & Animation Spec

> **Design Philosophy:** Elegant Jewish heritage meets modern premium tech. Every pixel should feel intentional, every animation purposeful.

---

## Hero Section - The First Impression

The hero is where we make or break the user's perception. It must feel **magical**, **premium**, and **uniquely Jewish**.

### Visual Concept

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║    ═══════════════════════════════════════════════════════════════════   ║
║    ✡ Mazal                              Features  Pricing   [Download]    ║
║    ═══════════════════════════════════════════════════════════════════   ║
║                                                                           ║
║                    ✦        ✧                    ✦                       ║
║              ✧           ✦        ✧         ✦         ✧                  ║
║                    ✦                  ✧                                   ║
║         ✧                  ✦                    ✧                ✦       ║
║                                                                           ║
║                          Find Your                                        ║
║                                                                           ║
║              ░▒▓█  B A S H E R T  █▓▒░                                   ║
║               ~~~~ gold shimmer ~~~~                                      ║
║                                                                           ║
║              L'chaim to love. The dating app                              ║
║                 built for Jewish singles.                                 ║
║                                                                           ║
║                                                                           ║
║         ┌────────────────┐    ┌────────────────┐                         ║
║         │  App Store    │    │  Google Play   │                         ║
║         └────────────────┘    └────────────────┘                         ║
║                                                                           ║
║                        ╭─────────────────╮                                ║
║                        │ ╭─────────────╮ │                                ║
║                        │ │             │ │                                ║
║                ┌───────│ │   iPhone    │ │───────┐                       ║
║              glow      │ │   Mockup    │ │      glow                     ║
║                └───────│ │   with      │ │───────┘                       ║
║                        │ │   App UI    │ │                                ║
║                        │ │             │ │                                ║
║                        │ ╰─────────────╯ │                                ║
║                        ╰─────────────────╯                                ║
║                         ↕ floating motion                                 ║
║                                                                           ║
║                             ↓                                             ║
║                        Scroll down                                        ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Background: 3D Star Field

```typescript
// Three.js star field configuration
const starFieldConfig = {
  count: 80,                    // Number of stars
  depth: 50,                    // Z-depth range
  colors: ['#C9A227', '#E8D48A', '#FFFFFF'],  // Gold gradient + white
  sizes: [0.5, 1, 1.5, 2],     // Random sizes

  movement: {
    drift: {
      x: 0.001,               // Very slow horizontal drift
      y: 0.002,               // Slightly faster vertical (upward)
    },
    parallax: {
      strength: 0.05,         // Mouse movement multiplier
      smoothing: 0.1,         // Lerp factor for smooth follow
    },
    twinkle: {
      frequency: 2,           // Seconds per twinkle cycle
      minOpacity: 0.3,
      maxOpacity: 1.0,
    },
  },

  // Stars near cursor glow brighter
  cursorProximity: {
    radius: 150,              // Pixels
    glowIntensity: 2.0,       // Brightness multiplier
    glowColor: '#FFD700',     // Bright gold
  },
};
```

### "Bashert" Text Animation

```css
/* Gold gradient shimmer effect */
.bashert-text {
  background: linear-gradient(
    120deg,
    #A88620 0%,
    #C9A227 20%,
    #E8D48A 40%,    /* Bright highlight */
    #C9A227 60%,
    #A88620 80%,
    #C9A227 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
```

### Phone Mockup - 3D Floating Effect

```typescript
// Framer Motion + 3D transform
const phoneAnimation = {
  // Continuous floating
  y: {
    values: [0, -15, 0],
    duration: 4,
    ease: "easeInOut",
    repeat: Infinity,
  },

  // Mouse-following tilt
  onMouseMove: (e) => {
    const rect = phoneRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rotateY = ((e.clientX - centerX) / rect.width) * 15;  // Max 15deg
    const rotateX = ((e.clientY - centerY) / rect.height) * -10; // Max 10deg

    return { rotateX, rotateY };
  },

  // Golden glow effect
  boxShadow: [
    '0 20px 60px rgba(201, 162, 39, 0.2)',   // Base shadow
    '0 20px 80px rgba(201, 162, 39, 0.3)',   // Pulse up
    '0 20px 60px rgba(201, 162, 39, 0.2)',   // Back
  ],
};
```

### Hero Entry Animation Sequence

```typescript
// Staggered entrance (Framer Motion)
const heroSequence = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// Sequence:
// 0.0s - Star field fades in
// 0.3s - "Find Your" text
// 0.45s - "Bashert" with shimmer
// 0.6s - Tagline
// 0.75s - CTA buttons
// 0.9s - Phone mockup rises + begins floating
// 1.2s - Scroll indicator bounces in
```

---

## Three Modes Section - Unique Value Prop

### Card Design

```
╭─────────────────────────────────────────╮
│                                         │
│            ╭───────────────╮            │
│            │      ✨       │            │
│            │   (icon)      │            │
│            ╰───────────────╯            │
│                                         │
│           Modern Dating                 │
│                                         │
│    Swipe-based discovery with           │
│    Jewish values. Find matches          │
│    who share your background            │
│    and beliefs.                         │
│                                         │
│         ┌─────────────────┐             │
│         │   Learn More →  │             │
│         └─────────────────┘             │
│                                         │
╰─────────────────────────────────────────╯
```

### Card Interaction States

```typescript
const cardVariants = {
  // Default state
  initial: {
    y: 0,
    rotateX: 0,
    rotateY: 0,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Hover state - 3D tilt follows cursor
  hover: {
    y: -8,
    scale: 1.02,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(201, 162, 39, 0.5)',  // Gold border glow
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Icon animation on hover
  iconHover: {
    scale: 1.1,
    rotate: [0, -10, 10, 0],  // Wiggle
    transition: { duration: 0.4 },
  },
};

// Different accent colors per card
const cardAccents = {
  modern: {
    gradient: 'linear-gradient(135deg, #C9A227, #E8D48A)',
    glow: 'rgba(201, 162, 39, 0.3)',
  },
  orthodox: {
    gradient: 'linear-gradient(135deg, #7B68EE, #9D8FFF)',
    glow: 'rgba(123, 104, 238, 0.3)',
  },
  safta: {
    gradient: 'linear-gradient(135deg, #FF7F50, #FFA07A)',
    glow: 'rgba(255, 127, 80, 0.3)',
  },
};
```

### "Coming Soon" Badge Animation

```css
.coming-soon-badge {
  background: linear-gradient(135deg, #7B68EE, #9D8FFF);
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(123, 104, 238, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(123, 104, 238, 0);
  }
}
```

---

## App Showcase - Feature Carousel

### Interactive Phone Display

```
         ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
         │Swipe│  │Prof.│  │ Chat│  │ Map │
         └──┬──┘  └─────┘  └─────┘  └─────┘
            │
            ▼ (animated underline slides)
    ════════════════════════════════════════

              ╭─────────────────────╮
              │  ┌───────────────┐  │
              │  │               │  │
              │  │   ╭───────╮   │  │
              │  │   │ Sarah │   │  │
              │  │   │  28   │   │  │
              │  │   │  NYC  │   │  │
              │  │   ╰───────╯   │  │
              │  │               │  │
              │  │  ← PASS  LIKE →  │
              │  │               │  │
              │  └───────────────┘  │
              ╰─────────────────────╯
                   ↕ gentle float

    "Swipe through profiles with intention.
     See Jewish background, values, and more."

         ←  Swipe left to pass
               Swipe right to connect  →
```

### Tab Switching Animation

```typescript
const tabContentVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0,
    transition: { duration: 0.3 },
  }),
};

// Phone screen content crossfades
const screenVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: 0.1 },
  },
};
```

### Auto-Advance Logic

```typescript
// Auto-cycle through features every 5 seconds
useEffect(() => {
  const interval = setInterval(() => {
    if (!isHovering && !hasInteracted) {
      setActiveTab((prev) => (prev + 1) % tabs.length);
    }
  }, 5000);

  return () => clearInterval(interval);
}, [isHovering, hasInteracted]);
```

---

## Scroll Animations - GSAP ScrollTrigger

### Section Reveal Pattern

```typescript
// Generic scroll reveal for all sections
const useScrollReveal = (ref: RefObject<HTMLElement>) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    gsap.fromTo(
      element,
      {
        y: 60,
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 80%',      // Trigger when 80% from top
          toggleActions: 'play none none reverse',
        },
      }
    );
  }, []);
};
```

### Parallax Layers

```typescript
// Different scroll speeds for depth
const parallaxConfig = {
  background: 0.3,    // Moves slowest (30% of scroll)
  midground: 0.6,     // Medium speed
  foreground: 1.0,    // Normal scroll speed
  floating: 1.2,      // Slightly faster (appears to float up)
};

// Applied to phone mockups, decorative elements
gsap.to('.parallax-float', {
  y: -100,
  ease: 'none',
  scrollTrigger: {
    trigger: '.parallax-container',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,  // Smooth scroll-linked animation
  },
});
```

---

## Micro-Interactions Library

### Button Interactions

```typescript
// Primary CTA Button
const ButtonPrimary = () => {
  return (
    <motion.button
      className="btn-primary"
      whileHover={{
        scale: 1.05,
        boxShadow: '0 10px 40px rgba(201, 162, 39, 0.4)',
      }}
      whileTap={{ scale: 0.98 }}
      // Magnetic effect - button follows cursor slightly
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        e.currentTarget.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translate(0, 0)';
      }}
    >
      Download Now
    </motion.button>
  );
};
```

### Link Hover Animation

```css
.nav-link {
  position: relative;
  color: rgba(255, 255, 255, 0.8);
  transition: color 0.2s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #C9A227, #E8D48A);
  transition: width 0.3s ease;
}

.nav-link:hover {
  color: #FFFFFF;
}

.nav-link:hover::after {
  width: 100%;
}
```

### Card Glow Effect

```css
.glass-card {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  overflow: hidden;
}

/* Animated border glow on hover */
.glass-card::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(
    45deg,
    transparent,
    rgba(201, 162, 39, 0.5),
    transparent
  );
  border-radius: 26px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.glass-card:hover::before {
  opacity: 1;
  animation: borderRotate 3s linear infinite;
}

@keyframes borderRotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

---

## Pricing Section Design

### Card Elevation System

```
       ┌─────────┐
       │  FREE   │  ← Standard elevation
       └─────────┘

    ╔═══════════════╗
    ║               ║
    ║   ★ GOLD ★    ║  ← Elevated + glow + badge
    ║               ║
    ╚═══════════════╝

       ┌─────────┐
       │PLATINUM │  ← Standard elevation
       └─────────┘
```

### Popular Badge Shimmer

```css
.popular-badge {
  background: linear-gradient(
    90deg,
    #C9A227 0%,
    #E8D48A 25%,
    #C9A227 50%,
    #E8D48A 75%,
    #C9A227 100%
  );
  background-size: 400% 100%;
  animation: badgeShimmer 2s linear infinite;
  color: #0D1B3E;
  font-weight: 700;
  padding: 6px 16px;
  border-radius: 999px;
}

@keyframes badgeShimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: -100% 50%; }
}
```

### Price Counter Animation

```typescript
// Animated price display
const PriceDisplay = ({ price }: { price: number }) => {
  const [displayPrice, setDisplayPrice] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (inView) {
      const duration = 1000;
      const steps = 30;
      const increment = price / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= price) {
          setDisplayPrice(price);
          clearInterval(timer);
        } else {
          setDisplayPrice(Math.floor(current * 100) / 100);
        }
      }, duration / steps);
    }
  }, [inView, price]);

  return (
    <span ref={ref} className="price">
      ${displayPrice.toFixed(2)}
    </span>
  );
};
```

---

## Download CTA Section

### Floating Stars Reprise

```typescript
// Reuse hero star field but with upward drift
const ctaStarConfig = {
  ...heroStarConfig,
  count: 30,  // Fewer stars
  movement: {
    drift: {
      x: 0.001,
      y: -0.003,  // Drift upward (negative Y)
    },
  },
  // Stars fade out at top, regenerate at bottom
  recycleAtTop: true,
};
```

### Gradient Mesh Background

```css
.cta-section {
  position: relative;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(201, 162, 39, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 50%, rgba(123, 104, 238, 0.1) 0%, transparent 50%),
    linear-gradient(180deg, #0A1628 0%, #050A15 100%);
  overflow: hidden;
}

/* Animated gradient blobs */
.gradient-blob {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.3;
  animation: blobMove 20s ease-in-out infinite;
}

.gradient-blob-1 {
  background: #C9A227;
  top: -200px;
  left: -200px;
  animation-delay: 0s;
}

.gradient-blob-2 {
  background: #7B68EE;
  bottom: -200px;
  right: -200px;
  animation-delay: -10s;
}

@keyframes blobMove {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(50px, 50px) scale(1.1); }
  50% { transform: translate(0, 100px) scale(0.9); }
  75% { transform: translate(-50px, 50px) scale(1.05); }
}
```

---

## Performance Guidelines

### Animation Performance

```typescript
// GOOD - GPU accelerated
transform: translateY(10px);
opacity: 0.5;

// BAD - causes layout/paint
margin-top: 10px;
width: 100px;
box-shadow: complex;  // Animate opacity of shadow layer instead

// Use will-change sparingly
.animated-element {
  will-change: transform, opacity;
}

// Remove will-change after animation
element.addEventListener('transitionend', () => {
  element.style.willChange = 'auto';
});
```

### Reduced Motion Support

```typescript
// Respect user preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const animationConfig = prefersReducedMotion
  ? { duration: 0, delay: 0 }
  : { duration: 0.5, delay: 0.1 };

// CSS fallback
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Lazy Loading Strategy

```typescript
// Dynamic import for heavy Three.js component
const StarField = dynamic(() => import('@/components/StarField'), {
  ssr: false,
  loading: () => <div className="star-field-placeholder" />,
});

// Intersection Observer for below-fold sections
const useLazySection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }  // Load 100px before entering viewport
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
};
```

---

## Mobile Adaptations

### Simplified Hero (Mobile)

```
╔═══════════════════════════════╗
║  ✡ Mazal              [Menu]  ║
╠═══════════════════════════════╣
║                               ║
║       ✦    ✧    ✦            ║
║                               ║
║        Find Your              ║
║        Bashert                ║
║                               ║
║    L'chaim to love.          ║
║                               ║
║   ┌─────────────────────┐    ║
║   │   Download Now     │    ║
║   └─────────────────────┘    ║
║                               ║
║      ┌─────────────┐         ║
║      │   iPhone    │         ║
║      │   (smaller) │         ║
║      └─────────────┘         ║
║                               ║
╚═══════════════════════════════╝
```

### Mobile-Specific Changes

1. **Star field:** Reduced to 20 stars, no mouse parallax
2. **Phone mockup:** Smaller, no 3D tilt, simpler float
3. **Three modes:** Horizontal swipe carousel
4. **Pricing:** Horizontal scroll with snap
5. **Animations:** Shorter durations, simpler transforms
6. **Scroll reveals:** Reduced movement distance

```css
@media (max-width: 768px) {
  .star-field { --star-count: 20; }
  .phone-mockup { transform: none; }
  .section-reveal { --reveal-distance: 30px; }  /* vs 60px desktop */
}
```

---

## Summary

This visual design spec ensures:

1. **✨ Premium feel** - 3D effects, smooth animations, glass morphism
2. **✡️ Jewish identity** - Star motifs, gold accents, cultural elements
3. **🚀 Performance** - GPU-accelerated, lazy-loaded, reduced motion support
4. **📱 Responsive** - Mobile-optimized with simplified animations
5. **♿ Accessible** - Respects motion preferences, clear contrast

The landing page will be memorable, professional, and uniquely Mazal.
