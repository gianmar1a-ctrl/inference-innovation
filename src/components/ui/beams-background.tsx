"use client";

import { useEffect, useRef } from "react";

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
  // Pre-computed hue string — hue never changes after creation, avoids string alloc per frame
  hueStr: string;
}

function createBeam(width: number, height: number): Beam {
  const angle = -35 + Math.random() * 10;
  const hue = 205 + Math.random() * 40;
  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 30 + Math.random() * 60,
    length: height * 2.5,
    angle,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue,
    hueStr: `${hue.toFixed(1)}, 85%, 65%`,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
  };
}

/**
 * Animated light-beam background.
 * `fixed={true}` → position:fixed, z-index:-1 (full-site layer behind all content).
 * `fixed={false}` (default) → position:absolute, sits inside a relative container.
 */
export function BeamsBackground({
  intensity = "subtle",
  fixed = false,
}: {
  intensity?: "subtle" | "medium" | "strong";
  fixed?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<Beam[]>([]);
  const animationFrameRef = useRef<number>(0);
  const MINIMUM_BEAMS = 20;

  const opacityMap = { subtle: 0.7, medium: 0.85, strong: 1 };

  useEffect(() => {
    // Skip animation for users who prefer reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fewer beams on mobile — cheaper draw loop, still looks good under CSS blur
    const isMobile = window.innerWidth < 768;
    const BEAM_COUNT = Math.ceil(MINIMUM_BEAMS * (isMobile ? 0.6 : 1.5));

    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2× — 3× screens don't need it
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      beamsRef.current = Array.from(
        { length: BEAM_COUNT },
        () => createBeam(window.innerWidth, window.innerHeight)
      );
    };

    updateCanvasSize();

    // Throttle resize to once per 200ms — avoids recreating all beams on every pixel change
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateCanvasSize, 200);
    };
    window.addEventListener("resize", onResize);

    function resetBeam(beam: Beam, index: number, totalBeams: number) {
      const column = index % 3;
      const spacing = window.innerWidth / 3;
      beam.y = window.innerHeight + 100;
      beam.x =
        column * spacing +
        spacing / 2 +
        (Math.random() - 0.5) * spacing * 0.5;
      beam.width = 100 + Math.random() * 100;
      beam.speed = 0.5 + Math.random() * 0.4;
      const hue = 205 + (index * 40) / totalBeams;
      beam.hue = hue;
      beam.hueStr = `${hue.toFixed(1)}, 85%, 65%`;
      beam.opacity = 0.2 + Math.random() * 0.1;
      return beam;
    }

    function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
      ctx.save();
      ctx.translate(beam.x, beam.y);
      ctx.rotate((beam.angle * Math.PI) / 180);
      const p =
        beam.opacity *
        (0.8 + Math.sin(beam.pulse) * 0.2) *
        opacityMap[intensity];
      // Re-use cached hueStr — avoids `hsla(${hue}, 85%, 65%, …)` string alloc each frame
      const h = beam.hueStr;
      const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);
      gradient.addColorStop(0,   `hsla(${h}, 0)`);
      gradient.addColorStop(0.1, `hsla(${h}, ${p * 0.5})`);
      gradient.addColorStop(0.4, `hsla(${h}, ${p})`);
      gradient.addColorStop(0.6, `hsla(${h}, ${p})`);
      gradient.addColorStop(0.9, `hsla(${h}, ${p * 0.5})`);
      gradient.addColorStop(1,   `hsla(${h}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      ctx.restore();
    }

    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const totalBeams = beamsRef.current.length;
      beamsRef.current.forEach((beam, index) => {
        beam.y -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -100) {
          resetBeam(beam, index, totalBeams);
        }
        drawBeam(ctx, beam);
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [intensity]);

  const posClass = fixed
    ? "fixed inset-0 pointer-events-none overflow-hidden"
    : "absolute inset-0 pointer-events-none overflow-hidden";
  const z = fixed ? -1 : 0;

  // Wrapper div holds position:fixed/z-index (no filter).
  // Canvas inside holds filter:blur — keeps filter off a fixed element,
  // which fixes a Safari bug where filter on position:fixed breaks z-index stacking.
  return (
    <div className={posClass} style={{ zIndex: z }} aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ filter: "blur(15px)", willChange: "transform" }}
      />
    </div>
  );
}
