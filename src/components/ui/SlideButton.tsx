"use client";

import { useState } from "react";
import { motion } from "motion/react";

interface SlideButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

export function SlideButton({
  href,
  children,
  variant = "secondary",
  className = "",
}: SlideButtonProps) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = variant === "primary";

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative inline-flex overflow-hidden rounded-full font-mono text-[0.7rem] sm:text-[0.72rem] uppercase tracking-[0.18em] cursor-pointer ${
        isPrimary
          ? "bg-[var(--color-signal)] border border-[var(--color-signal)]"
          : "border border-[var(--color-rule)]"
      } ${className}`}
    >
      <motion.span
        className="absolute inset-0 bg-[var(--color-paper)] pointer-events-none opacity-0 [transform-origin:left_center]"
        animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        aria-hidden="true"
      />
      <span
        className={`relative z-10 inline-flex items-center justify-center gap-2.5 px-5 py-3 sm:px-6 whitespace-nowrap transition-colors duration-150 ${
          isPrimary
            ? "text-[var(--color-ink)]"
            : hovered
            ? "text-[var(--color-ink)]"
            : "text-[var(--color-paper)]"
        }`}
      >
        {children}
      </span>
    </a>
  );
}
