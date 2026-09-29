import React from 'react'
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, STAGE } from '../theme'
import { SAVED_PATH } from '../data'
import { HotkeyLegend } from '../motion/ui'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 90) * 60
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 700px at ${960 + drift}px 1150px, rgba(0,212,170,0.16), transparent 70%), radial-gradient(900px 600px at ${200 - drift}px -100px, rgba(0,212,170,0.07), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at 50% 60%, black 20%, transparent 75%)',
        }}
      />
    </AbsoluteFill>
  )
}

// Full-bleed gameplay; optionally shrinks into a screen rect (the new clip's card).
export const Gameplay: React.FC<{
  src: string
  trimBefore: number
  shrink?: { from: number; to: number; rect: { x: number; y: number; w: number; h: number } }
  fadeIn?: number
  fadeOut?: [number, number]
  zoom?: [number, number]
  len?: number
  blur?: number
}> = ({ src, trimBefore, shrink, fadeIn, fadeOut, zoom = [1.04, 1.0], len = 150, blur = 0 }) => {
  const frame = useCurrentFrame()
  let x = 0
  let y = 0
  let w = STAGE.width
  let h = STAGE.height
  let radius = 0
  if (shrink) {
    const t = Easing.bezier(0.7, 0, 0.3, 1)(interpolate(frame, [shrink.from, shrink.to], [0, 1], clamp))
    x = interpolate(t, [0, 1], [0, shrink.rect.x])
    y = interpolate(t, [0, 1], [0, shrink.rect.y])
    w = interpolate(t, [0, 1], [STAGE.width, shrink.rect.w])
    h = interpolate(t, [0, 1], [STAGE.height, shrink.rect.h])
    radius = t * 10
  }
  const s = interpolate(frame, [0, len], zoom, clamp)
  let opacity = fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], clamp) : 1
  if (fadeOut) opacity *= interpolate(frame, fadeOut, [1, 0], clamp)
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', borderRadius: radius, opacity }}>
      <OffthreadVideo
        src={staticFile(`media/${src}`)}
        trimBefore={trimBefore}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`, filter: blur ? `blur(${blur}px) brightness(0.55)` : undefined }}
      />
      {!shrink && (
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />
      )}
    </div>
  )
}

export const KeyCap: React.FC<{ appear: number; press: number; label?: React.ReactNode; y?: number; x?: number }> = ({ appear, press, label, x = 960, y = 830 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const inS = spring({ frame: frame - appear, fps, config: { damping: 14, stiffness: 160 } })
  const out = interpolate(frame, [press + 26, press + 36], [1, 0], clamp)
  const down = interpolate(frame, [press - 2, press + 2, press + 10, press + 16], [0, 1, 1, 0], clamp)
  const glow = interpolate(frame, [press, press + 4, press + 30], [0, 1, 0.3], clamp)
  if (frame < appear) return null
  const size = 168
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: `scale(${inS}) translateY(${down * 12}px)`,
        opacity: out,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 30,
          background: 'linear-gradient(180deg, #2a2d31, #16181b)',
          boxShadow: `0 ${22 - down * 14}px 0 #0a0b0c, 0 ${36 - down * 20}px 60px rgba(0,0,0,0.6), 0 0 ${80 * glow}px rgba(0,212,170,${0.8 * glow})`,
          border: `2px solid rgba(255,255,255,${0.1 + glow * 0.3})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 14,
          borderRadius: 20,
          background: 'linear-gradient(180deg, #34383d, #1f2226)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 62,
          letterSpacing: -1,
          color: glow > 0.2 ? C.accent : C.text,
          textShadow: glow > 0.2 ? '0 0 24px rgba(0,212,170,0.8)' : 'none',
        }}
      >
        {label ?? <HotkeyLegend s={1.05} lit={glow > 0.2} />}
      </div>
    </div>
  )
}

// Windows notification shown by the backend when a clip is saved.
export const SaveToast: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (frame < from || frame > to) return null
  const inS = spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 140 } })
  const out = interpolate(frame, [to - 10, to], [1, 0], clamp)
  return (
    <div
      style={{
        position: 'absolute',
        right: 36,
        bottom: 36,
        width: 520,
        transform: `translateX(${(1 - inS) * 580}px)`,
        opacity: out,
        background: 'rgba(32,32,32,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '18px 22px 20px',
        fontFamily: '"Segoe UI Variable Text", "Segoe UI", ' + FONT,
        color: '#fff',
        boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, color: 'rgba(255,255,255,0.8)' }}>
        <Img src={staticFile('brand/icon.png')} style={{ width: 22, height: 22, borderRadius: 5 }} />
        ClipVault
      </div>
      <div style={{ marginTop: 12, fontSize: 22, fontWeight: 600 }}>Clip Saved</div>
      <div style={{ marginTop: 4, fontSize: 17, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35, wordBreak: 'break-all' }}>
        Saved to: {SAVED_PATH}
      </div>
    </div>
  )
}

// Captions sit at the top by default; use pos="bottom" when the camera shows the top of the window.
export const Caption: React.FC<{
  from: number
  to: number
  title: string
  sub?: string
  x?: number
  y?: number
  align?: 'left' | 'center'
  pos?: 'top' | 'bottom'
}> = ({ from, to, title, sub, x = 150, y = 58, align = 'left', pos = 'top' }) => {
  const frame = useCurrentFrame()
  if (frame < from - 1 || frame > to) return null
  const o = interpolate(frame, [from, from + 10, to - 8, to], [0, 1, 1, 0], clamp)
  const lift = interpolate(frame, [from, from + 14], [18, 0], { ...clamp, easing: Easing.out(Easing.cubic) })
  const bottom = pos === 'bottom'
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          ...(bottom ? { bottom: 0 } : { top: 0 }),
          height: y + 190,
          opacity: o,
          background: `linear-gradient(${bottom ? '0deg' : '180deg'}, rgba(8,9,10,0.9) 0%, rgba(8,9,10,0.72) 55%, rgba(8,9,10,0) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: align === 'center' ? 0 : x,
          right: align === 'center' ? 0 : undefined,
          ...(bottom ? { bottom: y } : { top: y }),
          textAlign: align,
          opacity: o,
          transform: `translateY(${bottom ? -lift : lift}px)`,
          fontFamily: FONT,
          textShadow: '0 2px 24px rgba(0,0,0,0.65)',
        }}
      >
        <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: -1.2, color: C.text, lineHeight: 1.08 }}>{title}</div>
        {sub && <div style={{ marginTop: 8, fontSize: 26, fontWeight: 500, color: C.muted }}>{sub}</div>}
      </div>
    </>
  )
}

