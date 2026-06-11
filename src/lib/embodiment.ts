/**
 * Embodiment cycle for the hero Spline robot.
 *
 *   physical → dissolving → ternary → emerging → physical → …
 *
 * The hosted Spline scene can't be edited, so the cycle is screen-space:
 * Matrix-style digital rain (-1/0/1 columns with fading trails) on a 2D
 * canvas overlay, plus a smooth top-to-bottom gradient-mask wipe on the
 * wrapper around the WebGL canvas. The wipe is CSS-interpolated
 * (mask-position transition) — no per-frame JS restyling.
 *
 * Plain TS, no React. Instantiated by SplineScene when `embodiment` is set.
 */

type Phase = 'physical' | 'dissolving' | 'ternary' | 'emerging'

const HOLD_FIRST = 14000
const HOLD = 12000
const DISSOLVE = 2400
const TERNARY = 5000
const EMERGE = 2800

const WIPE_OUT = 2200 // dissolving: hide top→bottom
const WIPE_IN = 2400 //  emerging:   reveal top→bottom (rain direction)
const EASE_WIPE = 'cubic-bezier(0.45, 0, 0.25, 1)'

// Oversized (300%) masks so a mask-position transition sweeps the soft band
// through the element. Position animates 0% 100% → 0% 0% in both cases.
const GRAD_HIDE =
  'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,1) 63%, rgba(0,0,0,1) 100%)'
const GRAD_REVEAL =
  'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 37%, rgba(0,0,0,0) 70%, rgba(0,0,0,0) 100%)'

const GLYPHS = ['0', '1', '-1']
const FONT_SIZES = [12, 15, 18]
const COL_W = 18 // CSS px between rain columns
const MAX_COLS = 64

const MONO = '"JetBrains Mono Variable", monospace'

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function fontsReady(): Promise<unknown> {
  const ready = document.fonts?.ready ?? Promise.resolve()
  return Promise.race([ready, new Promise((r) => setTimeout(r, 1500))])
}

interface Sprite {
  c: HTMLCanvasElement
  w: number // CSS px
  h: number
}

interface RainColumn {
  x: number
  y: number // head position, CSS px
  rowH: number
  sizeIdx: number
  body: 'signal' | 'mute'
  stepMs: number
  acc: number
  active: boolean
  gap: number // cooldown before this column may respawn
  last: { x: number; y: number; glyphIdx: number } | null
}

