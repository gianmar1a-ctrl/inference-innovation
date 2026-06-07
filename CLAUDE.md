# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js is installed at `~/.local/node-v22.11.0-darwin-arm64/bin/` and is **not** on the system PATH. Prefix all `npm` commands:

```bash
export PATH="$HOME/.local/node-v22.11.0-darwin-arm64/bin:$PATH"
```

Or inline each command:

```bash
PATH="$HOME/.local/node-v22.11.0-darwin-arm64/bin:$PATH" npm run dev
PATH="$HOME/.local/node-v22.11.0-darwin-arm64/bin:$PATH" npm run build
PATH="$HOME/.local/node-v22.11.0-darwin-arm64/bin:$PATH" npm run check   # TypeScript type-check via astro check
PATH="$HOME/.local/node-v22.11.0-darwin-arm64/bin:$PATH" npm run preview # serve the dist/ build locally
```

The Claude Code preview server is configured in `.claude/launch.json` and handles PATH injection automatically.

## Architecture

Single-page marketing site built with **Astro 5** (zero client JS by default). All page sections are Astro components composed in `src/pages/index.astro`. No routing — one page, one URL.

**Component order** (matches visual top-to-bottom): `Nav` → `Hero` → `Challenge` → `Framework` → `Network` → `Methodology` → `ResearchTeam` (+ `TeamCard`) → `Engage` → `Footer`.

**Rendering model:** `Base.astro` wraps everything and injects a single `<script>` block (plain JS, no framework) that drives:
- `IntersectionObserver` for `.reveal`, `.reveal-up`, and `.word-reveal` scroll-in animations
- Per-word staggered `transitionDelay` on `.word-reveal > span` (40ms × index)
- Count-up animation on `[data-countup]` elements (900ms cubic ease-out)

There are no React/Svelte/Vue islands. All interactivity is vanilla JS inside that one script tag.

## Design System

All design tokens live in the `@theme` block in `src/styles/global.css` — this is Tailwind CSS 4's CSS-first config (no `tailwind.config.js`). The `@tailwindcss/vite` plugin in `astro.config.mjs` activates it. New utilities must use `@utility` (not `@layer utilities { .x { } }`).

**5-color palette:**
- `--color-ink` `#08090c` — page background
- `--color-surface` / `--color-surface-2` — elevated card backgrounds
- `--color-paper` `#ece6d5` — primary text (warm bone, 17.6:1 on ink)
- `--color-mute` `#8c91a4` — secondary text; only for non-essential labels (6.9:1 on ink — AA, not AAA)
- `--color-rule` / `--color-rule-strong` — hairline and tick-mark color
- `--color-signal` `#e8a24a` — single amber accent; used sparingly

**Fonts (self-hosted via Fontsource, no CDN):**
- `--font-display`: Fraunces Variable — headings only; imported as `full.css` and `full-italic.css` to enable the `opsz` axis (9–144) in addition to `wght`
- `--font-mono`: JetBrains Mono Variable — body text, eyebrows, labels, captions, nav, footer; the entire non-heading type system

`h1`–`h4` base styles set `font-variation-settings` explicitly per level (Tailwind 4 won't do this automatically): h1 `"opsz" 144`, h2 `"opsz" 96`, h3 `"opsz" 48`, h4 `"opsz" 24`. `font-size-adjust: 0.52` stabilises FOUT during font swap.

**Section layout pattern — `section-grid`:**
Every content section uses a 3-column CSS Grid at lg+: `--rail-w (4rem) | minmax(0,1fr) | --margin-w (12rem)`. Child elements use classes `.rail` (section number), `.body` (content), `.margin` (annotation). Stacks to single column at sm/md.

```html
<div class="section-grid">
  <aside class="rail">§&nbsp;01</aside>
  <div class="body"><!-- content --></div>
  <aside class="margin"><!-- pullquote or note --></aside>
</div>
```

**Utility classes defined in `global.css`:**
- `.eyebrow` / `.signal-eyebrow` — mono uppercase label
- `.section-num` — amber mono section marker (`§ 01`)
- `.container-page` — max-width page wrapper with inline padding
- `.prose-narrow` — prose-width cap
- `.rule-tick` — hairline `<div>` with vertical tick marks at each end (engineering-drawing aesthetic); `::before`/`::after` are on the class, so the element must be the rule itself, not a wrapper
- `.corner-tick` — `::before`/`::after` add L-shaped corner marks (top-left and bottom-right); pair with `border` on the same element for full engineering frame
- `.grid-bg` — faint hairline grid; used sparingly on empty-state frames
- `.reveal` — horizontal `translateX(-12px)` scroll-in (280ms); toggled to `.is-in` by `Base.astro` IntersectionObserver
- `.reveal-up` — vertical `translateY(8px)` scroll-in (240ms); observed by the same observer
- `.word-reveal` — splits text into `<span>` words that stagger in; wrap target text in `<span>` tags manually
- `.signal-dot` — pulsing amber 6px dot
- `.ticker` / `.ticker-track` — infinite marquee (38s)
- `.dot-leader` — flex row for dossier line-items; add `.leader-fill` span between label and value for dotted line

`prefers-reduced-motion` override is at the bottom of `global.css` — it disables all transitions and animations instantly; keep it maintained when adding new motion utilities.

## Content Pending

Horizon Lab member details are placeholders in `src/components/ResearchTeam.astro` (lines ~37–41). When confirmed, update the three `horizon` array entries with real names, roles, bios, and (for the third member) replace `initials: 'HL'` with `photo: '/images/team/horizon-3.jpg'` after dropping the image in `public/images/team/`.

## Image Handling

Team portrait images are stored in `public/images/team/`. Convert PNGs to JPEG before committing — large PNGs balloon build output:

```bash
sips -s format jpeg -s formatOptions 82 -Z 1000 input.png --out public/images/team/output.jpg
```
