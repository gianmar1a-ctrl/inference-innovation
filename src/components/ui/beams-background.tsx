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
  offscreen: OffscreenCanvas | HTMLCanvasElement;
}

const BLUR_PX = 30;                                 // softens beams into background haze (baked once, never re-applied)
const BLUR_PAD = BLUR_PX * 2;                       // generous halo around the soft falloff

// Bake the soft beam into a bitmap once. The haze is built from pure gradients —
// vertical color falloff × horizontal alpha falloff — instead of ctx.filter blur,
// which Safari's 2D canvas does not implement (it silently no-ops, leaving
// hard-edged bars). Gradients render identically in every browser, and the
// visible canvas still does zero per-paint filter work.
function buildOffscreen(width: number, length: number, hueStr: string): OffscreenCanvas | HTMLCanvasElement {
  const W = Math.ceil(width  + BLUR_PAD * 2);
  const L = Math.ceil(length + BLUR_PAD * 2);
  let oc: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas !== "undefined") {
    oc = new OffscreenCanvas(W, L);
  } else {
    oc = document.createElement("canvas");
    oc.width = W;
    oc.height = L;
  }
  const octx = oc.getContext("2d") as CanvasRenderingContext2D;
  // Vertical color falloff along the beam
  const g = octx.createLinearGradient(0, 0, 0, L);
  g.addColorStop(0,   `hsla(${hueStr}, 0)`);
  g.addColorStop(0.5, `hsla(${hueStr}, 1)`);
  g.addColorStop(1,   `hsla(${hueStr}, 0)`);
  octx.fillStyle = g;
  octx.fillRect(0, 0, W, L);
  // Horizontal alpha falloff across the beam — emulates the lateral blur
  const h = octx.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0,   "rgba(0,0,0,0)");
  h.addColorStop(0.5, "rgba(0,0,0,1)");
  h.addColorStop(1,   "rgba(0,0,0,0)");
  octx.globalCompositeOperation = "destination-in";
  octx.fillStyle = h;
  octx.fillRect(0, 0, W, L);
  octx.globalCompositeOperation = "source-over";
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

  // Lower than the pre-bake era (was 0.7): baked per-beam blur stays concentrated
  // to each shape instead of spreading across the surface, so beams composite
  // about 1.5× more intensely. These values restore the original "soft haze" look.
  const opacityMap = { subtle: 0.45, medium: 0.6, strong: 0.75 };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile  = window.innerWidth < 768;
    const beamCount = isMobile ? 8 : 16;

    const updateCanvasSize = () => {
      // 1× CSS pixels — no DPR upscale (blurred content doesn't benefit from Retina
      // and the GPU paint cost is significant at 2×). No downscale either, since the
      // rotated beam bitmaps alias visibly at lower resolution.
      canvas.width        = window.innerWidth;
      canvas.height       = window.innerHeight;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
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
      beam.offscreen = buildOffscreen(beam.width, beam.length, beam.hueStr);
      return beam;
    }

    function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
      const p = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * opacityMap[intensity];
      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(beam.x, beam.y);
      ctx.rotate((beam.angle * Math.PI) / 180);
      // Offset by -BLUR_PAD so the original beam center stays put despite the halo
      ctx.drawImage(beam.offscreen, -beam.width / 2 - BLUR_PAD, -BLUR_PAD);
      ctx.restore();
    }

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const totalBeams = beamsRef.current.length;
      beamsRef.current.forEach((beam, index) => {
        beam.y     -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -100) resetBeam(beam, index, totalBeams);
        drawBeam(ctx, beam);
      });
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameRef.current);
      } else {
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
    <div className={posClass} style={{ zIndex: z, contain: "strict" }} aria-hidden="true">
      {/* No CSS filter — blur is baked into each beam bitmap. */}
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
