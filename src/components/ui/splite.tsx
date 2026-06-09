'use client'

import Spline from '@splinetool/react-spline'
import { useCallback, useEffect, useRef } from 'react'

interface SplineSceneProps {
  scene: string
  className?: string
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef       = useRef<any>(null)
  const visibleRef   = useRef(true)

  // Spline calls this once the WebGL scene is ready
  const onLoad = useCallback((spline: any) => {
    appRef.current = spline
    // If the user already scrolled past the hero before the scene loaded, pause immediately
    if (!visibleRef.current) spline.stop?.()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
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

  return (
    <div ref={containerRef} className={className}>
      <Spline
        scene={scene}
        onLoad={onLoad}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
