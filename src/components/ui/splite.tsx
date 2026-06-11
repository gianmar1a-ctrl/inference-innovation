'use client'

import Spline from '@splinetool/react-spline'
import { useCallback, useEffect, useRef } from 'react'
import { EmbodimentCycle } from '../../lib/embodiment'

interface SplineSceneProps {
  scene: string
  className?: string
  /** Enable the Tron-style materialize/dematerialize loop (hero only). */
  embodiment?: boolean
}

export function SplineScene({ scene, className, embodiment = false }: SplineSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef   = useRef<HTMLDivElement>(null)
  const fieldRef     = useRef<HTMLCanvasElement>(null)
  const appRef       = useRef<any>(null)
  const cycleRef     = useRef<EmbodimentCycle | null>(null)
  const visibleRef   = useRef(true)

  // Spline calls this once the WebGL scene is ready
  const onLoad = useCallback((spline: any) => {
    appRef.current = spline
    if (cycleRef.current) {
      // The embodiment cycle owns play/stop from here on
      cycleRef.current.start(spline)
      cycleRef.current.setVisible(visibleRef.current)
      return
    }
    // If the user already scrolled past the hero before the scene loaded, pause immediately
    if (!visibleRef.current) spline.stop?.()
  }, [])

  useEffect(() => {
    if (!embodiment) return
    // Reduced motion: no cycle — robot stays permanently solid
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const wrapper = wrapperRef.current
    const field = fieldRef.current
    const container = containerRef.current
    if (!wrapper || !field || !container) return

    const cycle = new EmbodimentCycle(wrapper, field, container)
    cycleRef.current = cycle
    // In case the Spline scene loaded before this effect ran
    if (appRef.current) cycle.start(appRef.current)
    return () => {
      cycleRef.current = null
      cycle.destroy()
    }
  }, [embodiment])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
        const cycle = cycleRef.current
        if (cycle) {
          // Cycle decides play/stop (it also pauses WebGL during the ternary phase)
          cycle.setVisible(entry.isIntersecting)
          return
        }
        const app = appRef.current
        if (!app) return
        // Pause the WebGL render loop when the hero is off-screen to free GPU
        entry.isIntersecting ? app.play?.() : app.stop?.()
      },
      { threshold: 0.05 }   // pause once only 5% of the hero remains visible
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const splineEl = (
    <Spline
      scene={scene}
      onLoad={onLoad}
      style={{ width: '100%', height: '100%' }}
    />
  )

  if (!embodiment) {
    return (
      <div ref={containerRef} className={className}>
        {splineEl}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      <div ref={wrapperRef} className="spline-embody">
        {splineEl}
      </div>
      <canvas ref={fieldRef} className="embody-field" aria-hidden="true" />
    </div>
  )
}