export const Brand: React.FC<{ from: number; size?: number; tagline?: string; sub?: string; to?: number }> = ({ from, size = 1, tagline, sub, to }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - from, fps, config: { damping: 16, stiffness: 120 } })
  const out = to ? interpolate(frame, [to - 10, to], [1, 0], clamp) : 1
  const t2 = interpolate(frame, [from + 10, from + 24], [0, 1], clamp)
  const t3 = interpolate(frame, [from + 18, from + 32], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FONT, opacity: out }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 * size, transform: `scale(${0.9 + 0.1 * s})`, opacity: s }}>
        <Img src={staticFile('brand/icon.png')} style={{ width: 128 * size, height: 128 * size, filter: 'drop-shadow(0 0 40px rgba(0,212,170,0.45))' }} />
        <div style={{ fontSize: 118 * size, fontWeight: 800, letterSpacing: -4 * size, color: C.text }}>ClipVault</div>
      </div>
      {tagline && (
        <div style={{ marginTop: 34 * size, fontSize: 52 * size, fontWeight: 700, color: C.text, opacity: t2, letterSpacing: -1 }}>
          {tagline}
        </div>
      )}
      {sub && <div style={{ marginTop: 16 * size, fontSize: 30 * size, fontWeight: 500, color: C.muted, opacity: t3 }}>{sub}</div>}
    </AbsoluteFill>
  )
}
