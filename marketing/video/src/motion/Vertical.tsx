import React from 'react'
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { Center, Flash, Glass, Grain, Logo, M, MeshBg, SANS, Shockwave, Vignette, Words, inOut, tw, useShake, backOut } from './kit'
import { AudioTracks, CLIPS, ClipCard, ExportButton, Icon, KeyBig, SizeMenu, Toast, TrimBar, Waveform } from './ui'

// ~20 s vertical cut for social (1080x1920, 60 fps).
export const VERTICAL_FRAMES = 1200
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const SEG0 = 38

const Top: React.FC<{ children: React.ReactNode; y?: number }> = ({ children, y = 170 }) => (
  <AbsoluteFill style={{ alignItems: 'center', paddingTop: y, paddingLeft: 60, paddingRight: 60 }}>{children}</AbsoluteFill>
)

const Hook: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${tw(f, [0, 180], [1.15, 1.02], inOut)})` }}>
        <OffthreadVideo src={staticFile('media/game-won.mp4')} trimBefore={Math.round((41.6 - SEG0) * 60)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '46% 50%' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.8) 100%)' }} />
      <Top>
        <Words text="You just hit *the shot.*" at={6} out={84} size={118} />
      </Top>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 240 }}>
        <Words text="ClipVault *was recording.*" at={96} size={92} mode="blur" maxWidth={960} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Smash: React.FC = () => {
  const f = useCurrentFrame()
  const press = 44
  const shake = useShake(press + 2, 26, 26)
  const drop = spring({ frame: f - 4, fps: 60, config: { damping: 13, stiffness: 120 } })
  const toast = spring({ frame: f - (press + 14), fps: 60, config: { damping: 18, stiffness: 150 } })
  return (
    <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}>
      <Img src={staticFile('frames/valorant-won.webp')} style={{ position: 'absolute', inset: -60, width: 'calc(100% + 120px)', height: 'calc(100% + 120px)', objectFit: 'cover', filter: `blur(${tw(f, [0, 30], [0, 16])}px) brightness(0.55)` }} />
      <Shockwave at={press + 1} x={540} y={900} max={1600} />
      <Top>
        <Words text="Hit *your hotkey.*" at={6} out={146} size={120} />
      </Top>
      <Center style={{ paddingBottom: 120 }}>
        <div style={{ transform: `translateY(${(1 - drop) * -900}px) rotate(${(1 - drop) * -8}deg)` }}>
          <KeyBig size={420} press={press} />
        </div>
      </Center>
      <div style={{ position: 'absolute', left: 60, bottom: 220, transform: `translateY(${(1 - toast) * 700}px)` }}>
        <Toast w={960} />
      </div>
      <Flash at={press + 1} peak={0.35} color="#bffff0" />
    </AbsoluteFill>
  )
}

const Library: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill>
      <MeshBg hue="teal" intensity={1.2} />
      <Top>
        <Words text="Saved to your *library.*" at={8} out={196} size={104} />
      </Top>
      <AbsoluteFill style={{ perspective: 2000 }}>
        <div style={{ position: 'absolute', left: 0, top: 520, width: 1080, transformStyle: 'preserve-3d', transform: `rotateX(${tw(f, [0, 200], [22, 12], inOut)}deg) rotateZ(-4deg) translateY(${tw(f, [0, 210], [40, -80], inOut)}px)` }}>
          {CLIPS.slice(0, 6).map((c, i) => {
            const s = spring({ frame: f - 10 - i * 7, fps: 60, config: { damping: 18, stiffness: 120 } })
            const col = i % 2
            const row = Math.floor(i / 2)
            return (
              <div key={c.id} style={{ position: 'absolute', left: 50 + col * 500, top: row * 520 + (1 - s) * 500, opacity: s }}>
                <ClipCard clip={c} w={480} glow={i === 0 ? 1 : 0} />
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Trim: React.FC = () => {
  const f = useCurrentFrame()
  const dur = 122.03
  const start = tw(f, [20, 80], [0, 38.38])
  const end = tw(f, [45, 105], [dur, 64.18])
  const playStart = 115
  const playhead = f < 80 ? start : f < playStart ? 38.38 : 38.38 + (f - playStart) / 60
  const inS = spring({ frame: f, fps: 60, config: { damping: 20, stiffness: 110 } })
  return (
    <AbsoluteFill>
      <MeshBg hue="mix" />
      <Top>
        <Words text="Trim to *the moment.*" at={6} out={206} size={104} />
      </Top>
      <div style={{ position: 'absolute', left: 60, top: 640, width: 960, height: 540, borderRadius: 20, overflow: 'hidden', boxShadow: '0 50px 140px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)', opacity: inS, transform: `scale(${0.94 + 0.06 * inS})` }}>
        <Sequence from={0} durationInFrames={playStart} layout="none">
          <Freeze frame={Math.round((38.38 - SEG0) * 60)}>
            <OffthreadVideo src={staticFile('media/game-won.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Freeze>
        </Sequence>
        <Sequence from={playStart} layout="none">
          <OffthreadVideo src={staticFile('media/game-won.mp4')} trimBefore={Math.round((38.38 - SEG0) * 60)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Sequence>
      </div>
      <div style={{ position: 'absolute', left: 60, top: 1260, opacity: inS }}>
        <TrimBar w={960} dur={dur} start={start} end={end} playhead={playhead} scale={1.5} />
      </div>
    </AbsoluteFill>
  )
}

const Audio: React.FC = () => {
  const f = useCurrentFrame()
  const micOn = 1 - tw(f, [70, 78], [0, 1], inOut)
  const inS = spring({ frame: f - 4, fps: 60, config: { damping: 20, stiffness: 120 } })
  return (
    <AbsoluteFill>
      <MeshBg hue="violet" />
      <Top>
        <Words text="Mute the mic. *Keep the game.*" at={6} out={156} size={100} />
      </Top>
      <div style={{ position: 'absolute', left: 90, top: 660, opacity: inS, transform: `translateY(${(1 - inS) * 60}px)` }}>
        <Glass pad={46}>
          <AudioTracks w={808} micOn={micOn} desktopVol={0.86} micVol={0.72} />
        </Glass>
      </div>
      <div style={{ position: 'absolute', left: 90, top: 1330, opacity: inS, fontFamily: SANS }}>
        {[
          { label: 'GAME', color: M.teal, level: 1, seed: 1 },
          { label: 'MIC', color: micOn > 0.5 ? M.violet : '#3b3b3f', level: 0.1 + 0.9 * micOn, seed: 7 },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
            <div style={{ width: 90, fontWeight: 800, fontSize: 30, letterSpacing: 2, color: l.color }}>{l.label}</div>
            <Waveform w={780} h={110} color={l.color} seed={l.seed} level={l.level} bars={44} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

const Export: React.FC = () => {
  const f = useCurrentFrame()
  const menuIn = spring({ frame: f - 6, fps: 60, config: { damping: 18, stiffness: 140 } })
  const sel = tw(f, [30, 44], [0, 1], backOut)
  const menuOut = tw(f, [60, 72], [0, 1], inOut)
  const click = 78
  const state: 0 | 1 | 2 = f < click + 2 ? 0 : f < click + 40 ? 1 : 2
  const chip = spring({ frame: f - (click + 50), fps: 60, config: { damping: 16, stiffness: 120 } })
  return (
    <AbsoluteFill>
      <MeshBg hue="teal" />
      <Top>
        <Words text="Under *10 MB.* Ready for Discord." at={6} out={140} size={100} />
      </Top>
      <div style={{ position: 'absolute', left: 220, top: 600, opacity: menuIn * (1 - menuOut), transform: `scale(${0.9 + 0.1 * menuIn})` }}>
        <SizeMenu w={640} sel={sel} />
      </div>
      <div style={{ position: 'absolute', left: 115, top: 1120 }}>
        <ExportButton w={850} state={state} press={interpolate(f, [click - 2, click + 2, click + 8], [0, 1, 0], CL)} />
      </div>
      <div style={{ position: 'absolute', left: 90, top: 1330, width: 900, opacity: chip, transform: `translateY(${(1 - chip) * 80}px)`, display: 'flex', alignItems: 'center', gap: 20, padding: '24px 28px', borderRadius: 20, background: 'rgba(22,24,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: SANS, color: M.ink }}>
        <Icon name="file" size={44} color={M.teal} />
        <div style={{ flex: 1, fontSize: 25, fontWeight: 600, fontFamily: 'Consolas, monospace' }}>2026-09-28_23-30-00_VALORANT.mp4</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#04130f', background: M.teal, padding: '8px 16px', borderRadius: 999 }}>≤ 10 MB</div>
      </div>
    </AbsoluteFill>
  )
}

const Outro: React.FC = () => {
  const f = useCurrentFrame()
  const s = spring({ frame: f - 4, fps: 60, config: { damping: 16, stiffness: 110 } })
  return (
    <AbsoluteFill>
      <MeshBg hue="teal" intensity={1.4} />
      <Center>
        <div style={{ transform: `scale(${0.82 + 0.1 * s})`, opacity: s }}>
          <Logo size={0.95} />
        </div>
        <div style={{ height: 40 }} />
        <Words text="Clutch now." at={18} size={120} />
        <Words text="*Clip later.*" at={30} size={120} />
        <div style={{ marginTop: 40, fontFamily: SANS, fontSize: 36, color: M.dim, textAlign: 'center', lineHeight: 1.45, opacity: tw(f, [44, 64], [0, 1]) }}>
          Free and open source
          <br />
          Windows 10 and 11
        </div>
      </Center>
    </AbsoluteFill>
  )
}

const SCENES: [number, number, React.FC][] = [
  [0, 180, Hook],
  [170, 170, Smash],
  [330, 220, Library],
  [540, 230, Trim],
  [760, 180, Audio],
  [930, 160, Export],
  [1080, 120, Outro],
]

export const Vertical: React.FC = () => (
  <AbsoluteFill style={{ background: M.bg }}>
    {SCENES.map(([from, dur, C], i) => (
      <Sequence key={i} from={from} durationInFrames={dur}>
        <SceneIn dur={dur} first={i === 0} last={i === SCENES.length - 1}>
          <C />
        </SceneIn>
      </Sequence>
    ))}
    <Vignette strength={0.4} />
    <Grain opacity={0.06} />
  </AbsoluteFill>
)

const SceneIn: React.FC<{ dur: number; first: boolean; last: boolean; children: React.ReactNode }> = ({ dur, first, last, children }) => {
  const f = useCurrentFrame()
  const o = interpolate(f, [0, first ? 1 : 10, dur - (last ? 1 : 10), dur], [0, 1, 1, last ? 1 : 0], CL)
  const inT = first ? 0 : tw(f, [0, 16], [1, 0])
  const outT = last ? 0 : tw(f, [dur - 14, dur], [0, 1], inOut)
  const blur = 12 * inT + 10 * outT
  return <AbsoluteFill style={{ opacity: o, transform: `scale(${1 + 0.05 * inT - 0.03 * outT})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>
}
