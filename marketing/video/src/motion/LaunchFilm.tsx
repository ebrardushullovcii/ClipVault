import React from 'react'
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Center, Crop, Flash, Glass, Grain, Logo, M, MeshBg, SANS, Shockwave, Vignette, Words, expoOut, inOut, tw, useShake, backOut } from './kit'
import { AudioTracks, CLIPS, ClipCard, ExportButton, Icon, KeyBig, SizeMenu, Toast, TrimBar, Waveform } from './ui'
import { Pointer } from '../components/Pointer'

// ~35 s launch film, 60 fps, 1920x1080.
export const LAUNCH_FRAMES = 2120
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const SEG0 = 38 // game-won.mp4 starts at 0:38.0 of the clip

const SceneFade: React.FC<{ dur: number; children: React.ReactNode; fin?: number; fout?: number }> = ({ dur, children, fin = 10, fout = 10 }) => {
  const f = useCurrentFrame()
  const o = interpolate(f, [0, fin, dur - fout, dur], [0, 1, 1, 0], CL)
  // Zoom-blur in and out so cuts feel fast.
  const inT = fin > 1 ? tw(f, [0, fin + 6], [1, 0]) : 0
  const outT = fout > 1 ? tw(f, [dur - fout - 4, dur], [0, 1], inOut) : 0
  const scale = 1 + 0.045 * inT - 0.03 * outT
  const blur = 12 * inT + 10 * outT
  return <AbsoluteFill style={{ opacity: o, transform: `scale(${scale})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>
}

const Hook: React.FC = () => (
  <Center>
    <Words text="You just hit *the shot.*" at={10} out={100} size={150} />
  </Center>
)

const Gameplay: React.FC = () => {
  const f = useCurrentFrame()
  const z = tw(f, [0, 220], [1.12, 1.0], inOut)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <OffthreadVideo src={staticFile('media/game-won.mp4')} trimBefore={Math.round((41.3 - SEG0) * 60)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.65) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 110 }}>
        <Words text="Nobody was recording." at={36} out={112} size={96} mode="blur" />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 110 }}>
        <Words text="ClipVault *was.*" at={124} size={112} mode="blur" />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Smash: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const press = 52
  const shake = useShake(press + 2, 26, 26)
  const drop = spring({ frame: f - 6, fps, config: { damping: 13, stiffness: 120 } })
  const toastIn = spring({ frame: f - (press + 14), fps, config: { damping: 18, stiffness: 150 } })
  const blur = tw(f, [0, 40], [0, 14])
  return (
    <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}>
      <Img src={staticFile('frames/valorant-won.webp')} style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', filter: `blur(${blur}px) brightness(${1 - blur / 28})` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 46%, rgba(0,212,170,0.18), transparent 55%)', opacity: tw(f, [press, press + 30], [0, 1]) }} />
      <Shockwave at={press + 1} x={960} y={500} max={1500} />
      <Center style={{ paddingBottom: 80 }}>
        <div style={{ transform: `translateY(${(1 - drop) * -760}px) rotate(${(1 - drop) * -8}deg)` }}>
          <KeyBig size={300} press={press} />
        </div>
      </Center>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 80 }}>
        <Words text="Hit *your hotkey.*" at={10} out={140} size={84} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', right: 70, bottom: 64, transform: `translateX(${(1 - toastIn) * 760}px)` }}>
        <Toast w={640} />
      </div>
      <Flash at={press + 1} peak={0.35} color="#bffff0" />
    </AbsoluteFill>
  )
}

const Library: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  // Phase 1: the saved frame becomes the new clip's card. Phase 2: pull back into the library.
  const shrink = tw(f, [0, 46], [0, 1], inOut)
  const cardW = 560
  const cardH = (cardW * 9) / 16
  const x = interpolate(shrink, [0, 1], [0, 960 - cardW / 2])
  const y = interpolate(shrink, [0, 1], [0, 540 - cardH / 2 - 60])
  const w = interpolate(shrink, [0, 1], [1920, cardW])
  const h = interpolate(shrink, [0, 1], [1080, cardH])
  const cardOn = tw(f, [40, 56], [0, 1])
  const pull = tw(f, [92, 150], [0, 1], inOut)
  const tilt = { rx: 16 * pull, ry: -12 * pull }
  const cardsW = 380
  return (
    <AbsoluteFill>
      <MeshBg hue="teal" intensity={1.2} />
      <AbsoluteFill style={{ perspective: 1800 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1920,
            height: 1080,
            transformStyle: 'preserve-3d',
            transform: `translate(${-230 * pull}px, ${60 * pull}px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${1 - 0.1 * pull})`,
          }}
        >
          {/* Other clips rise in around the new one */}
          {CLIPS.slice(1).map((c, i) => {
            const col = (i + 1) % 4
            const row = Math.floor((i + 1) / 4)
            const s = spring({ frame: f - 100 - i * 4, fps, config: { damping: 18, stiffness: 120 } })
            const gx = 960 - (4 * cardsW + 3 * 28) / 2 + col * (cardsW + 28) + 230
            const gy = 250 + row * 470
            return (
              <div key={c.id} style={{ position: 'absolute', left: gx, top: gy + (1 - s) * 400, opacity: s }}>
                <ClipCard clip={c} w={cardsW} />
              </div>
            )
          })}
          {/* The new clip */}
          <div
            style={{
              position: 'absolute',
              left: interpolate(pull, [0, 1], [960 - cardW / 2, 960 - (4 * cardsW + 3 * 28) / 2 + 230]),
              top: interpolate(pull, [0, 1], [540 - cardH / 2 - 60, 250]),
              opacity: cardOn,
              transform: `scale(${interpolate(pull, [0, 1], [1, cardsW / cardW])})`,
              transformOrigin: 'top left',
            }}
          >
            <ClipCard clip={CLIPS[0]} w={cardW} glow={1 - pull * 0.4} />
          </div>
        </div>
      </AbsoluteFill>
      {/* Flying frame from the previous scene */}
      {cardOn < 1 && (
        <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 12 * shrink, overflow: 'hidden', opacity: 1 - cardOn }}>
          <Img src={staticFile('frames/valorant-won.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: `blur(${14 * (1 - shrink)}px)` }} />
        </div>
      )}
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 64 }}>
        <Words text="Straight to your *library.*" at={30} out={235} size={88} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Trim: React.FC = () => {
  const f = useCurrentFrame()
  const dur = 122.03
  const start = tw(f, [30, 90], [0, 38.38])
  const end = tw(f, [55, 115], [dur, 64.18])
  const playStart = 130
  const playhead = f < 90 ? start : f < playStart ? 38.38 : 38.38 + (f - playStart) / 60
  const panelIn = spring({ frame: f, fps: 60, config: { damping: 20, stiffness: 110 } })
  const trackX = 260
  const trackW = 1400
  const trackY = 862
  const hx = (t: number) => trackX + (t / dur) * trackW
  return (
    <AbsoluteFill>
      <MeshBg hue="mix" />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 58 }}>
        <Words text="Trim to *the moment.*" at={6} out={262} size={84} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 1920 / 2 - 560, top: 200, width: 1120, height: 630, borderRadius: 18, overflow: 'hidden', boxShadow: '0 50px 140px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)', transform: `translateY(${(1 - panelIn) * 60}px) scale(${0.94 + 0.06 * panelIn})`, opacity: panelIn }}>
        <Sequence from={0} durationInFrames={playStart} layout="none">
          <Freeze frame={Math.round((38.38 - SEG0) * 60)}>
            <OffthreadVideo src={staticFile('media/game-won.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Freeze>
        </Sequence>
        <Sequence from={playStart} layout="none">
          <OffthreadVideo src={staticFile('media/game-won.mp4')} trimBefore={Math.round((38.38 - SEG0) * 60)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Sequence>
      </div>
      <div style={{ position: 'absolute', left: trackX, top: trackY - 40, opacity: panelIn }}>
        <TrimBar w={trackW} dur={dur} start={start} end={end} playhead={playhead} scale={1.3} />
      </div>
      <Pointer
        x={f < 60 ? interpolate(f, [8, 30], [700, hx(0)], { ...CL, easing: expoOut }) : f < 95 ? hx(start) : interpolate(f, [95, 115], [hx(38.38), hx(end)], { ...CL, easing: expoOut })}
        y={trackY + 6}
        clicks={[30, 100]}
        appear={6}
      />
    </AbsoluteFill>
  )
}

const Audio: React.FC = () => {
  const f = useCurrentFrame()
  const toggle = 80
  const micOn = 1 - tw(f, [toggle, toggle + 8], [0, 1], inOut)
  const desk = tw(f, [118, 150], [0.72, 0.92])
  const panelIn = spring({ frame: f - 4, fps: 60, config: { damping: 20, stiffness: 120 } })
  return (
    <AbsoluteFill>
      <MeshBg hue="violet" />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 58 }}>
        <Words text="Mute the mic. *Keep the game.*" at={6} out={200} size={84} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 130, top: 270, transform: `translateX(${(1 - panelIn) * -80}px)`, opacity: panelIn }}>
        <Glass pad={44}>
          <AudioTracks w={640} micOn={micOn} desktopVol={desk} micVol={0.72} />
        </Glass>
      </div>
      <div style={{ position: 'absolute', left: 900, top: 330, opacity: panelIn, fontFamily: SANS }}>
        {[
          { label: 'GAME', color: M.teal, level: 1, seed: 1 },
          { label: 'MIC', color: micOn > 0.5 ? M.violet : '#3b3b3f', level: 0.1 + 0.9 * micOn, seed: 7 },
        ].map((l, i) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 56, transform: `translateX(${(1 - spring({ frame: f - 10 - i * 6, fps: 60, config: { damping: 20 } })) * 120}px)` }}>
            <div style={{ width: 90, fontWeight: 800, fontSize: 28, letterSpacing: 2, color: l.color }}>{l.label}</div>
            <Waveform w={760} h={120} color={l.color} seed={l.seed} level={l.level} bars={56} />
          </div>
        ))}
        <div style={{ fontSize: 26, color: M.dim, marginTop: -10 }}>Recorded as separate audio tracks.</div>
      </div>
      <Pointer x={interpolate(f, [30, toggle - 4], [760, 221], { ...CL, easing: expoOut })} y={interpolate(f, [30, toggle - 4], [900, 598], { ...CL, easing: expoOut })} clicks={[toggle]} appear={26} />
    </AbsoluteFill>
  )
}

const Export: React.FC = () => {
  const f = useCurrentFrame()
  const menuIn = spring({ frame: f - 8, fps: 60, config: { damping: 18, stiffness: 140 } })
  const sel = tw(f, [44, 60], [0, 1], backOut)
  const menuOut = tw(f, [86, 100], [0, 1], inOut)
  const click = 120
  const state: 0 | 1 | 2 = f < click + 2 ? 0 : f < click + 62 ? 1 : 2
  const done = spring({ frame: f - (click + 62), fps: 60, config: { damping: 12, stiffness: 160 } })
  const chip = spring({ frame: f - (click + 76), fps: 60, config: { damping: 16, stiffness: 120 } })
  const press = interpolate(f, [click - 2, click + 2, click + 8], [0, 1, 0], CL)
  return (
    <AbsoluteFill>
      <MeshBg hue="teal" />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 58 }}>
        <Words text="Under 10 MB. *Ready for Discord.*" at={6} out={228} size={84} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 960 - 260, top: 300, opacity: menuIn * (1 - menuOut), transform: `translateY(${(1 - menuIn) * 40 - menuOut * 30}px) scale(${0.9 + 0.1 * menuIn})` }}>
        <SizeMenu w={520} sel={sel} />
      </div>
      <div style={{ position: 'absolute', left: 960 - 290, top: 640, transform: `scale(${1 + 0.08 * done * (1 - tw(f, [click + 80, click + 110], [0, 1]))})` }}>
        <ExportButton w={580} state={state} press={press} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 960 - 380,
          top: 800,
          width: 760,
          opacity: chip,
          transform: `translateY(${(1 - chip) * 60}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '18px 24px',
          borderRadius: 16,
          background: 'rgba(22,24,26,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: SANS,
          color: M.ink,
        }}
      >
        <Icon name="file" size={36} color={M.teal} />
        <div style={{ flex: 1, fontSize: 22, fontWeight: 600, fontFamily: 'Consolas, monospace' }}>2026-09-28_23-30-00_VALORANT.mp4</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#04130f', background: M.teal, padding: '6px 14px', borderRadius: 999 }}>≤ 10 MB</div>
      </div>
      <Pointer
        x={f < 70 ? interpolate(f, [20, 50], [1300, 960 - 260 + 160], { ...CL, easing: expoOut }) : interpolate(f, [90, click - 4], [960 - 260 + 160, 960 - 40], { ...CL, easing: expoOut })}
        y={f < 70 ? interpolate(f, [20, 50], [900, 300 + 4 * 1 + 36 * 2.5 * 1 + 26], { ...CL, easing: expoOut }) : interpolate(f, [90, click - 4], [360, 640 + 50], { ...CL, easing: expoOut })}
        clicks={[56, click]}
        appear={16}
      />
    </AbsoluteFill>
  )
}

