import React from 'react'
import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { C, FONT, STAGE } from '../theme'
import { LAYOUTS, Layout, Rect } from '../data'
import { Pointer } from './Pointer'

// Keyframes arrive at `at`, moving for `dur` frames before it (hold otherwise).
export type ShotKey = { name: string; at: number; fade?: number }
export type CamKey = { at: number; x: number; y: number; z: number; dur?: number }
export type PtrKey = { at: number; x: number; y: number; dur?: number; click?: boolean; hide?: boolean }
export type Spot = { from: number; to: number; rect: Rect; radius?: number; dim?: number }
export type Label = { from: number; to: number; rect: Rect; text: string; side?: 'top' | 'bottom' | 'left' | 'right' }
export type VideoOverlay = { from: number; to: number; rect: Rect; src: string; trimBefore: number }

export type AppSceneProps = {
  layout: Layout
  shots: ShotKey[]
  cam?: CamKey[]
  ptr?: PtrKey[]
  spots?: Spot[]
  labels?: Label[]
  videos?: VideoOverlay[]
  fit?: number
  offsetY?: number
  opacity?: number
  windowScale?: number
}

const ease = Easing.bezier(0.65, 0, 0.35, 1)

type Pose = { x: number; y: number; z: number }
function sample<T extends { at: number; dur?: number }>(keys: T[], frame: number, get: (k: T) => number[], defDur: number) {
  if (!keys.length) return null
  let prev = get(keys[0])
  if (frame <= keys[0].at) return prev
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]
    const dur = k.dur ?? defDur
    const start = k.at - dur
    if (frame < start) return prev
    if (frame < k.at) {
      const t = ease((frame - start) / dur)
      const next = get(k)
      return prev.map((v, j) => v + (next[j] - v) * t)
    }
    prev = get(k)
  }
  return prev
}

export const useStageMap = (layout: Layout, cam: CamKey[] | undefined, fit = 0.86, offsetY = 0, windowScale = 1) => {
  const frame = useCurrentFrame()
  const L = LAYOUTS[layout]
  const s0 = Math.min((STAGE.width * fit) / L.width, (STAGE.height * fit) / L.height) * windowScale
  const pose = (sample(cam ?? [], frame, k => [k.x, k.y, k.z], 24) ?? [L.width / 2, L.height / 2, 1]) as number[]
  const z = pose[2]
  const scale = s0 * z
  // The caption offset fades out as the window grows to fill the stage height.
  const baseH = L.height * s0
  const offsetK = baseH >= STAGE.height ? 0 : Math.max(0, Math.min(1, (STAGE.height - L.height * scale) / (STAGE.height - baseH)))
  const ox = STAGE.width / 2
  const oy = STAGE.height / 2 + offsetY * offsetK
  // Keep a small window fully on stage, and a zoomed window covering the stage.
  const clampAxis = (c: number, size: number, o: number, stage: number) => {
    const a = o / scale
    const b = size - (stage - o) / scale
    return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c))
  }
  const cx = clampAxis(pose[0], L.width, ox, STAGE.width)
  const cy = clampAxis(pose[1], L.height, oy, STAGE.height)
  const toScreen = (x: number, y: number) => ({ x: ox + (x - cx) * scale, y: oy + (y - cy) * scale })
  const rectToScreen = (r: Rect) => {
    const p = toScreen(r.x, r.y)
    return { x: p.x, y: p.y, w: r.w * scale, h: r.h * scale }
  }
  return { L, scale, z, toScreen, rectToScreen }
}

// Stage rect of an app rect for a fixed camera pose (for transitions outside AppScene).
export const stageRect = (layout: Layout, r: Rect, pose?: { x: number; y: number; z: number }, fit = 0.86, offsetY = 0, windowScale = 1) => {
  const L = LAYOUTS[layout]
  const s0 = Math.min((STAGE.width * fit) / L.width, (STAGE.height * fit) / L.height) * windowScale
  const p = pose ?? { x: L.width / 2, y: L.height / 2, z: 1 }
  const scale = s0 * p.z
  return {
    x: STAGE.width / 2 + (r.x - p.x) * scale,
    y: STAGE.height / 2 + offsetY + (r.y - p.y) * scale,
    w: r.w * scale,
    h: r.h * scale,
  }
}

