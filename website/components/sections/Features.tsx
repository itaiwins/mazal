"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Heart, MessageCircle, Map, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    id: "swipe",
    icon: Heart,
    title: "Smart Matching",
    description:
      "Swipe through profiles tailored to your preferences. See Jewish background, observance level, and shared values at a glance.",
    highlight: "25+ swipes daily free",
  },
  {
    id: "profiles",
    icon: Shield,
    title: "Rich Profiles",
    description:
      "Beyond photos—discover icebreaker prompts, Jewish identity details, and Safta endorsements from family members.",
    highlight: "Verified profiles",
  },
  {
    id: "chat",
    icon: MessageCircle,
    title: "Real-time Chat",
    description:
      "Connect instantly with your matches. Send messages, share photos, and build meaningful conversations.",
    highlight: "Read receipts included",
  },
  {
    id: "map",
    icon: Map,
    title: "Mazal Map",
    description:
      "Discover Jewish singles near you with our interactive map. Perfect for finding matches in your community.",
    highlight: "Location-based discovery",
  },
];

export function Features() {
  const [activeFeature, setActiveFeature] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section className="relative py-16 sm:py-24 md:py-32 bg-navy-900 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[600px] sm:h-[800px] bg-gold-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-3 sm:mb-4">
            Designed for{" "}
            <span className="text-shimmer">Connection</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
            Every feature is crafted to help you find meaningful relationships
            within the Jewish community.
          </p>
        </motion.div>

        <div ref={ref} className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center">
          {/* Feature Display - shows first on mobile */}
          <motion.div
            className="relative order-1 lg:order-2"
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              <FeatureDisplay
                key={activeFeature}
                feature={features[activeFeature]}
              />
            </AnimatePresence>
          </motion.div>

          {/* Feature Tabs */}
          <motion.div
            className="space-y-3 sm:space-y-4 order-2 lg:order-1"
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {features.map((feature, index) => (
              <FeatureTab
                key={feature.id}
                feature={feature}
                isActive={activeFeature === index}
                onClick={() => setActiveFeature(index)}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

interface FeatureTabProps {
  feature: (typeof features)[number];
  isActive: boolean;
  onClick: () => void;
}

function FeatureTab({ feature, isActive, onClick }: FeatureTabProps) {
  const Icon = feature.icon;

  return (
    <motion.button
      className={cn(
        "w-full text-left p-4 sm:p-6 rounded-xl sm:rounded-2xl transition-all duration-300",
        isActive
          ? "glass-card-strong border-gold-500/30"
          : "hover:bg-white/5"
      )}
      onClick={onClick}
      whileHover={{ x: isActive ? 0 : 5 }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className={cn(
            "w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
            isActive ? "bg-gold-500/20 text-gold-500" : "bg-white/5 text-gray-400"
          )}
        >
          <Icon size={20} className="sm:hidden" />
          <Icon size={24} className="hidden sm:block" />
        </div>
        <div className="flex-1">
          <h3
            className={cn(
              "text-lg font-semibold mb-1 transition-colors",
              isActive ? "text-white" : "text-gray-300"
            )}
          >
            {feature.title}
          </h3>
          <p
            className={cn(
              "text-sm transition-colors",
              isActive ? "text-gray-300" : "text-gray-500"
            )}
          >
            {feature.description}
          </p>
          {isActive && (
            <motion.span
              className="inline-block mt-2 text-xs font-medium text-gold-500 bg-gold-500/10 px-3 py-1 rounded-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {feature.highlight}
            </motion.span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

interface FeatureDisplayProps {
  feature: (typeof features)[number];
}

function FeatureDisplay({ feature }: FeatureDisplayProps) {
  return (
    <motion.div
      className="relative aspect-[3/4] sm:aspect-square max-w-[280px] sm:max-w-md mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
    >
      {/* Glow */}
      <div className="absolute inset-0 bg-gold-500/10 rounded-3xl blur-3xl" />

      {/* Phone mockup */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-48 h-[380px] sm:w-64 sm:h-[500px] rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-b from-gray-800 to-gray-900 p-1.5 sm:p-2 shadow-2xl">
          <div className="w-full h-full rounded-[1.75rem] sm:rounded-[2rem] bg-navy-950 overflow-hidden relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 sm:w-24 h-4 sm:h-6 bg-black rounded-b-lg sm:rounded-b-xl z-10" />

            {/* Content based on feature */}
            <FeatureScreenContent feature={feature} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureScreenContent({ feature }: { feature: (typeof features)[number] }) {
  const Icon = feature.icon;

  return (
    <div className="w-full h-full bg-navy-900 p-3 sm:p-4 pt-7 sm:pt-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <span className="text-gold-500 font-serif font-semibold text-sm sm:text-base">Mazal</span>
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-navy-700" />
      </div>

      {/* Feature-specific content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gold-500/10 flex items-center justify-center mb-3 sm:mb-4"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon size={28} className="text-gold-500 sm:hidden" />
          <Icon size={40} className="text-gold-500 hidden sm:block" />
        </motion.div>
        <h4 className="text-white font-semibold text-center mb-1 sm:mb-2 text-sm sm:text-base">
          {feature.title}
        </h4>
        <p className="text-gray-400 text-xs sm:text-sm text-center px-2 sm:px-4">
          {feature.highlight}
        </p>
      </div>

      {/* Bottom indicator */}
      <div className="flex justify-center gap-1.5 sm:gap-2 pb-2 sm:pb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i === features.findIndex((f) => f.id === feature.id)
                ? "bg-gold-500"
                : "bg-navy-700"
            )}
          />
        ))}
      </div>
    </div>
  );
}
