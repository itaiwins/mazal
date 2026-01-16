# Mazal Website Architecture & Design Spec

> **Goal:** Create an absolutely stunning, one-of-a-kind landing page that makes Mazal stand out as a premium Jewish dating app.

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | **Next.js 14** (App Router) | SEO, React familiarity, Vercel integration |
| Styling | **Tailwind CSS** + CSS Variables | Rapid development, design tokens |
| Animations | **Framer Motion** | Production-ready, declarative animations |
| 3D Effects | **Three.js / React Three Fiber** | Hero 3D star field, depth effects |
| Scroll Magic | **GSAP ScrollTrigger** | Premium scroll-driven animations |
| Icons | **Lucide React** | Clean, consistent iconography |
| Fonts | **Playfair Display** (serif) + **Inter** (sans) | Premium typography pairing |
| Hosting | **Vercel** | Free, automatic deploys, edge network |

---

## Design System

### Color Palette

```css
:root {
  /* Primary */
  --navy-950: #050A15;      /* Deep background */
  --navy-900: #0A1628;      /* Card backgrounds */
  --navy-800: #0D1B3E;      /* Primary navy */
  --navy-700: #1A2D5A;      /* Hover states */

  /* Gold Spectrum */
  --gold-400: #E8D48A;      /* Light gold */
  --gold-500: #C9A227;      /* Primary gold */
  --gold-600: #A88620;      /* Dark gold */
  --gold-gradient: linear-gradient(135deg, #E8D48A 0%, #C9A227 50%, #A88620 100%);

  /* Accents */
  --cream: #FAF7F2;
  --blush: #F5E1DC;
  --white: #FFFFFF;

  /* Glass Effects */
  --glass-white: rgba(255, 255, 255, 0.05);
  --glass-gold: rgba(201, 162, 39, 0.1);
  --glass-border: rgba(255, 255, 255, 0.1);
}
```

### Typography Scale

```css
/* Headlines - Playfair Display */
.display-1 { font-size: 80px; line-height: 1.0; letter-spacing: -0.02em; }
.display-2 { font-size: 64px; line-height: 1.1; letter-spacing: -0.02em; }
.h1 { font-size: 48px; line-height: 1.2; }
.h2 { font-size: 36px; line-height: 1.3; }
.h3 { font-size: 28px; line-height: 1.4; }

/* Body - Inter */
.body-lg { font-size: 20px; line-height: 1.6; }
.body { font-size: 16px; line-height: 1.6; }
.body-sm { font-size: 14px; line-height: 1.5; }
```

### Spacing System

```
4px base unit
xs: 4px | sm: 8px | md: 16px | lg: 24px | xl: 32px | 2xl: 48px | 3xl: 64px | 4xl: 96px | 5xl: 128px
```

---

## Page Sections

### 1. Navigation Bar (Fixed, Glass Effect)

```
┌─────────────────────────────────────────────────────────────────┐
│  ✡ Mazal                    Features  Pricing  FAQ    [Download]│
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Fixed position with backdrop blur (glass morphism)
- Logo: Custom Star of David mark + "Mazal" wordmark
- Nav links fade in on scroll
- CTA button with gold gradient + subtle glow
- Transforms on scroll: transparent → glass background

**Animation:**
- Logo star rotates subtly on hover (0.5s)
- Nav items have underline slide animation
- CTA has magnetic hover effect (follows cursor slightly)

---

### 2. Hero Section (Full Viewport, Immersive)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│            ✡  ✡  ✡  (floating 3D star field)  ✡  ✡            │
│                                                                 │
│                         Find Your                               │
│                        ✨ Bashert ✨                            │
│                                                                 │
│              L'chaim to love. The dating app                    │
│                built for Jewish singles.                        │
│                                                                 │
│              [Download on App Store]  [Google Play]             │
│                                                                 │
│                    ↓ Scroll to explore                          │
│                                                                 │
│        ┌─────────────────────────────────────────┐              │
│        │     (Floating iPhone mockup with        │              │
│        │      app screenshot, 3D tilt on         │              │
│        │      mouse move, golden glow)           │              │
│        └─────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Full viewport height (100vh)
- Deep navy gradient background (#050A15 → #0D1B3E)
- 3D particle star field (Three.js) - stars drift slowly, parallax on mouse
- "Bashert" in gold gradient with animated shimmer
- Phone mockup floating with soft shadow and golden rim light

**Animations:**
1. **Star Field:** 50-100 golden stars at varying depths, subtle drift + parallax
2. **Text Reveal:** Letters animate in with stagger (0.03s per letter)
3. **Phone Mockup:**
   - Floats with gentle Y oscillation (3s loop)
   - 3D tilt following mouse position (max 10deg)
   - Golden glow pulses subtly
4. **Scroll Indicator:** Bouncing chevron with fade
5. **CTA Buttons:** Hover lifts with shadow expansion

**Micro-interactions:**
- Mouse trail leaves subtle golden particles
- Stars near cursor glow brighter (proximity effect)

---

### 3. Social Proof Bar (Trust Strip)

```
┌─────────────────────────────────────────────────────────────────┐
│   ⭐ 4.9 App Store   •   10,000+ Downloads   •   Featured in   │
│                          [logos: TechCrunch, etc.]              │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Subtle glass card with border
- Numbers count up on scroll into view
- Logos in grayscale, colorize on hover

