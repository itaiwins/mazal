import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Navy Palette
        navy: {
          950: "#050A15",
          900: "#0A1628",
          800: "#0D1B3E",
          700: "#1A2D5A",
          600: "#2A4178",
        },
        // Gold Spectrum
        gold: {
          300: "#F0E2A3",
          400: "#E8D48A",
          500: "#C9A227",
          600: "#A88620",
          700: "#8B6914",
        },
        // Accents
        cream: "#FAF7F2",
        blush: "#F5E1DC",
        sage: "#E8EDE4",
        // Safta Purple
        purple: {
          400: "#9D8FFF",
          500: "#7B68EE",
          600: "#5A4FCF",
        },
        // Coral accent
        coral: {
          400: "#FFA07A",
          500: "#FF7F50",
          600: "#E5673D",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-1": ["80px", { lineHeight: "1.0", letterSpacing: "-0.02em" }],
        "display-2": ["64px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #E8D48A 0%, #C9A227 50%, #A88620 100%)",
        "gold-shimmer": "linear-gradient(120deg, #A88620 0%, #C9A227 20%, #E8D48A 40%, #C9A227 60%, #A88620 80%, #C9A227 100%)",
        "purple-gradient": "linear-gradient(135deg, #7B68EE 0%, #9D8FFF 100%)",
        "coral-gradient": "linear-gradient(135deg, #FF7F50 0%, #FFA07A 100%)",
        "navy-gradient": "linear-gradient(180deg, #0A1628 0%, #050A15 100%)",
        "hero-gradient": "linear-gradient(180deg, #050A15 0%, #0D1B3E 50%, #0A1628 100%)",
      },
      boxShadow: {
        "gold-glow": "0 0 40px rgba(201, 162, 39, 0.3)",
        "gold-glow-lg": "0 0 60px rgba(201, 162, 39, 0.4)",
        "card": "0 4px 20px rgba(0, 0, 0, 0.2)",
        "card-hover": "0 20px 40px rgba(0, 0, 0, 0.3)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.1)",
      },
      animation: {
        "shimmer": "shimmer 3s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "slide-up": "slide-up 0.6s ease-out forwards",
        "bounce-slow": "bounce 2s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-15px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(201, 162, 39, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(201, 162, 39, 0.4)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
