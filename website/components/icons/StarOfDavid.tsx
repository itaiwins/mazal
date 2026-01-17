"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StarOfDavidProps {
  className?: string;
  size?: number;
  animate?: boolean;
  color?: string;
}

export function StarOfDavid({
  className,
  size = 24,
  animate = false,
  color = "currentColor",
}: StarOfDavidProps) {
  const Wrapper = animate ? motion.svg : "svg";
  const animationProps = animate
    ? {
        animate: { rotate: 360 },
        transition: {
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        },
      }
    : {};

  return (
    <Wrapper
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={cn("inline-block", className)}
      {...animationProps}
    >
      {/* Upper triangle */}
      <polygon
        points="50,10 90,75 10,75"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Lower triangle (inverted) */}
      <polygon
        points="50,90 10,25 90,25"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </Wrapper>
  );
}

// Filled version for decorative use
export function StarOfDavidFilled({
  className,
  size = 24,
  color = "currentColor",
}: StarOfDavidProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill={color}
      className={cn("inline-block", className)}
    >
      <polygon points="50,10 90,75 10,75" />
      <polygon points="50,90 10,25 90,25" />
    </svg>
  );
}
