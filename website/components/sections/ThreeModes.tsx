"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Sparkles, Heart, Users } from "lucide-react";
import { StarOfDavid } from "@/components/icons/StarOfDavid";
import { cn } from "@/lib/utils";

const modes = [
  {
    icon: Sparkles,
    title: "Modern Dating",
    description:
      "Swipe-based discovery with Jewish values. Find matches who share your background, beliefs, and vision for the future.",
    accentColor: "gold",
    gradient: "from-gold-500/20 to-gold-600/5",
    borderColor: "group-hover:border-gold-500/50",
    iconBg: "bg-gold-500/10 group-hover:bg-gold-500/20",
    iconColor: "text-gold-500",
    ctaText: "Get Started",
    ctaHref: "#download",
  },
  {
    icon: StarOfDavid,
    title: "Orthodox Shidduch",
    description:
      "Traditional matchmaking digitized. No swiping—only curated suggestions from verified shadchanim who understand your community.",
    accentColor: "purple",
    gradient: "from-purple-500/20 to-purple-600/5",
    borderColor: "group-hover:border-purple-500/50",
    iconBg: "bg-purple-500/10 group-hover:bg-purple-500/20",
    iconColor: "text-purple-500",
    ctaText: "Coming Soon",
    ctaHref: "#",
    comingSoon: true,
  },
  {
    icon: Users,
    title: "Safta Mode",
    description:
      "Family matchmaking made easy. Let your bubbie, parents, or grandparents help find your bashert with personalized recommendations.",
    accentColor: "coral",
    gradient: "from-coral-500/20 to-coral-600/5",
    borderColor: "group-hover:border-coral-500/50",
    iconBg: "bg-coral-500/10 group-hover:bg-coral-500/20",
    iconColor: "text-coral-500",
    ctaText: "Learn More",
    ctaHref: "#features",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export function ThreeModes() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section id="features" className="relative py-24 md:py-32 bg-navy-950">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/50 via-transparent to-navy-900/50" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-4">
            Three Ways to Find{" "}
            <span className="text-shimmer">Love</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Whether you prefer modern dating, traditional shidduch, or family-assisted
            matchmaking—Mazal has a path for you.
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          ref={ref}
          className="grid md:grid-cols-3 gap-6 lg:gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {modes.map((mode, index) => (
            <ModeCard key={mode.title} mode={mode} index={index} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

interface ModeCardProps {
  mode: (typeof modes)[number];
  index: number;
}

function ModeCard({ mode }: ModeCardProps) {
  const Icon = mode.icon;

  return (
    <motion.div
      className="group relative"
      variants={cardVariants}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glow effect on hover */}
      <div
        className={cn(
          "absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl",
          mode.accentColor === "gold" && "bg-gold-500/20",
          mode.accentColor === "purple" && "bg-purple-500/20",
          mode.accentColor === "coral" && "bg-coral-500/20"
        )}
      />

      {/* Card */}
      <div
        className={cn(
          "relative h-full glass-card p-8 transition-all duration-300",
          mode.borderColor
        )}
      >
        {/* Coming Soon Badge */}
        {mode.comingSoon && (
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 text-xs font-semibold bg-purple-500 text-white rounded-full pulse-badge">
              Coming Soon
            </span>
          </div>
        )}

        {/* Icon */}
        <motion.div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300",
            mode.iconBg
          )}
          whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.4 }}
        >
          {mode.title === "Orthodox Shidduch" ? (
            <StarOfDavid size={32} className={mode.iconColor} />
          ) : (
            <Icon size={32} className={mode.iconColor} />
          )}
        </motion.div>

        {/* Content */}
        <h3 className="text-xl md:text-2xl font-serif font-semibold text-white mb-3">
          {mode.title}
        </h3>
        <p className="text-gray-400 mb-6 leading-relaxed">
          {mode.description}
        </p>

        {/* CTA */}
        <motion.a
          href={mode.ctaHref}
          className={cn(
            "inline-flex items-center gap-2 font-medium transition-colors",
            mode.accentColor === "gold" && "text-gold-500 hover:text-gold-400",
            mode.accentColor === "purple" && "text-purple-400 hover:text-purple-300",
            mode.accentColor === "coral" && "text-coral-500 hover:text-coral-400",
            mode.comingSoon && "opacity-60 cursor-not-allowed"
          )}
          whileHover={mode.comingSoon ? {} : { x: 5 }}
        >
          {mode.ctaText}
          {!mode.comingSoon && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform group-hover:translate-x-1"
            >
              <path
                d="M6 12L10 8L6 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </motion.a>
      </div>
    </motion.div>
  );
}
