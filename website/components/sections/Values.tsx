"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Calendar, Users, Lock, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const values = [
  {
    icon: Calendar,
    title: "Shabbat Aware",
    description: "Auto-pauses during Shabbat with location-based zmanim. We respect your observance.",
    color: "gold",
  },
  {
    icon: Users,
    title: "Family Focused",
    description: "Unique Safta mode lets family help with matchmaking—because they know you best.",
    color: "purple",
  },
  {
    icon: Lock,
    title: "Privacy First",
    description: "Control who sees your photos. Your privacy is sacred, and we protect it.",
    color: "coral",
  },
  {
    icon: Heart,
    title: "Community Driven",
    description: "Built by and for the Jewish community. Real understanding of your values.",
    color: "gold",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, rotateY: -15 },
  visible: {
    opacity: 1,
    y: 0,
    rotateY: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export function Values() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Background with warm gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950" />

      {/* Decorative pattern - subtle Star of David tessellation */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon fill='%23C9A227' points='30,5 55,45 5,45'/%3E%3Cpolygon fill='%23C9A227' points='30,55 5,15 55,15'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-4">
            Built with{" "}
            <span className="text-shimmer">Jewish Values</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Every feature reflects our commitment to the Jewish community and its traditions.
          </p>
        </motion.div>

        {/* Values Grid */}
        <motion.div
          ref={ref}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {values.map((value) => (
            <ValueCard key={value.title} value={value} />
          ))}
        </motion.div>

        {/* Testimonial */}
        <motion.div
          className="mt-20 max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="glass-card p-8 md:p-12">
            {/* Quote marks */}
            <div className="text-gold-500/30 text-6xl font-serif leading-none mb-4">
              &ldquo;
            </div>
            <blockquote className="text-xl md:text-2xl text-white font-light leading-relaxed mb-6">
              The app respects our traditions while helping us find meaningful
              connections. Finally, a dating app that understands Jewish values.
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-gold-600" />
              <div className="text-left">
                <div className="text-white font-medium">Sarah K.</div>
                <div className="text-gray-400 text-sm">New York City</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

interface ValueCardProps {
  value: (typeof values)[number];
}

function ValueCard({ value }: ValueCardProps) {
  const Icon = value.icon;

  return (
    <motion.div
      className="group glass-card p-6 text-center hover:bg-white/[0.08] transition-colors cursor-default"
      variants={itemVariants}
      whileHover={{ y: -5 }}
    >
      <motion.div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
          value.color === "gold" && "bg-gold-500/10 text-gold-500 group-hover:bg-gold-500/20",
          value.color === "purple" && "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20",
          value.color === "coral" && "bg-coral-500/10 text-coral-500 group-hover:bg-coral-500/20"
        )}
        whileHover={{ rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.4 }}
      >
        <Icon size={28} />
      </motion.div>
      <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{value.description}</p>
    </motion.div>
  );
}
