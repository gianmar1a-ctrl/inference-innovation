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

const CURSOR_BASE_WIDTH = 100; // px — scaleX keeps this compositor-only (no layout)

export function NavLinks() {
  const [position, setPosition] = useState<Position>({ left: 0, width: 0, opacity: 0 });

  return (
    <ul
      className="relative isolate flex items-center rounded-full border border-[var(--color-rule)] p-0.5"
      onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
    >
      {links.map(({ href, label }) => (
        <Tab key={href} href={href} setPosition={setPosition}>
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
  setPosition,
}: {
  href: string;
  children: React.ReactNode;
  setPosition: React.Dispatch<React.SetStateAction<Position>>;
}) {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({ width, opacity: 1, left: ref.current.offsetLeft });
      }}
      className="relative z-10"
    >
      <a
        href={href}
        className="block px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-paper)] mix-blend-difference whitespace-nowrap"
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
        // Center-origin scaleX: x compensates so cursor covers the tab exactly.
        // Both ends compress symmetrically — far less visible than left-origin squish.
        x: position.left + (position.width - CURSOR_BASE_WIDTH) / 2,
        scaleX: position.width > 0 ? position.width / CURSOR_BASE_WIDTH : 0,
        opacity: position.opacity,
      }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="absolute z-0 left-0 rounded-full bg-[var(--color-paper)] pointer-events-none opacity-0"
      style={{ top: 2, bottom: 2, width: CURSOR_BASE_WIDTH, transformOrigin: "center" }}
      aria-hidden="true"
    />
  );
}