const CaptionButtons: React.FC<{ width: number }> = ({ width }) => (
  <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${width} 56`} preserveAspectRatio="xMaxYMin meet">
    <g stroke="#ffffff" strokeOpacity={0.88} strokeWidth={1} fill="none" shapeRendering="crispEdges">
      <line x1={width - 120} y1={28.5} x2={width - 110} y2={28.5} />
      <rect x={width - 74.5} y={23.5} width={10} height={10} />
      <line x1={width - 28} y1={23} x2={width - 18} y2={33} />
      <line x1={width - 18} y1={23} x2={width - 28} y2={33} />
    </g>
  </svg>
)

export const AppScene: React.FC<AppSceneProps> = ({
  layout,
  shots,
  cam,
  ptr,
  spots = [],
  labels = [],
  videos = [],
  fit = 0.86,
  offsetY = 0,
  opacity = 1,
  windowScale = 1,
}) => {
  const frame = useCurrentFrame()
  const { L, scale, z, toScreen, rectToScreen } = useStageMap(layout, cam, fit, offsetY, windowScale)
  const origin = toScreen(0, 0)
  const W = L.width * scale
  const H = L.height * scale

  // Only keep shots that are not yet fully covered by a later one.
  const visible = shots.filter((s, i) => {
    if (frame < s.at) return false
    const next = shots.slice(i + 1).find(n => frame >= n.at + (n.fade ?? 10))
    return !next
  })

  const ptrPose = ptr?.length ? sample(ptr, frame, k => [k.x, k.y], 18) : null
  const lastPtr = ptr?.filter(k => k.at <= frame).pop()
  const clicks = (ptr ?? []).filter(k => k.click).map(k => k.at)
  const ptrHidden = (ptr ?? []).length === 0 || (lastPtr?.hide ?? frame < (ptr?.[0]?.at ?? 0) - 20)

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: 'absolute',
          left: origin.x,
          top: origin.y,
          width: W,
          height: H,
          borderRadius: 14 * z,
          overflow: 'hidden',
          background: '#0f0f0f',
          boxShadow: '0 50px 140px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.09)',
        }}
      >
        {visible.map(s => (
          <Img
            key={s.name + s.at}
            src={staticFile(`shots/${layout}/${s.name}.png`)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: interpolate(frame, [s.at, s.at + (s.fade ?? 10)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          />
        ))}
        {videos.map((v, i) => (
          <Sequence key={i} from={v.from} durationInFrames={v.to - v.from} layout="none">
            <div
              style={{
                position: 'absolute',
                left: `${(v.rect.x / L.width) * 100}%`,
                top: `${(v.rect.y / L.height) * 100}%`,
                width: `${(v.rect.w / L.width) * 100}%`,
                height: `${(v.rect.h / L.height) * 100}%`,
                opacity: interpolate(frame, [v.from, v.from + 6, v.to - 6, v.to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                background: '#000',
              }}
            >
              <OffthreadVideo src={staticFile(`media/${v.src}`)} trimBefore={v.trimBefore} muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </Sequence>
        ))}
        <CaptionButtons width={L.width} />
      </div>

      {spots.map((s, i) => {
        const o = interpolate(frame, [s.from, s.from + 10, s.to - 10, s.to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        if (o <= 0) return null
        const r = rectToScreen(s.rect)
        const rad = (s.radius ?? 12) * z
        return (
          <svg key={i} style={{ position: 'absolute', inset: 0 }} width={STAGE.width} height={STAGE.height}>
            <path
              fillRule="evenodd"
              fill={`rgba(0,0,0,${(s.dim ?? 0.62) * o})`}
              d={`M0 0H${STAGE.width}V${STAGE.height}H0Z M${r.x + rad} ${r.y}H${r.x + r.w - rad}A${rad} ${rad} 0 0 1 ${r.x + r.w} ${r.y + rad}V${r.y + r.h - rad}A${rad} ${rad} 0 0 1 ${r.x + r.w - rad} ${r.y + r.h}H${r.x + rad}A${rad} ${rad} 0 0 1 ${r.x} ${r.y + r.h - rad}V${r.y + rad}A${rad} ${rad} 0 0 1 ${r.x + rad} ${r.y}Z`}
            />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={rad} fill="none" stroke={C.accent} strokeOpacity={0.9 * o} strokeWidth={2.5} />
          </svg>
        )
      })}

      {labels.map((l, i) => {
        const o = interpolate(frame, [l.from, l.from + 8, l.to - 8, l.to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        if (o <= 0) return null
        const r = rectToScreen(l.rect)
        const side = l.side ?? 'top'
        const lift = (1 - o) * 10
        const style: React.CSSProperties =
          side === 'top'
            ? { left: r.x + r.w / 2, top: r.y - 16 + lift, transform: 'translate(-50%, -100%)' }
            : side === 'bottom'
              ? { left: r.x + r.w / 2, top: r.y + r.h + 16 - lift, transform: 'translate(-50%, 0)' }
              : side === 'left'
                ? { left: r.x - 16, top: r.y + r.h / 2, transform: 'translate(-100%, -50%)' }
                : { left: r.x + r.w + 16, top: r.y + r.h / 2, transform: 'translate(0, -50%)' }
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...style,
              opacity: o,
              padding: '10px 18px',
              borderRadius: 999,
              background: C.accent,
              color: '#04130f',
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 26,
              whiteSpace: 'nowrap',
              boxShadow: '0 12px 40px rgba(0,212,170,0.35)',
            }}
          >
            {l.text}
          </div>
        )
      })}

      {ptrPose && !ptrHidden && (
        <Pointer
          x={toScreen(ptrPose[0], ptrPose[1]).x}
          y={toScreen(ptrPose[0], ptrPose[1]).y}
          clicks={clicks}
          appear={ptr![0].at - 20}
        />
      )}
    </AbsoluteFill>
  )
}
