"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ChevronDown } from "lucide-react";
import { FloatingPhone } from "@/components/animations/FloatingPhone";

// Dynamically import StarField to avoid SSR issues with Three.js
const StarField = dynamic(
  () => import("@/components/animations/StarField").then((mod) => mod.StarField),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950" />
    ),
  }
);

const containerVariants = {
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

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-hero-gradient">
      {/* 3D Star Field Background */}
      <StarField className="absolute inset-0 z-0" />

      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy-950/20 to-navy-950 z-[1]" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 pt-24 sm:pt-32">
        <motion.div
          className="flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.p
              className="text-gold-400 text-sm md:text-base uppercase tracking-widest mb-4"
              variants={itemVariants}
            >
              L&apos;chaim to love
            </motion.p>

            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold text-white mb-2 sm:mb-4"
              variants={itemVariants}
            >
              Find Your
            </motion.h1>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-display-2 font-serif font-bold mb-4 sm:mb-6"
              variants={itemVariants}
            >
              <span className="text-shimmer">Bashert</span>
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0"
              variants={itemVariants}
            >
              The dating app built for Jewish singles. Connect with people who
              share your values, traditions, and vision for the future.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              variants={itemVariants}
            >
              <motion.a
                href="#download"
                className="btn-gold inline-flex items-center justify-center gap-2 text-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <AppleIcon />
                App Store
              </motion.a>
              <motion.a
                href="#download"
                className="btn-outline inline-flex items-center justify-center gap-2 text-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <PlayIcon />
                Google Play
              </motion.a>
            </motion.div>
          </div>

          {/* Floating Phone */}
          <motion.div
            className="flex-shrink-0"
            variants={itemVariants}
          >
            <FloatingPhone />
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator - hidden on mobile */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden sm:block"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <motion.div
          className="flex flex-col items-center gap-2 text-white/50"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-sm">Scroll to explore</span>
          <ChevronDown size={24} />
        </motion.div>
      </motion.div>
    </section>
  );
}

// Apple icon
function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

// Google Play icon
function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 20.5v-17c0-.83.67-1.5 1.5-1.5.31 0 .6.1.84.26l14.34 8.5c.5.3.82.84.82 1.49s-.32 1.19-.82 1.49l-14.34 8.5c-.24.16-.53.26-.84.26-.83 0-1.5-.67-1.5-1.5z" />
    </svg>
  );
}
