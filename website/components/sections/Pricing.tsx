"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Free",
    price: "0",
    period: "forever",
    description: "Get started with the basics",
    features: [
      "25 swipes per day",
      "1 Super Like per week",
      "Basic filters",
      "See mutual matches",
      "Real-time messaging",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Gold",
    price: "14.99",
    period: "per month",
    description: "For serious daters",
    features: [
      "Unlimited swipes",
      "5 Super Likes per week",
      "See who liked you",
      "Rewind last swipe",
      "Advanced filters",
      "Read receipts",
      "Ad-free experience",
    ],
    cta: "Get Gold",
    popular: true,
  },
  {
    name: "Platinum",
    price: "29.99",
    period: "per month",
    description: "Premium experience",
    features: [
      "Everything in Gold",
      "Unlimited Super Likes",
      "Weekly profile boost",
      "Priority in discovery",
      "Incognito mode",
      "Message before matching",
      "VIP support",
    ],
    cta: "Go Platinum",
    popular: false,
  },
];

const additionalTiers = [
  {
    name: "Orthodox Mode",
    price: "49.99",
    description: "Traditional shidduch experience with verified shadchanim",
  },
  {
    name: "Safta Pro",
    price: "14.99",
    description: "Unlimited recommendations and family connections",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
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

export function Pricing() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section id="pricing" className="relative py-24 md:py-32 bg-navy-950">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-4">
            Choose Your{" "}
            <span className="text-shimmer">Journey</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Start free and upgrade when you&apos;re ready for more.
          </p>
        </motion.div>

        {/* Main Pricing Cards */}
        <motion.div
          ref={ref}
          className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {tiers.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </motion.div>

        {/* Additional Tiers */}
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {additionalTiers.map((tier) => (
            <div
              key={tier.name}
              className="glass-card px-6 py-4 flex items-center gap-4"
            >
              <div>
                <span className="text-white font-medium">{tier.name}</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gold-500 font-semibold">${tier.price}/mo</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

interface PricingCardProps {
  tier: (typeof tiers)[number];
}

function PricingCard({ tier }: PricingCardProps) {
  return (
    <motion.div
      className={cn(
        "relative group",
        tier.popular && "md:-mt-4 md:mb-4"
      )}
      variants={cardVariants}
      whileHover={{ y: -5 }}
    >
      {/* Popular badge */}
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <span className="badge-shimmer text-navy-900 text-sm font-bold px-4 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Glow effect for popular tier */}
      {tier.popular && (
        <div className="absolute inset-0 bg-gold-500/20 rounded-3xl blur-xl" />
      )}

      <div
        className={cn(
          "relative h-full flex flex-col p-8 rounded-3xl transition-all duration-300",
          tier.popular
            ? "bg-gradient-to-b from-navy-800 to-navy-900 border-2 border-gold-500/30"
            : "glass-card hover:border-white/20"
        )}
      >
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-2">{tier.name}</h3>
          <p className="text-gray-400 text-sm">{tier.description}</p>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl md:text-5xl font-bold text-white">
              ${tier.price}
            </span>
            <span className="text-gray-400">/{tier.period}</span>
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-8 flex-1">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  tier.popular ? "bg-gold-500/20" : "bg-white/10"
                )}
              >
                <Check
                  size={12}
                  className={tier.popular ? "text-gold-500" : "text-gray-400"}
                />
              </div>
              <span className="text-gray-300 text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <motion.a
          href="#download"
          className={cn(
            "w-full py-3 px-6 rounded-xl font-semibold text-center transition-all",
            tier.popular
              ? "btn-gold"
              : "bg-white/10 text-white hover:bg-white/20"
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {tier.cta}
        </motion.a>
      </div>
    </motion.div>
  );
}
