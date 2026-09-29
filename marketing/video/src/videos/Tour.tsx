import React from 'react'
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { AppScene, stageRect } from '../components/AppScene'
import { Backdrop, Brand, Caption, Gameplay, KeyCap, SaveToast } from '../components/Parts'
import { FloatingShot } from '../components/Floating'
import { LAYOUTS, Layout, center, pad, rect, thumbOf, union } from '../data'

// ~50 s product tour with captions.
export const TOUR_FRAMES = 1500
const FIT = 0.8
const OFFY = 52
const CAP_X = 269

export const Tour: React.FC<{ layout: Layout; posterFrame?: number }> = ({ layout }) => {
  const frame = useCurrentFrame()
  const L = LAYOUTS[layout]
  const R = (shot: string, key: string) => rect(layout, shot, key)
  const P = (shot: string, key: string) => center(R(shot, key))
  const full = { x: L.width / 2, y: L.height / 2, z: 1 }
  const focus = (r: { x: number; y: number; w: number; h: number }, z: number) => ({ ...center(r), z })

  const newCard = R('03-library-new-clip', 'newCard')
  const video = R('10-editor-trimmed', 'video')
  const timeline = R('10-editor-trimmed', 'timeline')
  const audio = union(R('11-editor-audio', 'desktopAudio'), R('11-editor-audio', 'micVolume'), R('11-editor-audio', 'desktopVolume'))
  const exportArea = union(R('12-editor-size-menu', 'option10'), R('11-editor-audio', 'exportButton'), R('11-editor-audio', 'trimOriginal'))
  const exportSize = (R('14-export-complete', 'size') as unknown as { width: number; height: number }) ?? { width: 980, height: 760 }

  const appOpacity = interpolate(frame, [172, 196, 1398, 1414], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill>
      <Backdrop />
      <AppScene
        layout={layout}
        fit={FIT}
        offsetY={OFFY}
        opacity={appOpacity}
        shots={[
          { name: '03-library-new-clip', at: 0 },
          { name: '02-library-hover', at: 330, fade: 8 },
          { name: '05-library-favorites', at: 400, fade: 8 },
          { name: '04-library-filter-game', at: 458, fade: 8 },
          { name: '09-editor', at: 512, fade: 10 },
          { name: '09b-editor-tagged', at: 562, fade: 10 },
          { name: '10-editor-trimmed', at: 606, fade: 20 },
          { name: '11-editor-audio', at: 720, fade: 6 },
          { name: '12-editor-size-menu', at: 804, fade: 5 },
          { name: '11-editor-audio', at: 834, fade: 5 },
          { name: '13-editor-exporting', at: 864, fade: 5 },
          { name: '13b-editor-exported', at: 896, fade: 8 },
          { name: '16-editor-tekken', at: 962, fade: 12 },
          { name: '17-editor-league', at: 1020, fade: 12 },
          { name: '18-settings-capture', at: 1080, fade: 12 },
          { name: '19-settings-games', at: 1134, fade: 8 },
          { name: '20-settings-quality', at: 1232, fade: 12 },
          { name: '22-settings-hotkey', at: 1322, fade: 12 },
        ]}
        cam={[
          { at: 0, ...full },
          { at: 590, ...full },
          { at: 618, ...focus(pad(union(timeline, { ...video, y: video.y + video.h * 0.55, h: video.h * 0.45 }), 20), 1.28), dur: 26 },
          { at: 692, ...focus(pad(union(timeline, { ...video, y: video.y + video.h * 0.55, h: video.h * 0.45 }), 20), 1.28) },
          { at: 714, ...focus(pad(audio, 60), 1.3), dur: 22 },
          { at: 780, ...focus(pad(audio, 60), 1.3) },
          { at: 800, ...focus(pad(exportArea, 80), 1.3), dur: 20 },
          { at: 900, ...focus(pad(exportArea, 80), 1.3) },
          { at: 922, ...full, dur: 22 },
          { at: 1080, ...full },
          { at: 1112, ...focus(pad(R('19-settings-games', 'recordSelect'), 180), 1.3), dur: 26 },
          { at: 1210, ...focus(pad(R('19-settings-games', 'recordSelect'), 180), 1.3) },
          { at: 1236, ...full, dur: 24 },
        ]}
        ptr={[
          { at: 250, x: newCard.x + newCard.w * 1.3, y: newCard.y + newCard.h * 1.2 },
          { at: 328, ...P('02-library-hover', 'card'), dur: 36 },
          { at: 396, ...P('01-library', 'favorites'), dur: 26, click: true },
          { at: 452, ...P('04-library-filter-game', 'gameFilter'), dur: 24, click: true },
          { at: 506, ...center(thumbOf(R('04-library-filter-game', 'card0'))), dur: 26, click: true },
          { at: 550, ...P('09-editor', 'tagInput'), dur: 26, click: true },
          { at: 572, ...P('09-editor', 'favorite'), dur: 14, click: true },
          { at: 600, x: R('09-editor', 'startMarker').x + 2, y: R('09-editor', 'startMarker').y + 4, dur: 24 },
          { at: 628, x: R('10-editor-trimmed', 'startMarker').x + 2, y: R('10-editor-trimmed', 'startMarker').y + 4, dur: 24 },
          { at: 712, ...P('11-editor-audio', 'mic'), dur: 26, click: true },
          { at: 800, ...P('11-editor-audio', 'sizeMenu'), dur: 26, click: true },
          { at: 830, ...P('12-editor-size-menu', 'option10'), dur: 20, click: true },
          { at: 860, ...P('11-editor-audio', 'exportButton'), dur: 22, click: true },
          { at: 940, ...P('11-editor-audio', 'exportButton'), dur: 1, hide: true },
          { at: 1112, ...P('18-settings-capture', 'recordSelect'), dur: 30 },
          { at: 1130, ...P('18-settings-capture', 'recordSelect'), dur: 1, click: true },
          { at: 1220, ...P('18-settings-capture', 'recordSelect'), dur: 1, hide: true },
        ]}
        spots={[
          { from: 212, to: 312, rect: newCard, radius: 12 },
          { from: 340, to: 392, rect: R('02-library-hover', 'card'), radius: 12, dim: 0.45 },
          { from: 726, to: 790, rect: pad(audio, 14), radius: 12 },
        ]}
        labels={[{ from: 226, to: 306, rect: newCard, text: 'Just saved', side: 'top' }]}
        videos={[{ from: 636, to: 704, rect: video, src: 'game-won.mp4', trimBefore: 150 }]}
      />
      <FloatingShot layout={layout} name="14-export-complete" from={912} to={958} width={exportSize.width} height={exportSize.height} scale={0.95} y={560} />

      {/* Opening title over blurred gameplay. */}
      <Sequence from={0} durationInFrames={92}>
        <Gameplay src="game-open.mp4" trimBefore={0} blur={10} zoom={[1.1, 1.05]} len={92} fadeOut={[78, 92]} />
      </Sequence>
      <Brand from={6} to={88} tagline="Clutch now. Clip later." sub="Game clipping for Windows" />

      {/* The save: round win, hotkey, notification, then into the library. */}
      <Sequence from={84} durationInFrames={130}>
        <Gameplay src="game-won.mp4" trimBefore={84} zoom={[1.06, 1.0]} len={130} fadeIn={8} shrink={{ from: 92, to: 122, rect: stageRect(layout, thumbOf(newCard), undefined, FIT, OFFY) }} fadeOut={[116, 130]} />
      </Sequence>
      <KeyCap appear={146} press={158} />
      <SaveToast from={162} to={250} />

      <Caption from={96} to={176} title="Play normally. Hit your hotkey." sub="ClipVault keeps a rolling buffer of your last 2 minutes." x={80} y={60} />
      <Caption from={196} to={318} title="The clip lands in your library." sub="A plain MP4, named by date and game." x={CAP_X} />
      <Caption from={326} to={396} title="Hover to preview." sub="Clips play right in the grid." x={CAP_X} />
      <Caption from={400} to={512} title="Filter by game, tag or favorite." sub="Detected games are tagged automatically." x={CAP_X} />
      <Caption from={516} to={704} title="Tag it. Trim it." sub="Drag the handles to keep only the play." x={CAP_X} />
      <Caption from={708} to={792} title="Game and mic on separate tracks." sub="Mute or rebalance either one before export." x={CAP_X} pos="bottom" />
      <Caption from={796} to={958} title="Export under 10 MB for Discord." sub="H.264 or AV1, then drag the file anywhere." x={CAP_X} />
      <Caption from={962} to={1076} title="Whatever you play." sub="Monitor capture records anything on screen." x={CAP_X} />
      <Caption from={1080} to={1228} title="Anti-cheat friendly by default." sub="No game hooks or injection. Game-only capture is optional." x={CAP_X} pos="bottom" />
      <Caption from={1232} to={1318} title="NVENC or x264, up to 144 fps." sub="Pick the quality that fits your PC." x={CAP_X} />
      <Caption from={1322} to={1404} title="Change the hotkey. Start with Windows." sub="It sits in the tray until you need it." x={CAP_X} />

      <Brand from={1412} tagline="Clutch now. Clip later." sub="Free and open source · Windows 10 and 11 · github.com/ebrardushullovcii/ClipVault" />
    </AbsoluteFill>
  )
}