**Animation:**
- Count-up animation for numbers (1.5s, ease-out)
- Infinite horizontal scroll for logos (marquee style)

---

### 4. Three Modes Section (Unique Value Prop)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              Three Ways to Find Love                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   💫        │  │   ✡️        │  │   👵        │             │
│  │  Modern     │  │  Orthodox   │  │   Safta     │             │
│  │  Dating     │  │  Shidduch   │  │   Mode      │             │
│  │             │  │             │  │             │             │
│  │ Swipe-based │  │ Curated     │  │ Family      │             │
│  │ discovery   │  │ matches via │  │ matchmaking │             │
│  │ with Jewish │  │ verified    │  │ - let your  │             │
│  │ values      │  │ shadchanim  │  │ bubbie help │             │
│  │             │  │             │  │             │             │
│  │ [Learn More]│  │ [Coming Soon]  │ [Learn More]│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Three glass cards with gradient borders
- Each card has unique accent color (Gold, Purple, Rose)
- Icons are animated Lottie or custom SVG
- Cards have depth with layered shadows

**Animations:**
1. **Scroll Reveal:** Cards stagger in from bottom (0.15s delay each)
2. **Hover Effect:** Card lifts, border glows, icon animates
3. **3D Tilt:** Subtle perspective shift on hover
4. **Orthodox Card:** "Coming Soon" badge pulses

---

### 5. App Showcase (Feature Carousel)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                  Designed for Connection                         │
│                                                                 │
│    [Swipe Cards]  [Rich Profiles]  [Real-time Chat]  [Map]     │
│         ●              ○               ○              ○         │
│                                                                 │
│              ┌─────────────────────────────┐                    │
│              │                             │                    │
│              │    (iPhone showing          │                    │
│              │     current feature)        │                    │
│              │                             │                    │
│              │    3D card stack            │                    │
│              │    swipe animation          │                    │
│              │                             │                    │
│              └─────────────────────────────┘                    │
│                                                                 │
│    ← Swipe left to pass        Swipe right to like →           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Tab-based feature selector with animated underline
- Large phone mockup (centered) with screen that changes
- Feature description text below phone
- Gesture hints with animated arrows

**Animations:**
1. **Tab Switch:** Content crossfades, phone screen slides
2. **Phone Animation:** Actual swipe gesture plays in mockup (video/Lottie)
3. **Auto-advance:** Tabs cycle every 5s if no interaction
4. **Parallax Layers:** Phone, text, and tabs at different scroll speeds

---

### 6. Jewish Values Section (Emotional Connection)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│         Built with Jewish Values at Heart                       │
│                                                                 │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│    │ 🕯️      │  │ 👨‍👩‍👧‍👦      │  │ 🔒       │  │ ✡️       │     │
│    │ Shabbat  │  │ Family   │  │ Privacy  │  │ Community│     │
│    │ Aware    │  │ Focused  │  │ First    │  │ Driven   │     │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                 │
│         "The app respects our traditions while                  │
│          helping us find meaningful connections"                │
│                        - Sarah, 28, NYC                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Warm cream/gold gradient background
- Icon cards with hover flip to reveal detail
- Testimonial with photo, animated quote marks
- Subtle pattern overlay (Star of David tessellation at 3% opacity)

**Animations:**
1. **Icon Cards:** Flip on hover to show expanded text
2. **Quote:** Typewriter effect on scroll into view
3. **Background:** Subtle gradient shift (warm → cool)

---

