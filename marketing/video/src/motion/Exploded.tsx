import React from 'react'
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { Center, Grain, Logo, M, MeshBg, SANS, Vignette, Words, expoOut, inOut, tw } from './kit'
import { LAYOUTS, Rect } from '../data'

// ~24 s exploded-view showcase, 60 fps, 1920x1080.
export const EXPLODED_FRAMES = 1440
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

type Layer = { rect: Rect; z: number; delay?: number; label?: string; labelAt?: 'top' | 'bottom' | 'left' | 'right'; hot?: boolean }
type Cam = { at: number; rx: number; ry: number; rz: number; s: number; x?: number; y?: number }

const sampleCam = (keys: Cam[], f: number) => {
  let a = keys[0]
  for (const k of keys) if (k.at <= f) a = k
  const b = keys.find(k => k.at > f) ?? a
  if (a === b) return a
  const t = inOut((f - a.at) / (b.at - a.at))
  const lerp = (p: number, q: number) => p + (q - p) * t
  return { at: f, rx: lerp(a.rx, b.rx), ry: lerp(a.ry, b.ry), rz: lerp(a.rz, b.rz), s: lerp(a.s, b.s), x: lerp(a.x ?? 0, b.x ?? 0), y: lerp(a.y ?? 0, b.y ?? 0) }
}

const Stack3D: React.FC<{ shot: string; layers: Layer[]; cam: Cam[]; explodeAt: number; collapseAt: number; width: number; labelsAt: number; labelsOut: number }> = ({
  shot,
  layers,
  cam,
  explodeAt,
  collapseAt,
  width,
  labelsAt,
  labelsOut,
}) => {
  const f = useCurrentFrame()
  const L = LAYOUTS.wide
  const sc = width / L.width
  const c = sampleCam(cam, f)
  const baseDim = tw(f, [explodeAt, explodeAt + 60], [0, 0.55]) * (1 - tw(f, [collapseAt, collapseAt + 40], [0, 1], inOut))
  return (
    <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: '50% 40%' }}>
      <div
        style={{
          position: 'absolute',
          left: 960 - width / 2 + (c.x ?? 0),
          top: 540 - (L.height * sc) / 2 + (c.y ?? 0),
          width,
          height: L.height * sc,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg) scale(${c.s})`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 80px 200px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.1)' }}>
          <Img src={staticFile(`shots/wide/${shot}.png`)} style={{ width: '100%', height: '100%' }} />
          <div style={{ position: 'absolute', inset: 0, background: `rgba(5,6,7,${baseDim})` }} />
        </div>
        {layers.map((l, i) => {
          const lift = tw(f, [explodeAt + (l.delay ?? i * 6), explodeAt + (l.delay ?? i * 6) + 70], [0, 1]) * (1 - tw(f, [collapseAt, collapseAt + 36], [0, 1], inOut))
          const z = l.z * lift
          const r = l.rect
          const labelO = tw(f, [labelsAt + i * 5, labelsAt + i * 5 + 16], [0, 1]) * (1 - tw(f, [labelsOut, labelsOut + 12], [0, 1]))
          const side = l.labelAt ?? 'top'
          const labelStyle: React.CSSProperties =
            side === 'top'
              ? { left: '50%', bottom: '100%', transform: 'translate(-50%, -18px)' }
              : side === 'bottom'
                ? { left: '50%', top: '100%', transform: 'translate(-50%, 18px)' }
                : side === 'left'
                  ? { right: '100%', top: '50%', transform: 'translate(-22px, -50%)' }
                  : { left: '100%', top: '50%', transform: 'translate(22px, -50%)' }
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: r.x * sc,
                top: r.y * sc,
                width: r.w * sc,
                height: r.h * sc,
                transform: `translateZ(${z}px)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: lift > 0.01 ? `0 ${30 * lift}px ${70 * lift}px rgba(0,0,0,${0.55 * lift}), 0 0 0 1px rgba(${l.hot ? '0,212,170' : '255,255,255'},${(l.hot ? 0.8 : 0.16) * lift})` : 'none',
                }}
              >
                <Img
                  src={staticFile(`shots/wide/${shot}.png`)}
                  style={{ position: 'absolute', left: -r.x * sc, top: -r.y * sc, width: L.width * sc, height: L.height * sc, maxWidth: 'none' }}
                />
              </div>
              {l.label && labelO > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    ...labelStyle,
                    opacity: labelO,
                    whiteSpace: 'nowrap',
                    padding: '10px 18px',
                    borderRadius: 999,
                    background: l.hot ? M.teal : 'rgba(245,247,247,0.95)',
                    color: '#061210',
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: 24,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
                  }}
                >
                  {l.label}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