const BEATS: { word: string; visual: (f: number) => React.ReactNode }[] = [
  {
    word: 'Hover to *preview.*',
    visual: () => <Crop shot="02-library-hover" rect={{ x: 796, y: 184, w: 390, h: 398 }} scale={1.75} style={{ transform: 'rotate(-3deg)' }} />,
  },
  {
    word: 'Games tagged *for you.*',
    visual: f => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', maxWidth: 1300 }}>
        {['VALORANT', 'TEKKEN 8', 'League of Legends', 'Counter-Strike 2', 'Teamfight Tactics'].map((g, i) => {
          const s = spring({ frame: f - 4 - i * 3, fps: 60, config: { damping: 12, stiffness: 180 } })
          return (
            <div key={g} style={{ transform: `scale(${s})`, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 26px', borderRadius: 14, background: 'rgba(168,85,247,0.16)', color: M.purple, fontFamily: SANS, fontWeight: 600, fontSize: 40 }}>
              <Icon name="gamepad" size={40} /> {g}
            </div>
          )
        })}
      </div>
    ),
  },
  {
    word: 'Bulk *everything.*',
    visual: () => (
      <div style={{ perspective: 1400 }}>
        <Crop shot="08-library-selected" rect={{ x: 12, y: 118, w: 1576, h: 470 }} scale={1.02} radius={14} style={{ transform: 'rotateX(16deg)' }} />
      </div>
    ),
  },
  {
    word: 'H.264 *or* AV1.',
    visual: f => <Pills f={f} items={['H.264 · Most compatible', 'AV1 · Smaller files']} />,
  },
  {
    word: 'NVENC *or* x264.',
    visual: f => <Pills f={f} items={['NVENC · GPU', 'x264 · CPU']} />,
  },
  {
    word: 'Up to *144 fps.*',
    visual: f => (
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 300, letterSpacing: -14, color: M.ink, lineHeight: 1 }}>
        {Math.round(tw(f, [2, 24], [30, 144]))}
        <span style={{ fontSize: 90, color: M.teal, letterSpacing: -2 }}> fps</span>
      </div>
    ),
  },
  {
    word: 'Two *audio tracks.*',
    visual: () => (
      <div>
        <Waveform w={1100} h={90} color={M.teal} seed={2} level={1} bars={70} speed={2} />
        <div style={{ height: 24 }} />
        <Waveform w={1100} h={90} color={M.violet} seed={9} level={0.8} bars={70} speed={2} />
      </div>
    ),
  },
  {
    word: 'Plain *MP4* files.',
    visual: f => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: `scale(${spring({ frame: f - 2, fps: 60, config: { damping: 12 } })})` }}>
        <Icon name="file" size={220} color={M.teal} stroke={1.4} />
        <div style={{ fontFamily: 'Consolas, monospace', fontSize: 64, color: M.ink }}>.mp4</div>
      </div>
    ),
  },
]

