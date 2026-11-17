import * as React from 'react'
import { LiquidMetal } from '@paper-design/shaders-react'

/* Liquid metal (Paper Shaders' LiquidMetal, Apache-2.0) in Trading Assistant gold.
   A shape is drawn to a canvas, then the shader turns it into moving metal.
   Falls back to the static gold gradient when WebGL2 is missing. */

const GOLD = { colorBack: '#00000000', colorTint: '#ffffff' }

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

type Drawn = { src: string; w: number; h: number }

function useDrawn(draw: () => Promise<Drawn | null>, deps: React.DependencyList) {
  const [d, setD] = React.useState<Drawn | null>(null)
  React.useEffect(() => {
    let live = true
    if (!hasWebGL2()) return
    draw().then((r) => live && setD(r)).catch(() => {})
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return d
}

function Metal({ d, maxWidth, className }: { d: Drawn; maxWidth: number; className?: string }) {
  return (
    <LiquidMetal
      aria-hidden
      className={className}
      image={d.src}
      {...GOLD}
      shape="none"
      repetition={2}
      softness={0.1}
      shiftRed={0.25}
      shiftBlue={0.25}
      distortion={0.07}
      contour={0.4}
      angle={70}
      speed={reducedMotion() ? 0 : 0.6}
      scale={1}
      fit="contain"
      style={{ width: '100%', maxWidth, aspectRatio: `${d.w} / ${d.h}`, background: 'transparent', filter: 'sepia(1) saturate(2.6) hue-rotate(-6deg) brightness(1.35) contrast(1.05) drop-shadow(0 2px 10px rgba(220,182,79,.3))' }}
    />
  )
}

/** Script text in liquid gold. `fallback` renders until the metal is ready (and forever without WebGL2). */
export function MetalText({ text, font, px, fallback }: { text: string; font: string; px: number; fallback: React.ReactNode }) {
  const d = useDrawn(async () => {
    const spec = `${px}px "${font}"`
    try {
      await document.fonts.load(spec, text)
    } catch {
      /* draw with whatever loaded */
    }
    const scale = 2
    const probe = document.createElement('canvas').getContext('2d')
    if (!probe) return null
    probe.font = spec
    const m = probe.measureText(text)
    const padX = px * 0.35
    const w = Math.ceil(m.width + padX * 2)
    const h = Math.ceil(px * 1.45)
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.scale(scale, scale)
    ctx.font = spec
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#000'
    ctx.fillText(text, padX, h * 0.52)
    // Great Vibes is hairline-thin; a light stroke gives the metal room to shine
    ctx.lineWidth = px * 0.028
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000'
    ctx.strokeText(text, padX, h * 0.52)
    return { src: c.toDataURL('image/png'), w, h }
  }, [text, font, px])
  if (!d) return <>{fallback}</>
  return (
    <span className="relative block">
      <span className="sr-only">{text}</span>
      <Metal d={d} maxWidth={d.w} className="-ml-[0.35em] block" />
    </span>
  )
}

/** The Trading Assistant mark (rounded square + rising line) in liquid gold. */
export function MetalCrest({ size = 56, fallback }: { size?: number; fallback: React.ReactNode }) {
  const d = useDrawn(async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="224" height="224" viewBox="0 0 56 56"><rect x="2.5" y="2.5" width="51" height="51" rx="16" fill="none" stroke="#000" stroke-width="3.2"/><path d="M13 37 L22 27 L29 32 L42 18" fill="none" stroke="#000" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="42" cy="18" r="4.2" fill="#000"/></svg>`
    return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, w: 56, h: 56 }
  }, [])
  if (!d) return <>{fallback}</>
  return (
    <span style={{ display: 'block', width: size, height: size }}>
      <Metal d={d} maxWidth={size} />
    </span>
  )
}
