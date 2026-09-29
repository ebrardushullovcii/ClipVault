// Recreations of ClipVault UI pieces (same labels, colors and states as the app) for motion work.
import React from 'react'
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { M, UI_FONT, tw, inOut } from './kit'

const P = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  gamepad: '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  drive: '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  max: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 11 5 3-5 3v-6Z"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
}
export type IconName = keyof typeof P
export const Icon: React.FC<{ name: IconName; size: number; color?: string; stroke?: number; fill?: string; style?: React.CSSProperties }> = ({ name, size, color = 'currentColor', stroke = 2, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} dangerouslySetInnerHTML={{ __html: P[name] }} />
)

export type ClipData = { id: string; game: string; size: string; date: string; duration: string; tags?: string[]; fav?: boolean }

// Real clips from the capture library (sizes/dates as shown in the app).
export const CLIPS: ClipData[] = [
  { id: '2026-09-28_23-30-00_VALORANT', game: 'VALORANT', size: '215.34 MB', date: 'Sep 28, 2026, 11:30 PM', duration: '2:02' },
  { id: '2026-09-28_02-41-39_TEKKEN_8', game: 'TEKKEN 8', size: '779.86 MB', date: 'Sep 28, 2026, 2:41 AM', duration: '2:59', tags: ['combo'], fav: true },
  { id: '2026-09-27_21-41-34_League_of_Legends', game: 'League of Legends', size: '397.6 MB', date: 'Sep 27, 2026, 9:41 PM', duration: '2:58', tags: ['teamfight'] },
  { id: '2026-09-27_03-47-16_VALORANT', game: 'VALORANT', size: '253.53 MB', date: 'Sep 27, 2026, 3:47 AM', duration: '2:58' },
  { id: '2026-09-27_00-53-13_TEKKEN_8', game: 'TEKKEN 8', size: '557.98 MB', date: 'Sep 27, 2026, 12:53 AM', duration: '1:58', tags: ['ranked'] },
  { id: '2026-09-26_01-58-50_League_of_Legends', game: 'League of Legends', size: '377.85 MB', date: 'Sep 26, 2026, 1:58 AM', duration: '2:58', tags: ['teamfight'], fav: true },
  { id: '2026-09-25_22-34-47_Counter-Strike_2', game: 'Counter-Strike 2', size: '279.14 MB', date: 'Sep 25, 2026, 10:34 PM', duration: '2:58', tags: ['funny'] },
  { id: '2026-09-25_00-58-25_VALORANT', game: 'VALORANT', size: '362.22 MB', date: 'Sep 25, 2026, 12:58 AM', duration: '3:00', tags: ['1v3'], fav: true },
]
export const ALL_THUMBS = [
  '2026-09-28_23-30-00_VALORANT', '2026-09-28_02-41-39_TEKKEN_8', '2026-09-27_21-41-34_League_of_Legends', '2026-09-27_03-47-16_VALORANT',
  '2026-09-27_00-53-13_TEKKEN_8', '2026-09-26_01-58-50_League_of_Legends', '2026-09-25_22-34-47_Counter-Strike_2', '2026-09-25_00-58-25_VALORANT',
  '2026-09-24_20-46-21_League_of_Legends', '2026-09-24_14-19-50_VALORANT', '2026-09-24_02-36-26_TEKKEN_8', '2026-09-23_03-10-51_Teamfight_Tactics',
  '2026-09-22_04-09-16_VALORANT', '2026-09-21_03-47-15_League_of_Legends', '2026-09-19_22-58-47_TEKKEN_8', '2026-09-19_03-45-15_VALORANT',
  '2026-09-18_04-36-29_League_of_Legends', '2026-09-17_03-12-03_VALORANT', '2026-09-16_00-21-12_League_of_Legends', '2026-09-15_06-10-06_TEKKEN_8',
  '2026-09-14_03-27-39_VALORANT', '2026-09-13_03-06-51_League_of_Legends', '2026-09-12_04-04-04_VALORANT', '2026-09-11_04-31-16_League_of_Legends',
]
export const thumb = (id: string) => staticFile(`thumbs/${id}.jpg`)

const chip = (s: number, bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5 * s,
  padding: `${4 * s}px ${8 * s}px`,
  borderRadius: 5 * s,
  background: bg,
  color,
  fontSize: 12 * s,
})