/** Matrix-style digital rain of -1/0/1 glyphs with fading trails. */
class MatrixRain {
  private ctx: CanvasRenderingContext2D | null
  private dpr: number
  private cw = 0
  private ch = 0
  // sprites[pool][sizeIdx][glyphIdx]
  private sprites: Record<'head' | 'signal' | 'mute', Sprite[][]> | null = null
  private cols: RainColumn[] = []
  private mode: 'idle' | 'rain' = 'idle'
  private intensity = 0
  private target = 0
  private fadeTail = 0
  private ro: ResizeObserver | null = null
  private resizeTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement
  ) {
    this.ctx = canvas.getContext('2d')
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        clearTimeout(this.resizeTimer)
        this.resizeTimer = setTimeout(() => this.resize(), 200)
      })
      this.ro.observe(container)
    }
    this.resize()
  }

  /** Pre-render glyph sprites — call after fonts are ready. */
  init() {
    if (this.sprites) return
    const paper = cssColor('--color-paper', '#e8f0ff')
    const signal = cssColor('--color-signal', '#3f8cff')
    const mute = cssColor('--color-mute', '#5a7fa8')
    const build = (color: string) =>
      FONT_SIZES.map((size) => GLYPHS.map((g) => this.makeSprite(g, size, color)))
    this.sprites = { head: build(paper), signal: build(signal), mute: build(mute) }
  }

  private makeSprite(text: string, size: number, color: string): Sprite {
    const c = document.createElement('canvas')
    const measure = c.getContext('2d')!
    const font = `500 ${size * this.dpr}px ${MONO}`
    measure.font = font
    const w = Math.ceil(measure.measureText(text).width) + 4
    const h = Math.ceil(size * this.dpr * 1.3)
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2)
    return { c, w: w / this.dpr, h: h / this.dpr }
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.cw = w
    this.ch = h
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.layoutColumns()
  }

  private layoutColumns() {
    const n = Math.min(Math.floor(this.cw / COL_W), MAX_COLS)
    this.cols = []
    for (let i = 0; i < n; i++) {
      const sizeIdx = Math.floor(Math.random() * FONT_SIZES.length)
      this.cols.push({
        x: i * COL_W + COL_W / 2 + (Math.random() - 0.5) * 4,
        y: 0,
        rowH: FONT_SIZES[sizeIdx] * 1.1,
        sizeIdx,
        body: Math.random() < 0.3 ? 'signal' : 'mute',
        stepMs: 55 + Math.random() * 55,
        acc: 0,
        active: false,
        gap: Math.random() * 800,
        last: null,
      })
    }
  }

  /** Rain ramps in (dissolve/ternary). */
  rainOn() {
    if (!this.sprites) this.init()
    this.mode = 'rain'
    this.target = 1
  }

  /** Stop spawning; trails fade out naturally, then the field goes idle. */
  rainOff() {
    this.target = 0
  }

  clearAll() {
    this.mode = 'idle'
    this.intensity = 0
    this.target = 0
    this.fadeTail = 0
    for (const c of this.cols) {
      c.active = false
      c.last = null
    }
    this.ctx?.clearRect(0, 0, this.cw, this.ch)
  }

  /** Advance the rain. Returns false once the field is fully idle. */
  step(dt: number): boolean {
    const ctx = this.ctx
    if (this.mode === 'idle' || !ctx || !this.sprites) return false

    // Ramp intensity toward target (full swing ≈ 900ms)
    const ramp = dt / 900
    this.intensity += Math.max(-ramp, Math.min(ramp, this.target - this.intensity))

    // Fade pass — existing glyphs lose alpha, forming the trails
    const fade = Math.min(0.3, 0.055 * (dt / 16.7))
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = `rgba(0,0,0,${fade})`
    ctx.fillRect(0, 0, this.cw, this.ch)
    ctx.globalCompositeOperation = 'source-over'

    // Spawn management — keep ~intensity share of columns active (staggered)
    const want = Math.round(this.cols.length * this.intensity)
    let active = 0
    for (const c of this.cols) if (c.active) active++
    if (active < want) {
      let budget = 2 // at most 2 activations per frame, for organic stagger
      for (const c of this.cols) {
        if (active >= want || budget <= 0) break
        if (c.active) continue
        c.gap -= dt
        if (c.gap > 0) continue
        c.active = true
        c.y = -Math.random() * this.ch * 0.5
        c.acc = 0
        c.last = null
        c.stepMs = 55 + Math.random() * 55
        active++
        budget--
      }
    }

    // Advance heads in glyph-row steps (quantized, like the film)
    for (const c of this.cols) {
      if (!c.active) continue
      c.acc += dt
      while (c.acc >= c.stepMs) {
        c.acc -= c.stepMs
        this.drawStep(c)
        c.y += c.rowH
        if (c.y > this.ch + 30) {
          c.active = false
          c.gap = 200 + Math.random() * 1200
          c.last = null
          break
        }
      }
    }

    // Idle detection once rain is off and trails have fully faded
    if (this.target === 0 && active === 0) {
      this.fadeTail += dt
      if (this.fadeTail > 1100) {
        this.clearAll()
        return false
      }
    } else {
      this.fadeTail = 0
    }
    return true
  }

  private drawStep(c: RainColumn) {
    const ctx = this.ctx!
    const sprites = this.sprites!
    // Re-draw the previous head in body color so only the head stays bright
    if (c.last) {
      const s = sprites[c.body][c.sizeIdx][c.last.glyphIdx]
      ctx.globalAlpha = 0.8
      ctx.drawImage(s.c, c.last.x - s.w / 2, c.last.y - s.h / 2, s.w, s.h)
    }
    if (c.y > -20) {
      const r = Math.random()
      const glyphIdx = r < 0.4 ? 0 : r < 0.8 ? 1 : 2
      const s = sprites.head[c.sizeIdx][glyphIdx]
      ctx.globalAlpha = 0.95
      ctx.drawImage(s.c, c.x - s.w / 2, c.y - s.h / 2, s.w, s.h)
      c.last = { x: c.x, y: c.y, glyphIdx }
    }
    ctx.globalAlpha = 1
  }

  destroy() {
    this.ro?.disconnect()
    clearTimeout(this.resizeTimer)
    this.clearAll()
  }
}

/** State machine driving the whole cycle. Owns the single rAF loop. */
export class EmbodimentCycle {
  private phase: Phase = 'physical'
  private app: { play?: () => void; stop?: () => void } | null = null
  private visible = true
  private hidden = false
  private destroyed = false

  private elapsed = 0
  private raf = 0
  private last = 0

  private holdTimer: ReturnType<typeof setTimeout> | null = null
  private holdRemaining = HOLD_FIRST
  private holdDeadline = 0

  private field: MatrixRain

