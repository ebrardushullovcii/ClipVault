// Motion-design toolkit for the launch-style videos (60 fps).
import React from 'react'
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { noise2D } from '@remotion/noise'
import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif'
import { FONT } from '../theme'
import { LAYOUTS, Layout, Rect } from '../data'

const serif = loadSerif('italic', { weights: ['400'], subsets: ['latin'] })
export const SERIF = serif.fontFamily
export const SANS = FONT
export const UI_FONT = '"Segoe UI Variable Text", "Segoe UI", ' + FONT

export const M = {
  bg: '#050607',
  ink: '#f5f7f7',
  dim: 'rgba(245,247,247,0.6)',
  teal: '#00d4aa',
  cyan: '#27c7ff',
  violet: '#7b5cff',
  // App palette (for recreated UI).
  app0: '#0f0f0f',
  app1: '#1a1a1a',
  app2: '#242424',
  appLine: 'rgba(255,255,255,0.08)',
  purple: '#c084fc',
  gold: '#facc15',
  green: '#16a34a',
}

export const expoOut = Easing.bezier(0.16, 1, 0.3, 1)
export const inOut = Easing.bezier(0.65, 0, 0.35, 1)
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1)
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// interpolate with clamping and an easing.
export const tw = (f: number, [a, b]: [number, number], [x, y]: [number, number], easing: (t: number) => number = expoOut) =>
  interpolate(f, [a, b], [x, y], { ...CL, easing })

export const useSpring = (at: number, config = { damping: 16, stiffness: 140, mass: 1 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - at, fps, config })
}

// Animated dark background: slow teal/cyan/violet glows, grain and vignette.
export const MeshBg: React.FC<{ intensity?: number; hue?: 'teal' | 'violet' | 'mix'; seed?: string; period?: number }> = ({ intensity = 1, hue = 'mix', seed = 'bg', period }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const t = frame / 240
  const blobs =
    hue === 'teal'
      ? [M.teal, M.cyan, M.teal]
      : hue === 'violet'
        ? [M.violet, M.cyan, M.violet]
        : [M.teal, M.violet, M.cyan]
  return (
    <AbsoluteFill style={{ background: M.bg, overflow: 'hidden' }}>
      {blobs.map((c, i) => {
        // With a period the glows move on closed loops, so the video can loop seamlessly.
        const a = period ? (2 * Math.PI * frame) / period : 0
        const x = period ? 0.5 + 0.32 * Math.cos(a + i * 2.1) : 0.5 + 0.38 * noise2D(seed + i, t, i * 3.1)
        const y = period ? 0.5 + 0.3 * Math.sin(2 * a + i * 1.3) : 0.5 + 0.38 * noise2D(seed + 'y' + i, i * 2.3, t)
        const r = Math.max(width, height) * (0.42 + 0.1 * i)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x * width - r / 2,
              top: y * height - r / 2,
              width: r,
              height: r,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${c} 0%, transparent 62%)`,
              opacity: 0.2 * intensity,
              filter: 'blur(40px)',
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame()
  const ox = (frame * 97) % 512
  const oy = (frame * 61) % 512
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('fx/grain.png')})`,
        backgroundPosition: `${ox}px ${oy}px`,
        mixBlendMode: 'overlay',
        opacity,
        pointerEvents: 'none',
      }}
    />
  )
}

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: 'none' }} />
)

// Kinetic text. Wrap words in *asterisks* to set them in the serif italic accent.
type Tok = { w: string; serif: boolean }
const tokenize = (text: string): Tok[] => {
  const out: Tok[] = []
  let serifOn = false
  for (const part of text.split(/(\*)/)) {
    if (part === '*') {
      serifOn = !serifOn
      continue
    }
    for (const w of part.split(/\s+/).filter(Boolean)) out.push({ w, serif: serifOn })
  }
  return out
}

export const Words: React.FC<{
  text: string
  at: number
  out?: number
  size?: number
  stagger?: number
  color?: string
  accent?: string
  weight?: number
  align?: 'left' | 'center' | 'right'
  style?: React.CSSProperties
  mode?: 'rise' | 'blur' | 'pop'
  lineHeight?: number
  maxWidth?: number
}> = ({ text, at, out, size = 120, stagger = 4, color = M.ink, accent = M.teal, weight = 800, align = 'center', style, mode = 'rise', lineHeight = 1.02, maxWidth }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const toks = tokenize(text)
  return (
    <div
      style={{
        fontFamily: SANS,
        fontWeight: weight,
        fontSize: size,
        letterSpacing: -0.045 * size,
        lineHeight,
        color,
        textAlign: align,
        maxWidth,
        ...style,
      }}
    >
      {toks.map((t, i) => {
        const inS = spring({ frame: frame - at - i * stagger, fps, config: { damping: 18, stiffness: 170 } })
        const outT = out === undefined ? 0 : tw(frame, [out + i * (stagger * 0.6), out + i * (stagger * 0.6) + 14], [0, 1], inOut)
        const serifStyle: React.CSSProperties = t.serif
          ? { fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic', letterSpacing: -0.02 * size, color: accent, fontSize: size * 1.08 }
          : {}
        let inner: React.CSSProperties
        if (mode === 'rise') inner = { transform: `translateY(${(1 - inS) * 105 - outT * 105}%)`, display: 'inline-block' }
        else if (mode === 'blur')
          inner = { display: 'inline-block', opacity: inS * (1 - outT), filter: `blur(${(1 - inS) * 18 + outT * 18}px)`, transform: `translateY(${(1 - inS) * 30}px) scale(${0.96 + 0.04 * inS})` }
        else inner = { display: 'inline-block', opacity: Math.min(1, inS * 1.5) * (1 - outT), transform: `scale(${0.4 + 0.6 * inS + outT * 0.3})` }
        return (
          <span key={i} style={{ display: 'inline-block', overflow: mode === 'rise' ? 'hidden' : 'visible', verticalAlign: 'top', paddingBottom: '0.08em', marginRight: '0.24em' }}>
            <span style={{ ...inner, ...serifStyle }}>{t.w}</span>
          </span>
        )
      })}
    </div>
  )
}

// Centered stage container for text or components.
export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', ...style }}>{children}</AbsoluteFill>
)