// Library card, same structure as the app's grid card. Base design width 340.
export const ClipCard: React.FC<{ clip: ClipData; w: number; selected?: boolean; glow?: number; style?: React.CSSProperties; thumbOverride?: string }> = ({ clip, w, selected, glow = 0, style, thumbOverride }) => {
  const s = w / 340
  return (
    <div
      style={{
        width: w,
        borderRadius: 12 * s,
        overflow: 'hidden',
        background: M.app1,
        border: `${Math.max(1, s)}px solid ${selected || glow > 0 ? M.teal : 'rgba(255,255,255,0.08)'}`,
        boxShadow: `0 ${30 * s}px ${80 * s}px rgba(0,0,0,0.55)${glow > 0 ? `, 0 0 ${60 * s * glow}px rgba(0,212,170,${0.55 * glow})` : ''}`,
        fontFamily: UI_FONT,
        color: '#fff',
        ...style,
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000' }}>
        <Img src={thumbOverride ?? thumb(clip.id)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', left: 8 * s, top: 8 * s, ...chip(s, 'rgba(0,0,0,0.7)', '#fff'), fontWeight: 600 }}>
          <Icon name="max" size={11 * s} stroke={2.4} />
          1080p
        </div>
        <div style={{ position: 'absolute', right: 8 * s, bottom: 8 * s, ...chip(s, 'rgba(0,0,0,0.7)', '#fff'), fontWeight: 600 }}>{clip.duration}</div>
      </div>
      <div style={{ padding: `${14 * s}px ${16 * s}px ${16 * s}px` }}>
        <div style={{ fontSize: 14 * s, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip.id}</div>
        <div style={{ display: 'flex', gap: 10 * s, marginTop: 8 * s, fontSize: 11.5 * s, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 * s }}>
            <Icon name="drive" size={11 * s} /> {clip.size}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 * s }}>
            <Icon name="clock" size={11 * s} /> {clip.date}
          </span>
          <span>• 60fps</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 * s, marginTop: 10 * s }}>
          <span style={chip(s, 'rgba(168,85,247,0.12)', M.purple)}>
            <Icon name="gamepad" size={12 * s} /> {clip.game}
          </span>
          {(clip.tags ?? []).map(t => (
            <span key={t} style={chip(s, 'rgba(0,212,170,0.12)', M.teal)}>
              {t}
            </span>
          ))}
        </div>
        {clip.fav && (
          <div style={{ marginTop: 10 * s, fontSize: 12 * s, color: M.gold, display: 'flex', alignItems: 'center', gap: 5 * s }}>
            <Icon name="star" size={12 * s} fill={M.gold} color={M.gold} /> Favorite
          </div>
        )}
      </div>
    </div>
  )
}

const fmt = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

