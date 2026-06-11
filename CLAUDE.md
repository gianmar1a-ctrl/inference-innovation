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

**Palette** (navy/blue, derived from `iii-mark.svg`: `#0f274a` deep navy + `#3f8cff` electric blue):
- `--color-ink` `#070d18` — page background (near-black navy)
- `--color-surface` `#0d1e35` / `--color-surface-2` `#0f274a` — elevated card backgrounds
- `--color-paper` `#e8f0ff` — primary text (ice blue-white, 17.0:1 on ink)
- `--color-mute` `#5a7fa8` — secondary text; only for non-essential labels (4.7:1 on ink — passes AA for normal text, barely; not AAA)
- `--color-rule` `#0f1f33` / `--color-rule-strong` `#162840` — hairline and tick-mark color
- `--color-signal` `#3f8cff` — single electric-blue accent; used sparingly (5.9:1 on ink). Variants: `--color-signal-soft` (12% tint for fills), `--color-signal-ink` (dark text on signal backgrounds), `--color-accent` (alias of signal)

The `@theme` block also mirrors shadcn tokens (`--color-card`, `--color-card-foreground`, `--color-muted-foreground`, `--color-border`) onto the same palette for ported shadcn components.

**Fonts (self-hosted via Fontsource, no CDN):**
- `--font-display`: Outfit Variable — headings (`h1`–`h4`); `wght` axis only (h1 550, h2/h3 500, h4 600), no `opsz` and no true italic — `em` inside headings renders upright in signal blue instead of italic
- `--font-body`: DM Sans Variable — body text (set on `body`)
- `--font-mono`: JetBrains Mono Variable — eyebrows, labels, captions, nav, footer

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
- `.section-num` — signal-blue mono section marker (`§ 01`)
- `.container-page` — max-width page wrapper with inline padding
- `.prose-narrow` — prose-width cap
- `.rule-tick` — hairline `<div>` with vertical tick marks at each end (engineering-drawing aesthetic); `::before`/`::after` are on the class, so the element must be the rule itself, not a wrapper
- `.corner-tick` — `::before`/`::after` add L-shaped corner marks (top-left and bottom-right); pair with `border` on the same element for full engineering frame
- `.grid-bg` — faint hairline grid; used sparingly on empty-state frames
- `.reveal` — horizontal `translateX(-12px)` scroll-in (280ms); toggled to `.is-in` by `Base.astro` IntersectionObserver
- `.reveal-up` — vertical `translateY(8px)` scroll-in (240ms); observed by the same observer
- `.word-reveal` — splits text into `<span>` words that stagger in; wrap target text in `<span>` tags manually
- `.signal-dot` — pulsing signal-blue 6px dot
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
