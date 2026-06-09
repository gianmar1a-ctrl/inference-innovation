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
  hueStr: string;
  offscreen: OffscreenCanvas; // pre-baked gradient — avoids createLinearGradient every frame
}

// Build once per beam (at creation and reset), then reuse with drawImage.
function buildOffscreen(width: number, length: number, hueStr: string): OffscreenCanvas {
  const oc = new OffscreenCanvas(Math.ceil(width), Math.ceil(length));
  const octx = oc.getContext("2d")!;
  const g = octx.createLinearGradient(0, 0, 0, length);
  g.addColorStop(0,   `hsla(${hueStr}, 0)`);
  g.addColorStop(0.5, `hsla(${hueStr}, 1)`);
  g.addColorStop(1,   `hsla(${hueStr}, 0)`);
  octx.fillStyle = g;
  octx.fillRect(0, 0, width, length);
  return oc;
}

function createBeam(width: number, height: number): Beam {
  const angle  = -35 + Math.random() * 10;
  const hue    = 205 + Math.random() * 40;
  const hueStr = `${hue.toFixed(1)}, 85%, 65%`;
  const bw     = 30 + Math.random() * 60;
  const bl     = height * 2.5;
  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: bw,
    length: bl,
    angle,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue,
    hueStr,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
    offscreen: buildOffscreen(bw, bl, hueStr),
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
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const beamsRef          = useRef<Beam[]>([]);
  const animationFrameRef = useRef<number>(0);

  const opacityMap = { subtle: 0.7, medium: 0.85, strong: 1 };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile  = window.innerWidth < 768;
    const beamCount = isMobile ? 10 : 20; // was 12 / 30 — fewer = faster clear + fewer drawImages

    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width        = window.innerWidth  * dpr;
      canvas.height       = window.innerHeight * dpr;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      beamsRef.current = Array.from({ length: beamCount }, () =>
        createBeam(window.innerWidth, window.innerHeight)
      );
    };

    updateCanvasSize();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateCanvasSize, 200);
    };
    window.addEventListener("resize", onResize);

    function resetBeam(beam: Beam, index: number, totalBeams: number) {
      const column  = index % 3;
      const spacing = window.innerWidth / 3;
      beam.y      = window.innerHeight + 100;
      beam.x      = column * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      beam.opacity = 0.2 + Math.random() * 0.1;
      const hue   = 205 + (index * 40) / totalBeams;
      beam.hue    = hue;
      beam.hueStr = `${hue.toFixed(1)}, 85%, 65%`;
      // Rebuild offscreen only on reset, not every frame
      beam.offscreen = buildOffscreen(beam.width, beam.length, beam.hueStr);
      return beam;
    }

    function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
      const p = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * opacityMap[intensity];
      ctx.save();
      ctx.globalAlpha = p;                                  // one value set, no per-stop string work
      ctx.translate(beam.x, beam.y);
      ctx.rotate((beam.angle * Math.PI) / 180);
      ctx.drawImage(beam.offscreen, -beam.width / 2, 0);   // blit — no gradient allocation
      ctx.restore();
    }

    // 30fps cap — beams are slow + heavily blurred; 30fps is visually imperceptible here.
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 1000 / 30;

    function animate(timestamp: number) {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (timestamp - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const totalBeams = beamsRef.current.length;
      beamsRef.current.forEach((beam, index) => {
        beam.y     -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -100) resetBeam(beam, index, totalBeams);
        drawBeam(ctx, beam);
      });
    }

    // Pause rAF entirely when the tab is hidden — saves CPU/battery
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameRef.current);
      } else {
        lastFrameTime = 0;
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(resizeTimer);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [intensity]);

  const posClass = fixed
    ? "fixed inset-0 pointer-events-none overflow-hidden"
    : "absolute inset-0 pointer-events-none overflow-hidden";
  const z = fixed ? -1 : 0;

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