// Editor trim bar. start/end/playhead in seconds; w is the track width in px.
export const TrimBar: React.FC<{ w: number; dur: number; start: number; end: number; playhead: number; scale?: number }> = ({ w, dur, start, end, playhead, scale = 1 }) => {
  const s = scale
  const x = (t: number) => (t / dur) * w
  const mono = '"Cascadia Mono", Consolas, monospace'
  return (
    <div style={{ width: w, fontFamily: UI_FONT, color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 16 * s, marginBottom: 18 * s }}>
        <span>{fmt(playhead)}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmt(dur)}</span>
      </div>
      <div style={{ position: 'relative', height: 16 * s, borderRadius: 999, background: M.app2 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: x(start), borderRadius: '999px 0 0 999px', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: x(start), width: x(end) - x(start), background: 'rgba(0,212,170,0.24)' }} />
        {[start, end].map((t, i) => (
          <div key={i} style={{ position: 'absolute', left: x(t) - 2 * s, bottom: 0, width: 4 * s, height: 32 * s, background: M.teal }}>
            <div style={{ position: 'absolute', left: -6 * s, top: -8 * s, width: 16 * s, height: 16 * s, borderRadius: '50%', background: M.teal, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
          </div>
        ))}
        <div style={{ position: 'absolute', left: x(playhead) - 1 * s, top: 0, bottom: 0, width: 2 * s, background: '#fff' }}>
          <div style={{ position: 'absolute', left: -5 * s, top: 2 * s, width: 12 * s, height: 12 * s, borderRadius: '50%', background: '#fff' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24 * s, marginTop: 20 * s, fontSize: 13 * s, color: 'rgba(255,255,255,0.45)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 * s }}>
          <Icon name="scissors" size={13 * s} /> Trim: {fmt(start)} - {fmt(end)}
        </span>
        <span>Duration: {fmt(end - start)}</span>
      </div>
    </div>
  )
}

const Check: React.FC<{ on: number; s: number }> = ({ on, s }) => (
  <div
    style={{
      width: 18 * s,
      height: 18 * s,
      borderRadius: 4 * s,
      border: `${1.5 * s}px solid ${on > 0.5 ? M.teal : 'rgba(255,255,255,0.8)'}`,
      background: on > 0.5 ? M.teal : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `scale(${1 - 0.15 * Math.sin(Math.PI * Math.min(1, Math.abs(on - 0.5) * 2))})`,
    }}
  >
    {on > 0.5 && <Icon name="check" size={14 * s} color="#062" stroke={3.2} style={{ opacity: on }} />}
  </div>
)

const Slider: React.FC<{ v: number; on: boolean; s: number; w: number }> = ({ v, on, s, w }) => (
  <div style={{ position: 'relative', width: w, height: 6 * s, borderRadius: 99, background: '#3a3a3a' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: v * w, borderRadius: 99, background: on ? M.teal : '#5a5a5a' }} />
    <div style={{ position: 'absolute', left: v * w - 9 * s, top: -6 * s, width: 18 * s, height: 18 * s, borderRadius: '50%', background: on ? M.teal : '#6a6a6a' }} />
  </div>
)

// Audio Tracks panel. micOn: 0..1 (animated toggle), volumes 0..1.
export const AudioTracks: React.FC<{ w: number; micOn: number; desktopVol: number; micVol: number }> = ({ w, micOn, desktopVol, micVol }) => {
  const s = w / 340
  const row = (label: string, on: number, vol: number) => (
    <div style={{ background: 'rgba(36,36,36,0.6)', borderRadius: 10 * s, padding: `${16 * s}px ${16 * s}px ${18 * s}px`, marginTop: 12 * s }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s, fontSize: 16 * s, color: on > 0.5 ? '#fff' : 'rgba(255,255,255,0.45)' }}>
        <Check on={on} s={s} />
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * s, marginTop: 14 * s }}>
        <Icon name={on > 0.5 ? 'volume' : 'mute'} size={14 * s} color="rgba(255,255,255,0.45)" />
        <Slider v={vol} on={on > 0.5} s={s} w={w - 80 * s} />
      </div>
    </div>
  )
  return (
    <div style={{ width: w, fontFamily: UI_FONT, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 * s, fontSize: 17 * s, fontWeight: 600 }}>
        <Icon name="layers" size={18 * s} /> Audio Tracks
      </div>
      {row('Desktop Audio', 1, desktopVol)}
      {row('Microphone', micOn, micVol)}
    </div>
  )
}