const Headline: React.FC<{ title: string; sub: string; at: number; out: number }> = ({ title, sub, at, out }) => {
  const f = useCurrentFrame()
  const o = tw(f, [at + 16, at + 36], [0, 1]) * (1 - tw(f, [out, out + 14], [0, 1]))
  return (
    <div style={{ position: 'absolute', left: 110, bottom: 90, maxWidth: 1100 }}>
      <Words text={title} at={at} out={out} size={78} align="left" />
      <div style={{ marginTop: 14, fontFamily: SANS, fontSize: 28, color: M.dim, opacity: o }}>{sub}</div>
    </div>
  )
}

const Library: React.FC = () => {
  const row2 = 592
  const card = (x: number, y: number): Rect => ({ x, y, w: 374, h: 383 })
  return (
    <>
      <Stack3D
        shot="03-library-new-clip"
        width={1360}
        explodeAt={70}
        collapseAt={400}
        labelsAt={190}
        labelsOut={380}
        cam={[
          { at: 0, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
          { at: 30, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
          { at: 170, rx: 34, ry: -22, rz: 9, s: 0.78, x: 40, y: -40 },
          { at: 390, rx: 30, ry: -12, rz: 6, s: 0.8, x: 30, y: -40 },
          { at: 450, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
        ]}
        layers={[
          { rect: { x: 0, y: 0, w: 1600, h: 56 }, z: 40 },
          { rect: { x: 0, y: 56, w: 1600, h: 64 }, z: 70 },
          { rect: { x: 0, y: 120, w: 1600, h: 50 }, z: 110, label: 'Filter by game, tag or favorite', labelAt: 'top' },
          { rect: card(24, 192), z: 260, hot: true, label: 'Just saved', labelAt: 'bottom' },
          { rect: card(414, 192), z: 170 },
          { rect: card(804, 192), z: 170, label: 'Hover to preview', labelAt: 'bottom' },
          { rect: card(1194, 192), z: 170 },
          { rect: card(24, row2), z: 110 },
          { rect: card(414, row2), z: 110 },
          { rect: card(804, row2), z: 110 },
          { rect: card(1194, row2), z: 110 },
        ]}
      />
      <Headline title="Every clip in *one library.*" sub="Thumbnails, hover preview, filters by game, tag and favorite." at={40} out={392} />
    </>
  )
}

const Editor: React.FC = () => (
  <>
    <Stack3D
      shot="10-editor-trimmed"
      width={1360}
      explodeAt={50}
      collapseAt={390}
      labelsAt={160}
      labelsOut={372}
      cam={[
        { at: 0, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
        { at: 20, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
        { at: 150, rx: 30, ry: 22, rz: -8, s: 0.8, x: -30, y: -40 },
        { at: 380, rx: 26, ry: 11, rz: -5, s: 0.82, x: -20, y: -40 },
        { at: 440, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
      ]}
      layers={[
        { rect: { x: 0, y: 0, w: 1600, h: 56 }, z: 40, label: 'Tags, game and favorite', labelAt: 'top' },
        { rect: { x: 46, y: 80, w: 1188, h: 668 }, z: 150 },
        { rect: { x: 24, y: 764, w: 1232, h: 142 }, z: 230, hot: true, label: 'Trim to the moment', labelAt: 'left' },
        { rect: { x: 24, y: 920, w: 1232, h: 56 }, z: 90 },
        { rect: { x: 1304, y: 76, w: 272, h: 190 }, z: 260, hot: true, label: 'Game and mic, separate tracks', labelAt: 'top' },
        { rect: { x: 1304, y: 608, w: 272, h: 370 }, z: 200, label: 'Up to 10 MB · H.264 or AV1', labelAt: 'left' },
      ]}
    />
    <Headline title="Trim, mute, *export.*" sub="Separate game and mic tracks. Export under 10 MB for Discord." at={30} out={384} />
  </>
)

const Settings: React.FC = () => {
  const row = (y: number, h: number): Rect => ({ x: 373, y, w: 846, h })
  return (
    <>
      <Stack3D
        shot="18-settings-capture"
        width={1360}
        explodeAt={50}
        collapseAt={360}
        labelsAt={150}
        labelsOut={344}
        cam={[
          { at: 0, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
          { at: 20, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
          { at: 150, rx: 36, ry: -18, rz: 11, s: 0.84, x: 30, y: -30 },
          { at: 350, rx: 30, ry: -8, rz: 7, s: 0.86, x: 20, y: -30 },
          { at: 400, rx: 0, ry: 0, rz: 0, s: 0.9, y: -40 },
        ]}
        layers={[
          { rect: { x: 0, y: 0, w: 1600, h: 56 }, z: 30 },
          { rect: row(150, 60), z: 260, hot: true, label: 'Monitor capture by default', labelAt: 'right' },
          { rect: row(258, 76), z: 200, label: 'Pick any monitor', labelAt: 'left' },
          { rect: row(380, 44), z: 160, label: 'DXGI or Windows Graphics Capture', labelAt: 'right' },
          { rect: row(548, 112), z: 130, label: '30 to 144 fps', labelAt: 'left' },
          { rect: row(692, 120), z: 220, label: 'Quality presets', labelAt: 'right' },
        ]}
      />
      <Headline title="Capture that *stays out of the way.*" sub="No game hooks or injection. NVENC or x264. Runs from the tray." at={30} out={352} />
    </>
  )
}

const Finale: React.FC = () => {
  const f = useCurrentFrame()
  const shots = ['03-library-new-clip', '10-editor-trimmed', '18-settings-capture']
  const logo = spring({ frame: f - 70, fps: 60, config: { damping: 18, stiffness: 110 } })
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ perspective: 2400 }}>
        {shots.map((s, i) => {
          const t = spring({ frame: f - i * 8, fps: 60, config: { damping: 20, stiffness: 70 } })
          const spread = (i - 1) * 520
          const dim = tw(f, [60, 100], [0, 0.55])
          return (
            <div
              key={s}
              style={{
                position: 'absolute',
                left: 960 - 520 + spread * t,
                top: 540 - 325,
                width: 1040,
                height: 650,
                borderRadius: 14,
                overflow: 'hidden',
                transform: `rotateY(${-(i - 1) * 28 * t}deg) translateZ(${-Math.abs(i - 1) * 260 * t - 120 * t}px) rotateX(${8 * t}deg)`,
                boxShadow: '0 60px 160px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              <Img src={staticFile(`shots/wide/${s}.png`)} style={{ width: '100%', height: '100%' }} />
              <div style={{ position: 'absolute', inset: 0, background: `rgba(5,6,7,${dim})` }} />
            </div>
          )
        })}
      </AbsoluteFill>
      <Center>
        <div style={{ opacity: logo, transform: `translateY(${(1 - logo) * 30}px)` }}>
          <Logo size={1.1} />
        </div>
        <div style={{ height: 28 }} />
        <Words text="Clutch now. *Clip later.*" at={86} size={60} weight={700} />
        <div style={{ marginTop: 22, fontFamily: SANS, fontSize: 26, color: M.dim, opacity: tw(f, [110, 130], [0, 1]) }}>Free and open source for Windows 10 and 11</div>
      </Center>
    </AbsoluteFill>
  )
}

export const Exploded: React.FC = () => {
  const f = useCurrentFrame()
  const scenes: [number, number, React.FC][] = [
    [0, 460, Library],
    [440, 460, Editor],
    [880, 420, Settings],
    [1280, 160, Finale],
  ]
  return (
    <AbsoluteFill style={{ background: M.bg }}>
      <MeshBg intensity={0.9} hue="mix" seed="exploded" />
      {scenes.map(([from, dur, C], i) => (
        <Sequence key={i} from={from} durationInFrames={dur}>
          <AbsoluteFill style={{ opacity: interpolate(f - from, [0, 16, dur - 20, dur], [0, 1, 1, i === scenes.length - 1 ? 1 : 0], CL) }}>
            <C />
          </AbsoluteFill>
        </Sequence>
      ))}
      <Vignette strength={0.5} />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  )
}
export { expoOut }
