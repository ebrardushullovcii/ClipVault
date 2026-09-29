import React from 'react'
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion'
import { Grain, M, MeshBg, SANS, Vignette, inOut, tw } from './kit'
import { ExportButton, Icon, KeyBig, SizeMenu, TrimBar, Waveform, thumb } from './ui'

// 16 s seamless loop of animated feature tiles (60 fps). Every motion has a period that divides 960.
export const BENTO_FRAMES = 960
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const LOOP_SPEED = Math.PI / 3 // waveform speed that repeats exactly every 960 frames

const Tile: React.FC<{ w: number; h: number; title: string; sub: string; children: React.ReactNode }> = ({ w, h, title, sub, children }) => (
  <div
    style={{
      width: w,
      height: h,
      position: 'relative',
      borderRadius: 28,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(24,26,28,0.92), rgba(13,14,15,0.94))',
      border: '1px solid rgba(255,255,255,0.09)',
      boxShadow: '0 40px 100px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}
  >
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    <div style={{ position: 'absolute', left: 30, bottom: 26, fontFamily: SANS }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: M.ink }}>{title}</div>
      <div style={{ fontSize: 19, color: M.dim, marginTop: 4 }}>{sub}</div>
    </div>
  </div>
)

const Buffer: React.FC = () => {
  const f = useCurrentFrame()
  const rot = (f / 960) * 360 * 4
  const rec = Math.floor(f / 30) % 2 === 0
  return (
    <div style={{ position: 'relative', width: 250, height: 250 }}>
      <svg width={250} height={250} viewBox="0 0 250 250" style={{ position: 'absolute', inset: 0, transform: `rotate(${rot}deg)` }}>
        <circle cx={125} cy={125} r={108} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
        <circle cx={125} cy={125} r={108} fill="none" stroke={M.teal} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 108 * 0.78} ${2 * Math.PI * 108}`} style={{ filter: 'drop-shadow(0 0 10px rgba(0,212,170,0.6))' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: SANS }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, color: M.ink }}>2:00</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: '#ff4d4d', opacity: rec ? 1 : 0.25 }} /> BUFFER
        </div>
      </div>
    </div>
  )
}

const Hotkey: React.FC = () => {
  const f = useCurrentFrame()
  const press = f < 40 ? -200 : 40 + Math.floor((f - 40) / 240) * 240
  const lf = f - press
  const chip = interpolate(lf, [14, 26, 150, 170], [0, 1, 1, 0], CL)
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
      <KeyBig size={170} press={press} />
      <div style={{ opacity: chip, transform: `translateY(${(1 - chip) * 14}px)`, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, background: 'rgba(0,212,170,0.14)', color: M.teal, fontFamily: SANS, fontWeight: 700, fontSize: 20 }}>
        <Icon name="check" size={18} stroke={3} /> Clip Saved
      </div>
    </div>
  )
}

const Tracks: React.FC = () => {
  const f = useCurrentFrame()
  const p = f % 480
  const micOn = 1 - interpolate(p, [240, 252, 460, 472], [0, 1, 1, 0], CL)
  return (
    <div style={{ fontFamily: SANS }}>
      {[
        { label: 'GAME', color: M.teal, level: 1, seed: 1 },
        { label: 'MIC', color: micOn > 0.5 ? M.violet : '#3b3b3f', level: 0.1 + 0.9 * micOn, seed: 7 },
      ].map(l => (
        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26 }}>
          <div style={{ width: 64, fontWeight: 800, fontSize: 18, letterSpacing: 2, color: l.color }}>{l.label}</div>
          <Waveform w={380} h={70} color={l.color} seed={l.seed} level={l.level} bars={34} speed={LOOP_SPEED} />
        </div>
      ))}
    </div>
  )
}

const Trim: React.FC = () => {
  const f = useCurrentFrame()
  const p = f % 480
  const dur = 122.03
  const k = tw(p, [20, 90], [0, 1]) * (1 - tw(p, [390, 450], [0, 1], inOut))
  const start = 38.38 * k
  const end = dur - (dur - 64.18) * k
  const playhead = start + (end - start) * ((p % 240) / 240) * k
  return <TrimBar w={440} dur={dur} start={start} end={end} playhead={playhead} scale={0.95} />
}

const Export: React.FC = () => {
  const f = useCurrentFrame()
  const p = f % 480
  const sel = tw(p, [40, 54], [0, 1])
  const state: 0 | 1 | 2 = p < 120 ? 0 : p < 176 ? 1 : p < 440 ? 2 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <SizeMenu w={300} sel={sel * (1 - tw(p, [440, 460], [0, 1]))} />
      <ExportButton w={300} state={state} />
    </div>
  )
}

const GROUPS = [
  { game: 'VALORANT', ids: ['2026-09-28_23-30-00_VALORANT', '2026-09-27_03-47-16_VALORANT', '2026-09-25_00-58-25_VALORANT', '2026-09-24_14-19-50_VALORANT'] },
  { game: 'TEKKEN 8', ids: ['2026-09-28_02-41-39_TEKKEN_8', '2026-09-27_00-53-13_TEKKEN_8', '2026-09-24_02-36-26_TEKKEN_8', '2026-09-19_22-58-47_TEKKEN_8'] },
  { game: 'League of Legends', ids: ['2026-09-27_21-41-34_League_of_Legends', '2026-09-26_01-58-50_League_of_Legends', '2026-09-24_20-46-21_League_of_Legends', '2026-09-21_03-47-15_League_of_Legends'] },
]

const Games: React.FC = () => {
  const f = useCurrentFrame()
  const period = 320 // 3 groups × 320 = 960
  const gi = Math.floor(f / period) % GROUPS.length
  const lf = f % period
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {GROUPS.map((g, i) => (
          <div key={g.game} style={{ padding: '7px 14px', borderRadius: 8, fontFamily: SANS, fontWeight: 600, fontSize: 17, background: i === gi ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.05)', color: i === gi ? M.purple : 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="gamepad" size={16} /> {g.game}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 200px)', gap: 10 }}>
        {GROUPS[gi].ids.map((id, i) => {
          const o = interpolate(lf, [i * 5, i * 5 + 16, period - 18 + i * 3, period - 4], [0, 1, 1, 0], CL)
          return (
            <div key={id} style={{ width: 200, height: 112, borderRadius: 10, overflow: 'hidden', opacity: o, transform: `translateY(${(1 - o) * 14}px)`, boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
              <Img src={thumb(id)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TILES = [
  { title: 'Always recording', sub: 'The last 2 minutes, kept in a buffer.', C: Buffer },
  { title: 'One hotkey', sub: 'Saves the buffer as an MP4.', C: Hotkey },
  { title: 'Two audio tracks', sub: 'Game and mic, mute either one.', C: Tracks },
  { title: 'Trim', sub: 'Drag the handles to the moment.', C: Trim },
  { title: 'Under 10 MB', sub: 'Export sized for Discord.', C: Export },
  { title: 'Sorted by game', sub: 'Detected games are tagged.', C: Games },
]

export const Bento: React.FC<{ square?: boolean }> = ({ square }) => {
  const f = useCurrentFrame()
  const W = square ? 1080 : 1920
  const H = 1080
  const cols = square ? 2 : 3
  const tiles = square ? [TILES[1], TILES[2], TILES[3], TILES[4]] : TILES
  const rows = Math.ceil(tiles.length / cols)
  const pad = square ? 44 : 64
  const gap = 26
  const tw_ = (W - pad * 2 - gap * (cols - 1)) / cols
  const th = (H - pad * 2 - gap * (rows - 1)) / rows
  const scale = 1.22 * (square ? Math.min(tw_ / 520, th / 440) : Math.min(tw_ / 560, th / 450))
  return (
    <AbsoluteFill style={{ background: M.bg }}>
      <MeshBg hue="mix" intensity={1.1} period={960} />
      <div style={{ position: 'absolute', left: pad, top: pad, display: 'grid', gridTemplateColumns: `repeat(${cols}, ${tw_}px)`, gridAutoRows: `${th}px`, gap }}>
        {tiles.map(({ title, sub, C }, i) => {
          const breathe = 1 + 0.006 * Math.sin((2 * Math.PI * (f + i * 160)) / 480)
          return (
            <div key={title} style={{ transform: `scale(${breathe})` }}>
              <Tile w={tw_} h={th} title={title} sub={sub}>
                <div style={{ transform: `scale(${scale})` }}>
                  <C />
                </div>
              </Tile>
            </div>
          )
        })}
      </div>
      <Vignette strength={0.35} />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  )
}