// Export size target menu, same options as the app. `sel` animates between option indexes.
export const SIZE_OPTIONS = ['Keep original (fast, large)', 'Up to 10 MB', 'Up to 50 MB', 'Up to 100 MB']
export const SizeMenu: React.FC<{ w: number; sel: number }> = ({ w, sel }) => {
  const s = w / 208
  const rowH = 36 * s
  return (
    <div style={{ width: w, borderRadius: 10 * s, background: M.app1, border: '1px solid rgba(255,255,255,0.1)', padding: `${4 * s}px 0`, fontFamily: UI_FONT, position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 4 * s + sel * rowH, height: rowH, background: M.app2 }} />
      {SIZE_OPTIONS.map((o, i) => {
        const active = Math.round(sel) === i
        return (
          <div key={o} style={{ position: 'relative', height: rowH, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${16 * s}px`, fontSize: 14 * s, color: active ? M.teal : 'rgba(255,255,255,0.72)' }}>
            {o}
            {active && <Icon name="check" size={16 * s} color={M.teal} />}
          </div>
        )
      })}
    </div>
  )
}

// Export button states: 0 idle, 1 exporting (spinner), 2 complete.
export const ExportButton: React.FC<{ w: number; state: 0 | 1 | 2; press?: number }> = ({ w, state, press = 0 }) => {
  const frame = useCurrentFrame()
  const s = w / 223
  const bg = state === 2 ? M.green : M.teal
  return (
    <div
      style={{
        width: w,
        height: 44 * s,
        borderRadius: 8 * s,
        background: bg,
        opacity: state === 1 ? 0.85 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10 * s,
        fontFamily: UI_FONT,
        fontSize: 18 * s,
        fontWeight: 600,
        color: state === 2 ? '#fff' : '#0f0f0f',
        transform: `scale(${1 - 0.06 * press})`,
        boxShadow: `0 ${20 * s}px ${50 * s}px rgba(0,212,170,${state === 2 ? 0.15 : 0.3})`,
      }}
    >
      {state === 0 && (
        <>
          <Icon name="download" size={18 * s} /> Export <span style={{ fontSize: 12 * s, opacity: 0.8 }}>(10MB)</span>
        </>
      )}
      {state === 1 && (
        <>
          <Icon name="spinner" size={18 * s} style={{ transform: `rotate(${frame * 12}deg)` }} /> Exporting...
        </>
      )}
      {state === 2 && (
        <>
          <Icon name="check" size={18 * s} stroke={3} /> Export Complete!
        </>
      )}
    </div>
  )
}

// Windows "Clip Saved" notification from the backend.
export const Toast: React.FC<{ w: number; path?: string }> = ({ w, path = 'C:\\Users\\Player\\Videos\\ClipVault\\2026-09-28_23-30-00_VALORANT.mp4' }) => {
  const s = w / 520
  return (
    <div
      style={{
        width: w,
        background: 'rgba(32,32,32,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10 * s,
        padding: `${18 * s}px ${22 * s}px ${20 * s}px`,
        fontFamily: UI_FONT,
        color: '#fff',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 * s, fontSize: 17 * s, color: 'rgba(255,255,255,0.8)' }}>
        <Img src={staticFile('brand/icon.png')} style={{ width: 22 * s, height: 22 * s, borderRadius: 5 * s }} />
        ClipVault
      </div>
      <div style={{ marginTop: 12 * s, fontSize: 22 * s, fontWeight: 600 }}>Clip Saved</div>
      <div style={{ marginTop: 4 * s, fontSize: 17 * s, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35, wordBreak: 'break-all' }}>Saved to: {path}</div>
    </div>
  )
}

// Keycap legend for the save hotkey. The key is user-configurable, so no key name is shown.
export const HotkeyLegend: React.FC<{ s: number; lit: boolean }> = ({ s, lit }) => {
  const c = lit ? M.teal : 'rgba(245,247,247,0.92)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * s }}>
      <div style={{ width: 40 * s, height: 40 * s, borderRadius: '50%', border: `${4 * s}px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: lit ? `0 0 ${24 * s}px rgba(0,212,170,0.8)` : 'none' }}>
        <div style={{ width: 18 * s, height: 18 * s, borderRadius: '50%', background: c }} />
      </div>
      <div style={{ fontFamily: UI_FONT, fontWeight: 700, fontSize: 17 * s, letterSpacing: 3 * s, color: lit ? M.teal : 'rgba(245,247,247,0.6)' }}>HOTKEY</div>
    </div>
  )
}

// Large 3D keycap. `press` is the frame of the key press.
export const KeyBig: React.FC<{ size: number; press: number; label?: React.ReactNode }> = ({ size, press, label }) => {
  const frame = useCurrentFrame()
  const down = interpolate(frame, [press - 3, press + 2, press + 10, press + 20], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const glow = tw(frame, [press, press + 40], [1, 0.25], inOut) * (frame >= press ? 1 : 0)
  const s = size / 200
  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `translateY(${down * 18 * s}px)` }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 40 * s,
          background: 'linear-gradient(180deg, #2c3035, #15171a)',
          boxShadow: `0 ${(30 - down * 20) * s}px 0 #08090a, 0 ${(50 - down * 26) * s}px ${90 * s}px rgba(0,0,0,0.7), 0 0 ${140 * s * glow}px rgba(0,212,170,${0.85 * glow})`,
          border: `${3 * s}px solid rgba(255,255,255,${0.1 + glow * 0.35})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 18 * s,
          borderRadius: 28 * s,
          background: 'linear-gradient(180deg, #383c42, #202328)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: UI_FONT,
          fontWeight: 700,
          fontSize: 76 * s,
          color: glow > 0.3 ? M.teal : M.ink,
          textShadow: glow > 0.3 ? `0 0 ${30 * s}px rgba(0,212,170,0.9)` : 'none',
        }}
      >
        {label ?? <HotkeyLegend s={s * 1.25} lit={glow > 0.3} />}
      </div>
    </div>
  )
}

// Decorative audio lanes (two tracks) for motion graphics; not app UI.
export const Waveform: React.FC<{ w: number; h: number; color: string; seed: number; level: number; bars?: number; speed?: number }> = ({ w, h, color, seed, level, bars = 64, speed = 1 }) => {
  const frame = useCurrentFrame()
  const bw = w / bars
  return (
    <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', gap: bw * 0.35 }}>
      {Array.from({ length: bars }, (_, i) => {
        const v = Math.abs(Math.sin(i * 0.61 + seed) * 0.6 + Math.sin(i * 0.17 + frame * 0.05 * speed + seed * 2) * 0.4)
        const hh = Math.max(3, v * h * level)
        return <div key={i} style={{ width: bw * 0.65, height: hh, borderRadius: 99, background: color, opacity: 0.35 + 0.65 * level }} />
      })}
    </div>
  )
}
