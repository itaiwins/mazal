"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface FloatingPhoneProps {
  className?: string;
  imageSrc?: string;
}

export function FloatingPhone({ className, imageSrc }: FloatingPhoneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mouse position
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animation
  const springConfig = { stiffness: 150, damping: 15 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (e.clientX - centerX) / rect.width;
    const y = (e.clientY - centerY) / rect.height;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      className={cn("relative perspective-1000", className)}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: 1000,
      }}
    >
      <motion.div
        className="relative"
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          y: [0, -15, 0],
        }}
        transition={{
          y: {
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
      >
        {/* Golden glow effect */}
        <motion.div
          className="absolute inset-0 rounded-[3rem] bg-gold-500/20 blur-3xl"
          animate={{
            opacity: isHovered ? 0.4 : 0.2,
            scale: isHovered ? 1.1 : 1,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Phone frame */}
        <div className="relative z-10">
          {/* Phone outer frame */}
          <div className="relative w-[220px] h-[460px] sm:w-[260px] sm:h-[540px] md:w-[300px] md:h-[620px] rounded-[2rem] sm:rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-b from-gray-800 to-gray-900 p-1.5 sm:p-2 shadow-2xl">
            {/* Gold rim highlight */}
            <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-tr from-gold-500/20 via-transparent to-gold-400/20 pointer-events-none" />

            {/* Phone screen */}
            <div className="relative w-full h-full rounded-[1.75rem] sm:rounded-[2rem] md:rounded-[2.5rem] bg-navy-950 overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 sm:w-24 md:w-32 h-5 sm:h-6 md:h-7 bg-black rounded-b-xl sm:rounded-b-2xl z-20" />

              {/* Screen content */}
              {imageSrc ? (
                <Image
                  src={imageSrc}
                  alt="Mazal App Screenshot"
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <PhonePlaceholder />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Placeholder screen showing app UI mockup
function PhonePlaceholder() {
  return (
    <div className="w-full h-full bg-navy-900 p-2 sm:p-3 md:p-4 pt-8 sm:pt-9 md:pt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
        <div className="text-gold-500 font-serif text-base sm:text-lg md:text-xl font-semibold">Mazal</div>
        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-navy-700" />
      </div>

      {/* Profile Card */}
      <motion.div
        className="relative w-full aspect-[3/4] rounded-xl sm:rounded-2xl bg-gradient-to-b from-navy-700 to-navy-800 overflow-hidden shadow-lg"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        {/* Photo placeholder */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-600/50 to-navy-900/90" />

        {/* Profile info */}
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 md:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
            <div className="text-white font-semibold text-sm sm:text-base md:text-lg">Sarah, 28</div>
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-500" />
          </div>
          <div className="text-gray-300 text-xs sm:text-sm mb-1">NYC • 2 miles</div>
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gold-500/20 text-gold-400 text-[10px] sm:text-xs rounded-full">
              Orthodox
            </span>
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-500/20 text-purple-400 text-[10px] sm:text-xs rounded-full">
              Verified
            </span>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="flex justify-center gap-2 sm:gap-3 md:gap-4 mt-2 sm:mt-3 md:mt-4">
        <motion.div
          className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-navy-700 border-2 border-red-400/50 flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-lg sm:text-xl md:text-2xl">✕</span>
        </motion.div>
        <motion.div
          className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-gold-glow"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-lg sm:text-xl md:text-2xl">✡</span>
        </motion.div>
        <motion.div
          className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-navy-700 border-2 border-green-400/50 flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-lg sm:text-xl md:text-2xl">♥</span>
        </motion.div>
      </div>
    </div>
  );
}
