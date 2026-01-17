# Mazal Website

A stunning, premium landing page for the Mazal Jewish dating app.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **3D Effects:** Three.js / React Three Fiber
- **Icons:** Lucide React
- **Hosting:** Vercel

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
mazal-website/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── globals.css         # Global styles
├── components/
│   ├── animations/         # Animation components
│   │   ├── StarField.tsx   # 3D star background
│   │   └── FloatingPhone.tsx
│   ├── icons/              # Custom icons
│   │   └── StarOfDavid.tsx
│   ├── navigation/         # Nav components
│   │   └── Navbar.tsx
│   └── sections/           # Page sections
│       ├── Hero.tsx
│       ├── ThreeModes.tsx
│       ├── Features.tsx
│       ├── Values.tsx
│       ├── Pricing.tsx
│       ├── DownloadCTA.tsx
│       └── Footer.tsx
├── lib/
│   └── utils.ts            # Utilities & animation helpers
├── public/                 # Static assets
└── tailwind.config.ts      # Design system
```

## Design System

### Colors

- **Navy:** #050A15 → #1A2D5A (dark to light)
- **Gold:** #A88620 → #E8D48A (dark to light)
- **Purple:** #7B68EE (Orthodox mode accent)
- **Coral:** #FF7F50 (Safta mode accent)

### Animations

- 3D Star Field with parallax mouse tracking
- Floating phone mockup with 3D tilt
- Gold shimmer text effect
- Scroll-triggered reveals
- Glass morphism cards with glow effects

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Or connect the GitHub repo to Vercel for automatic deployments.

## License

Private - Mazal Inc.