// Region of a real app screenshot, shown as its own component.
export const Crop: React.FC<{ layout?: Layout; shot: string; rect: Rect; scale: number; radius?: number; style?: React.CSSProperties; shadow?: boolean }> = ({
  layout = 'wide',
  shot,
  rect,
  scale,
  radius = 14,
  style,
  shadow = true,
}) => {
  const L = LAYOUTS[layout]
  return (
    <div
      style={{
        width: rect.w * scale,
        height: rect.h * scale,
        overflow: 'hidden',
        borderRadius: radius,
        position: 'relative',
        boxShadow: shadow ? '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)' : undefined,
        background: M.app0,
        ...style,
      }}
    >
      <Img
        src={staticFile(`shots/${layout}/${shot}.png`)}
        style={{ position: 'absolute', left: -rect.x * scale, top: -rect.y * scale, width: L.width * scale, height: L.height * scale, maxWidth: 'none' }}
      />
    </div>
  )
}

// A full screenshot as a 3D-capable panel.
export const Screen: React.FC<{ layout?: Layout; shot: string; width: number; style?: React.CSSProperties }> = ({ layout = 'wide', shot, width, style }) => {
  const L = LAYOUTS[layout]
  return (
    <div
      style={{
        width,
        height: (width * L.height) / L.width,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 60px 160px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)',
        background: M.app0,
        ...style,
      }}
    >
      <Img src={staticFile(`shots/${layout}/${shot}.png`)} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

// Small camera shake that decays after `at`.
export const useShake = (at: number, amp = 18, dur = 22) => {
  const frame = useCurrentFrame()
  const t = frame - at
  if (t < 0 || t > dur) return { x: 0, y: 0 }
  const k = (1 - t / dur) ** 2
  return { x: noise2D('sx', t * 0.6, 0) * amp * k, y: noise2D('sy', 0, t * 0.6) * amp * k }
}

export const Flash: React.FC<{ at: number; color?: string; peak?: number; dur?: number }> = ({ at, color = '#ffffff', peak = 0.5, dur = 14 }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [at, at + 2, at + dur], [0, peak, 0], CL)
  if (o <= 0) return null
  return <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: 'screen', pointerEvents: 'none' }} />
}

// Expanding rings (shockwave) centered at x,y.
export const Shockwave: React.FC<{ at: number; x: number; y: number; color?: string; max?: number; rings?: number }> = ({ at, x, y, color = M.teal, max = 900, rings = 3 }) => {
  const frame = useCurrentFrame()
  return (
    <>
      {Array.from({ length: rings }, (_, i) => {
        const t = tw(frame, [at + i * 5, at + i * 5 + 40], [0, 1])
        if (t <= 0 || t >= 1) return null
        const r = 60 + t * max
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - r / 2,
              top: y - r / 2,
              width: r,
              height: r,
              borderRadius: '50%',
              border: `${Math.max(1, 6 * (1 - t))}px solid ${color}`,
              opacity: (1 - t) * 0.8,
              boxShadow: `0 0 ${40 * (1 - t)}px ${color}`,
            }}
          />
        )
      })}
    </>
  )
}

// Soft glass card used behind recreated UI.
export const Glass: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; pad?: number }> = ({ children, style, pad = 28 }) => (
  <div
    style={{
      background: 'linear-gradient(180deg, rgba(26,27,29,0.92), rgba(15,16,17,0.92))',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 24,
      padding: pad,
      boxShadow: '0 50px 120px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
      ...style,
    }}
  >
    {children}
  </div>
)

export const Logo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 26 * size }}>
    <Img src={staticFile('brand/icon.png')} style={{ width: 112 * size, height: 112 * size, filter: 'drop-shadow(0 0 36px rgba(0,212,170,0.5))' }} />
    <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 104 * size, letterSpacing: -4.5 * size, color: M.ink }}>ClipVault</div>
  </div>
)