const Pills: React.FC<{ f: number; items: string[] }> = ({ f, items }) => (
  <div style={{ display: 'flex', gap: 30 }}>
    {items.map((t, i) => {
      const s = spring({ frame: f - 3 - i * 4, fps: 60, config: { damping: 13, stiffness: 170 } })
      return (
        <div key={t} style={{ transform: `translateY(${(1 - s) * 80}px)`, opacity: s, padding: '26px 40px', borderRadius: 22, background: i === 0 ? M.teal : 'rgba(255,255,255,0.08)', color: i === 0 ? '#04130f' : M.ink, border: '1px solid rgba(255,255,255,0.12)', fontFamily: SANS, fontWeight: 700, fontSize: 48 }}>
          {t}
        </div>
      )
    })}
  </div>
)

const Montage: React.FC = () => {
  const f = useCurrentFrame()
  const beat = 40
  const i = Math.min(BEATS.length - 1, Math.floor(f / beat))
  const lf = f - i * beat
  const punch = tw(lf, [0, 8], [1.06, 1])
  return (
    <AbsoluteFill>
      <MeshBg hue={i % 2 ? 'violet' : 'teal'} intensity={1.3} seed={'m' + i} />
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 110 }}>
          <Words key={i} text={BEATS[i].word} at={i * beat} size={110} mode="pop" stagger={2} />
        </AbsoluteFill>
        <Center style={{ paddingTop: 220 }}>{BEATS[i].visual(lf)}</Center>
      </AbsoluteFill>
      <Flash at={i * beat} peak={0.12} dur={8} />
    </AbsoluteFill>
  )
}

