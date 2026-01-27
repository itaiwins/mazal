"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { StarOfDavid } from "@/components/icons/StarOfDavid";

export function DownloadCTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section id="download" className="relative py-24 md:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900 via-navy-950 to-navy-950" />

      {/* Animated gradient blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/2 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
      </div>

      {/* Floating stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, -100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 4,
              ease: "easeOut",
            }}
          >
            <StarOfDavid
              size={8 + Math.random() * 8}
              className="text-gold-500/40"
            />
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-4xl mx-auto px-6">
        <motion.div
          ref={ref}
          className="relative glass-card-strong p-10 md:p-16 text-center"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Gold border glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-gold-500/20 via-transparent to-gold-500/20 opacity-50" />

          {/* Star decoration */}
          <motion.div
            className="absolute -top-6 left-1/2 -translate-x-1/2"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <StarOfDavid size={48} className="text-gold-500" />
          </motion.div>

          <div className="relative">
            <motion.h2
              className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Ready to Find Your{" "}
              <span className="text-shimmer">Bashert</span>?
            </motion.h2>

            <motion.p
              className="text-lg text-gray-300 mb-8 max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Join thousands of Jewish singles finding meaningful connections every day.
            </motion.p>

            {/* Download buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <motion.a
                href="#"
                className="btn-gold inline-flex items-center justify-center gap-3 text-lg px-8 py-4"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <AppleIcon />
                <div className="text-left">
                  <div className="text-xs opacity-80">Download on the</div>
                  <div className="font-semibold">App Store</div>
                </div>
              </motion.a>

              <motion.a
                href="#"
                className="btn-outline inline-flex items-center justify-center gap-3 text-lg px-8 py-4 border-white/30"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <PlayIcon />
                <div className="text-left">
                  <div className="text-xs opacity-80">Get it on</div>
                  <div className="font-semibold">Google Play</div>
                </div>
              </motion.a>
            </motion.div>

            {/* Social proof */}
            <motion.div
              className="mt-8 flex items-center justify-center gap-2 text-gray-400"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <StarOfDavid size={16} className="text-gold-500" />
              <span>Join 10,000+ Jewish singles</span>
              <StarOfDavid size={16} className="text-gold-500" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function AppleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 20.5v-17c0-.83.67-1.5 1.5-1.5.31 0 .6.1.84.26l14.34 8.5c.5.3.82.84.82 1.49s-.32 1.19-.82 1.49l-14.34 8.5c-.24.16-.53.26-.84.26-.83 0-1.5-.67-1.5-1.5z" />
    </svg>
  );
}
