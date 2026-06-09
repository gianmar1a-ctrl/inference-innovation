"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";

const links = [
  { href: "#challenge", label: "Challenge" },
  { href: "#framework", label: "Framework" },
  { href: "#network", label: "Network" },
  { href: "#programs", label: "Programs" },
  { href: "#team", label: "Team" },
  { href: "#engage", label: "Engage" },
];

type Position = { left: number; width: number; opacity: number };

export function NavLinks() {
  const [position, setPosition]   = useState<Position>({ left: 0, width: 0, opacity: 0 });
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <ul
      className="relative flex items-center rounded-full border border-[var(--color-rule)] p-0.5"
      onMouseLeave={() => {
        setPosition((pv) => ({ ...pv, opacity: 0 }));
        setActiveIdx(null);
      }}
    >
      {links.map(({ href, label }, i) => (
        <Tab
          key={href}
          href={href}
          index={i}
          isActive={activeIdx === i}
          setPosition={setPosition}
          setActiveIdx={setActiveIdx}
        >
          {label}
        </Tab>
      ))}
      <Cursor position={position} />
    </ul>
  );
}

function Tab({
  href,
  children,
  index,
  isActive,
  setPosition,
  setActiveIdx,
}: {
  href: string;
  children: React.ReactNode;
  index: number;
  isActive: boolean;
  setPosition: React.Dispatch<React.SetStateAction<Position>>;
  setActiveIdx: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({ width, opacity: 1, left: ref.current.offsetLeft });
        setActiveIdx(index);
      }}
      className="relative z-10"
    >
      <a
        href={href}
        // Color switch on hover replaces mix-blend-difference — no GPU blend on every paint.
        className={`block px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] whitespace-nowrap transition-colors duration-150 ${
          isActive ? "text-[var(--color-ink)]" : "text-[var(--color-paper)]"
        }`}
      >
        {children}
      </a>
    </li>
  );
}

function Cursor({ position }: { position: Position }) {
  return (
    <motion.li
      animate={{
        x: position.left,
        width: position.width,
        opacity: position.opacity,
      }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="absolute z-0 left-0 rounded-full bg-[var(--color-paper)] pointer-events-none opacity-0"
      style={{ top: 2, bottom: 2, contain: "layout paint" }}
      aria-hidden="true"
    />
  );
}