const AntiCheat: React.FC = () => {
  const f = useCurrentFrame()
  const draw = tw(f, [8, 60], [0, 1], inOut)
  const panel = spring({ frame: f - 30, fps: 60, config: { damping: 22, stiffness: 90 } })
  return (
    <AbsoluteFill>
      <MeshBg hue="teal" intensity={0.8} />
      <AbsoluteFill style={{ perspective: 1600 }}>
        <div style={{ position: 'absolute', left: 1000, top: 330, opacity: 0.9 * panel, transform: `rotateY(-24deg) rotateX(8deg) translateZ(${-200 + 200 * panel}px)` }}>
          <Crop shot="18-settings-capture" rect={{ x: 350, y: 70, w: 900, h: 420 }} scale={0.95} />
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 150, top: 250 }}>
        <svg width={170} height={170} viewBox="0 0 24 24" fill="none" stroke={M.teal} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 24px rgba(0,212,170,0.6))' }}>
          <path pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tw(f, [50, 70], [0, 1])} d="m9 12 2 2 4-4" />
        </svg>
        <div style={{ marginTop: 30 }}>
          <Words text="No hooks." at={20} size={104} align="left" />
          <Words text="No *injection.*" at={36} size={104} align="left" />
        </div>
        <div style={{ marginTop: 26, fontFamily: SANS, fontSize: 32, color: M.dim, opacity: tw(f, [60, 80], [0, 1]), maxWidth: 760 }}>
          Monitor capture by default. Anti-cheat friendly.
        </div>
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
        <div style={{ transform: `scale(${0.9 + 0.1 * s})`, opacity: s }}>
          <Logo size={1.15} />
        </div>
        <div style={{ height: 34 }} />
        <Words text="Clutch now. *Clip later.*" at={22} size={64} weight={700} />
        <div style={{ marginTop: 26, fontFamily: SANS, fontSize: 28, color: M.dim, opacity: tw(f, [44, 64], [0, 1]) }}>
          Free and open source · Windows 10 and 11 · github.com/ebrardushullovcii/ClipVault
        </div>
      </Center>
    </AbsoluteFill>
  )
}

const SCENES: [number, number, React.FC][] = [
  [0, 130, Hook],
  [110, 220, Gameplay],
  [320, 160, Smash],
  [470, 262, Library],
  [720, 290, Trim],
  [1000, 232, Audio],
  [1220, 262, Export],
  [1470, 320, Montage],
  [1780, 200, AntiCheat],
  [1960, 160, Outro],
]

export const LaunchFilm: React.FC = () => (
  <AbsoluteFill style={{ background: M.bg }}>
    <MeshBg intensity={0.6} />
    {SCENES.map(([from, dur, C], i) => (
      <Sequence key={i} from={from} durationInFrames={dur}>
        <SceneFade dur={dur} fin={i === 0 ? 1 : 12} fout={i === SCENES.length - 1 ? 1 : 12}>
          <C />
        </SceneFade>
      </Sequence>
    ))}
    <Vignette strength={0.45} />
    <Grain opacity={0.06} />
  </AbsoluteFill>
)