### 7. Pricing Section (Clean, Premium)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    Choose Your Journey                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐        │
│  │   FREE      │  │ ★ GOLD ★       │  │  PLATINUM   │        │
│  │             │  │  Most Popular   │  │             │        │
│  │   $0        │  │   $14.99/mo     │  │  $29.99/mo  │        │
│  │             │  │                 │  │             │        │
│  │ • 25 swipes │  │ • Unlimited     │  │ • Everything│        │
│  │ • 1 super/wk│  │ • See likes     │  │ • Boosts    │        │
│  │ • Basic     │  │ • Rewind        │  │ • Priority  │        │
│  │             │  │ • Filters       │  │ • Incognito │        │
│  │             │  │                 │  │             │        │
│  │ [Get Free]  │  │ [Get Gold]      │  │ [Go Platinum│        │
│  └─────────────┘  └─────────────────┘  └─────────────┘        │
│                                                                 │
│         + Orthodox Mode: $49.99/mo  |  Safta Pro: $14.99/mo    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Three-tier card layout, middle card elevated
- "Most Popular" badge with animated shimmer
- Checkmarks animate in on scroll
- Gold gradient on featured tier

**Animations:**
1. **Cards Rise:** Staggered entrance from bottom
2. **Popular Badge:** Shimmer effect (continuous)
3. **Hover:** Card scale + shadow expansion
4. **CTA Buttons:** Ripple effect on click

---

### 8. Download CTA (Final Push)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    ┌──────────────────────────────────────────────────────┐    │
│    │                                                      │    │
│    │              Ready to Find Your Bashert?             │    │
│    │                                                      │    │
│    │       [⬇️ Download on App Store]  [▶️ Google Play]   │    │
│    │                                                      │    │
│    │              ✡ Join 10,000+ Jewish singles ✡         │    │
│    │                                                      │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Full-width glass card with gold gradient border
- Large buttons with store icons
- Floating stars animation (reprise from hero)
- Background: Animated gradient mesh

**Animations:**
1. **Card:** Entrance with scale + fade
2. **Buttons:** Magnetic hover, pulse glow
3. **Stars:** Drift upward continuously
4. **Background:** Slow-moving gradient blobs

---

### 9. Footer (Minimal, Elegant)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ✡ Mazal                                                        │
│  L'chaim to love                                                │
│                                                                 │
│  Product        Company        Legal          Social            │
│  Features       About          Privacy        Instagram         │
│  Pricing        Careers        Terms          Twitter           │
│  FAQ            Press          Cookies        TikTok            │
│                 Contact                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  © 2024 Mazal Inc. Made with 💛 for the Jewish community       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Dark background matching nav
- Grid layout for links
- Social icons with hover color
- Subtle top border with gradient

---

## Animation Philosophy

### Guiding Principles

1. **Purposeful Motion:** Every animation serves UX, not decoration
2. **Jewish Elegance:** Gold shimmer, stars, warm celebration energy
3. **Performance First:** 60fps, GPU-accelerated, lazy-loaded
4. **Subtle > Flashy:** Refined micro-interactions over big effects
5. **Responsive:** Reduced motion for accessibility, simpler on mobile

### Animation Timing

```javascript
const easings = {
  smooth: [0.4, 0, 0.2, 1],      // Material Design standard
  bounce: [0.68, -0.55, 0.265, 1.55], // Playful overshoot
  snap: [0.5, 0, 0.1, 1],        // Quick, decisive
  drift: [0.25, 0.1, 0.25, 1],   // Slow, dreamy (for stars)
};

const durations = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  dramatic: 0.8,
};
```

### Scroll-Driven Animations

| Element | Trigger | Animation |
|---------|---------|-----------|
| Section headers | 20% viewport | Fade up + slide |
| Cards | 30% viewport | Stagger rise |
| Phone mockups | 40% viewport | Scale up + float |
| Stats | 50% viewport | Count up |
| Background elements | Continuous | Parallax at 0.5x |

### Hover States

| Element | Effect | Duration |
|---------|--------|----------|
| Buttons | Lift + glow + cursor follow | 0.2s |
| Cards | 3D tilt + border glow | 0.3s |
| Links | Underline slide | 0.2s |
| Icons | Scale + color shift | 0.15s |
| Logo star | Rotate 360° | 0.8s |

---

## Technical Implementation

### Project Structure

```
mazal-website/
├── app/
│   ├── layout.tsx          # Root layout with fonts, metadata
│   ├── page.tsx            # Landing page (all sections)
│   ├── globals.css         # Global styles + CSS variables
│   └── favicon.ico
├── components/
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── SocialProof.tsx
│   │   ├── ThreeModes.tsx
│   │   ├── AppShowcase.tsx
│   │   ├── JewishValues.tsx
│   │   ├── Pricing.tsx
│   │   ├── DownloadCTA.tsx
│   │   └── Footer.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── PhoneMockup.tsx
│   │   └── GlassCard.tsx
│   ├── animations/
│   │   ├── StarField.tsx       # Three.js star background
│   │   ├── FloatingPhone.tsx   # 3D tilt phone
│   │   ├── TextReveal.tsx      # Letter-by-letter reveal
│   │   ├── CountUp.tsx         # Number animation
│   │   └── ScrollReveal.tsx    # Scroll-triggered wrapper
│   └── navigation/
│       ├── Navbar.tsx
│       └── MobileMenu.tsx
├── lib/
│   ├── animations.ts       # Framer Motion variants
│   ├── constants.ts        # Colors, timing, content
│   └── utils.ts            # Helper functions
├── public/
│   ├── images/
│   │   ├── app-screenshots/
│   │   ├── phone-mockup.png
│   │   └── star-of-david.svg
│   ├── videos/
│   │   └── swipe-demo.mp4
│   └── fonts/
├── styles/
│   └── animations.css      # Keyframe animations
├── tailwind.config.ts
├── next.config.js
└── package.json
```

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^10.16.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "three": "^0.158.0",
    "gsap": "^3.12.0",
    "tailwindcss": "^3.4.0",
    "lucide-react": "^0.294.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

### Performance Optimizations

1. **Code Splitting:** Dynamic imports for Three.js (heavy)
2. **Image Optimization:** Next.js Image component, WebP format
3. **Font Loading:** `next/font` with display swap
4. **Animation:** `will-change`, `transform` only, no layout thrashing
5. **Lazy Loading:** Intersection Observer for below-fold sections
6. **Reduced Motion:** `prefers-reduced-motion` media query support

---

## Responsive Breakpoints

```css
/* Mobile First */
sm: 640px   /* Large phones */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */
```

### Mobile Adaptations

- Hero: Single column, smaller phone mockup, simplified star field
- Three Modes: Vertical stack with swipe carousel
- App Showcase: Swipeable tabs, no 3D effects
- Pricing: Horizontal scroll cards
- Animations: Reduced complexity, fewer particles

---

## SEO & Meta

```tsx
export const metadata: Metadata = {
  title: 'Mazal - Jewish Dating App | Find Your Bashert',
  description: 'The modern dating app built for Jewish singles. Find meaningful connections with Mazal - featuring modern dating, Orthodox shidduch mode, and family matchmaking.',
  keywords: ['Jewish dating', 'Jewish singles', 'Shidduch', 'Bashert', 'Jewish matchmaking'],
  openGraph: {
    title: 'Mazal - Find Your Bashert',
    description: 'L\'chaim to love. The dating app built for Jewish singles.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mazal - Jewish Dating App',
    description: 'Find your bashert with Mazal',
  },
};
```

---

## Content Needed

### Copy
- [ ] Hero headline variations (A/B testing)
- [ ] Feature descriptions (50 words each)
- [ ] Testimonials (3-5 real quotes)
- [ ] FAQ content (8-10 questions)

### Assets
- [ ] App screenshots (6-8 high quality)
- [ ] Phone mockup template
- [ ] Logo files (SVG, PNG)
- [ ] App Store badges
- [ ] Social proof logos (if any press coverage)
- [ ] Team/founder photos (optional)

### Video (Optional but Recommended)
- [ ] 15-second app demo loop
- [ ] Swipe gesture animation
- [ ] Match celebration clip

---

## Launch Checklist

- [ ] Domain configured
- [ ] SSL certificate
- [ ] Analytics (Vercel Analytics or GA4)
- [ ] Error tracking (Sentry)
- [ ] Performance audit (Lighthouse 90+)
- [ ] Mobile testing (iOS Safari, Chrome)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Social meta tags verified
- [ ] App Store links working
- [ ] Contact form functional
- [ ] Legal pages linked

---

## Timeline Estimate

This document provides the complete specification. Development phases:

1. **Setup & Design System** - Project scaffold, Tailwind config, components
2. **Hero Section** - Three.js stars, animations, phone mockup
3. **Content Sections** - Three modes, features, values, pricing
4. **Polish** - Micro-interactions, responsive, performance
5. **Launch Prep** - SEO, analytics, testing

---

*This spec captures the vision for a premium, memorable landing page that reflects Mazal's unique position in the Jewish dating market.*