  constructor(
    private wrapper: HTMLElement,
    canvas: HTMLCanvasElement,
    container: HTMLElement
  ) {
    this.field = new MatrixRain(canvas, container)
    this.hidden = document.hidden
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  /** Call once the Spline scene has loaded — the clock starts here. */
  start(app: { play?: () => void; stop?: () => void }) {
    if (this.destroyed || this.app) return
    this.app = app
    this.applyWebGL()
    void this.init()
    this.enterPhysical(true)
  }

  private async init() {
    await fontsReady()
    if (this.destroyed) return
    this.field.init()
  }

  setVisible(v: boolean) {
    if (v === this.visible) return
    this.visible = v
    this.applyWebGL()
    this.updateRunning()
  }

  wantsWebGL() {
    return this.phase !== 'ternary'
  }

  private onVisibility = () => {
    this.hidden = document.hidden
    this.updateRunning()
  }

  private get paused() {
    return !this.visible || this.hidden || this.destroyed
  }

  private applyWebGL() {
    const app = this.app
    if (!app) return
    if (this.visible && this.wantsWebGL()) app.play?.()
    else app.stop?.()
  }

  private updateRunning() {
    if (this.paused) {
      if (this.raf) {
        cancelAnimationFrame(this.raf)
        this.raf = 0
      }
      if (this.holdTimer != null) {
        clearTimeout(this.holdTimer)
        this.holdTimer = null
        this.holdRemaining = Math.max(0, this.holdDeadline - performance.now())
      }
    } else if (this.app) {
      if (this.phase === 'physical') {
        this.armHold()
        this.startRaf() // in case rain trails are still flushing
      } else {
        this.startRaf()
      }
    }
  }

  private armHold() {
    if (this.holdTimer != null) return
    this.holdDeadline = performance.now() + this.holdRemaining
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null
      this.enterDissolving()
    }, this.holdRemaining)
  }

  private startRaf() {
    if (this.raf) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.raf = 0
    if (this.paused) return
    const dt = Math.min(now - this.last, 50)
    this.last = now
    this.elapsed += dt

    if (this.phase === 'dissolving') {
      if (this.elapsed >= DISSOLVE) this.enterTernary()
    } else if (this.phase === 'ternary') {
      if (this.elapsed >= TERNARY) this.enterEmerging()
    } else if (this.phase === 'emerging') {
      if (this.elapsed >= EMERGE) this.enterPhysical(false)
    }

    const fieldActive = this.field.step(dt)
    // During the physical hold, keep ticking only until rain trails finish fading
    if (!this.paused && (this.phase !== 'physical' || fieldActive)) {
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  private enterPhysical(first: boolean) {
    this.phase = 'physical'
    this.clearMask()
    this.setStatic('1')
    this.field.rainOff()
    this.holdRemaining = first ? HOLD_FIRST : HOLD
    this.applyWebGL()
    if (!this.paused) this.armHold()
  }

  private enterDissolving() {
    this.phase = 'dissolving'
    this.elapsed = 0
    this.wipe('hide')
    this.field.rainOn()
    this.applyWebGL()
    this.startRaf()
  }

  private enterTernary() {
    this.phase = 'ternary'
    this.elapsed = 0
    this.clearMask()
    this.setStatic('0')
    this.applyWebGL() // stops the WebGL loop — robot is invisible
  }

  private enterEmerging() {
    this.phase = 'emerging'
    this.elapsed = 0
    this.field.rainOff() // trails thin out as the robot wipes in beneath them
    this.wipe('reveal')
    this.applyWebGL()
  }

  /**
   * Smooth top→bottom wipe, matching the rain direction. The gradient band
   * sweeps through via a CSS mask-position transition — fully interpolated,
   * no stepping. 'hide' erases the robot top-first; 'reveal' draws it in
   * top-first. Opacity is a near-end safety net, not the visible effect.
   */
  private wipe(kind: 'hide' | 'reveal') {
    const s = this.wrapper.style
    const set = (prop: string, value: string) => {
      s.setProperty(`-webkit-${prop}`, value)
      s.setProperty(prop, value)
    }
    // Setup: place the band at its start position with no transition
    s.setProperty('transition', 'none')
    set('mask-image', kind === 'hide' ? GRAD_HIDE : GRAD_REVEAL)
    set('mask-size', '100% 300%')
    set('mask-repeat', 'no-repeat')
    set('mask-position', '0% 100%')
    s.setProperty('opacity', kind === 'hide' ? '1' : '0')
    void this.wrapper.offsetWidth // flush so the next change animates

    const dur = kind === 'hide' ? WIPE_OUT : WIPE_IN
    const opacity =
      kind === 'hide'
        ? `opacity 700ms ease-out ${dur - 500}ms` // fade out only near the end
        : 'opacity 600ms ease-out' //               come in fast, wipe does the rest
    s.setProperty(
      'transition',
      `-webkit-mask-position ${dur}ms ${EASE_WIPE}, mask-position ${dur}ms ${EASE_WIPE}, ${opacity}`
    )
    set('mask-position', '0% 0%')
    s.setProperty('opacity', kind === 'hide' ? '0' : '1')
  }

  private clearMask() {
    const s = this.wrapper.style
    s.setProperty('-webkit-mask-image', 'none')
    s.setProperty('mask-image', 'none')
  }

  private setStatic(opacity: string) {
    const s = this.wrapper.style
    s.setProperty('transition', 'none')
    s.setProperty('opacity', opacity)
  }

  destroy() {
    this.destroyed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.holdTimer != null) clearTimeout(this.holdTimer)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.field.destroy()
  }
}
