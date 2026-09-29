import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { AppScene } from '../components/AppScene'
import { Backdrop, Caption, KeyCap, SaveToast } from '../components/Parts'
import { FloatingShot } from '../components/Floating'
import { LAYOUTS, Layout, center, pad, rect, thumbOf, union } from '../data'

const FIT = 0.8
const OFFY = 52
const CAP_X = 269
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// Feature clip: open the new clip, tag, trim, mute the mic, export for Discord.
export const TRIM_FRAMES = 510
export const TrimExport: React.FC<{ layout: Layout; posterFrame?: number }> = ({ layout }) => {
  const frame = useCurrentFrame()
  const L = LAYOUTS[layout]
  const R = (shot: string, key: string) => rect(layout, shot, key)
  const P = (shot: string, key: string) => center(R(shot, key))
  const full = { x: L.width / 2, y: L.height / 2, z: 1 }
  const focus = (r: { x: number; y: number; w: number; h: number }, z: number) => ({ ...center(r), z })
  const video = R('10-editor-trimmed', 'video')
  const timeline = R('10-editor-trimmed', 'timeline')
  const trimArea = pad(union(timeline, { ...video, y: video.y + video.h * 0.55, h: video.h * 0.45 }), 20)
  const audio = union(R('11-editor-audio', 'desktopAudio'), R('11-editor-audio', 'micVolume'), R('11-editor-audio', 'desktopVolume'))
  const exportArea = union(R('12-editor-size-menu', 'option10'), R('11-editor-audio', 'exportButton'), R('11-editor-audio', 'trimOriginal'))
  const header = union(R('09-editor', 'tagInput'), R('09-editor', 'favorite'))
  const size = R('14-export-complete', 'size') as unknown as { width: number; height: number }
  const fadeIn = interpolate(frame, [0, 14], [0, 1], clamp)

  return (
    <AbsoluteFill>
      <Backdrop />
      <AppScene
        layout={layout}
        fit={FIT}
        offsetY={OFFY}
        opacity={fadeIn}
        shots={[
          { name: '09-editor', at: 0 },
          { name: '09b-editor-tagged', at: 86, fade: 10 },
          { name: '10-editor-trimmed', at: 148, fade: 20 },
          { name: '11-editor-audio', at: 272, fade: 6 },
          { name: '12-editor-size-menu', at: 344, fade: 5 },
          { name: '11-editor-audio', at: 372, fade: 5 },
          { name: '13-editor-exporting', at: 400, fade: 5 },
          { name: '13b-editor-exported', at: 432, fade: 8 },
        ]}
        cam={[
          { at: 0, ...full },
          { at: 44, ...full },
          { at: 70, ...focus(pad(header, 160), 1.45), dur: 26 },
          { at: 110, ...focus(pad(header, 160), 1.45) },
          { at: 138, ...focus(trimArea, 1.28), dur: 26 },
          { at: 240, ...focus(trimArea, 1.28) },
          { at: 264, ...focus(pad(audio, 60), 1.3), dur: 22 },
          { at: 322, ...focus(pad(audio, 60), 1.3) },
          { at: 342, ...focus(pad(exportArea, 80), 1.3), dur: 20 },
          { at: 440, ...focus(pad(exportArea, 80), 1.3) },
          { at: 462, ...full, dur: 22 },
        ]}
        ptr={[
          { at: 40, x: L.width * 0.62, y: L.height * 0.55 },
          { at: 76, ...P('09-editor', 'tagInput'), dur: 30, click: true },
          { at: 100, ...P('09-editor', 'favorite'), dur: 16, click: true },
          { at: 138, x: R('09-editor', 'startMarker').x + 2, y: R('09-editor', 'startMarker').y + 4, dur: 28 },
          { at: 170, x: R('10-editor-trimmed', 'startMarker').x + 2, y: R('10-editor-trimmed', 'startMarker').y + 4, dur: 26 },
          { at: 266, ...P('11-editor-audio', 'mic'), dur: 28, click: true },
          { at: 340, ...P('11-editor-audio', 'sizeMenu'), dur: 26, click: true },
          { at: 368, ...P('12-editor-size-menu', 'option10'), dur: 20, click: true },
          { at: 396, ...P('11-editor-audio', 'exportButton'), dur: 22, click: true },
          { at: 470, ...P('11-editor-audio', 'exportButton'), dur: 1, hide: true },
        ]}
        spots={[{ from: 278, to: 330, rect: pad(audio, 14), radius: 12 }]}
        videos={[{ from: 180, to: 252, rect: video, src: 'game-won.mp4', trimBefore: 150 }]}
      />
      <FloatingShot layout={layout} name="14-export-complete" from={452} to={510} width={size.width} height={size.height} scale={0.95} y={560} />

      <Caption from={4} to={132} title="Tag the clip." sub="Add tags and favorites from the editor." x={CAP_X} pos="bottom" />
      <Caption from={136} to={258} title="Trim to the moment." sub="Drag the handles. Playback stays inside the trim." x={CAP_X} />
      <Caption from={262} to={334} title="Mute the mic, keep the game." sub="Game and mic audio are separate tracks." x={CAP_X} pos="bottom" />
      <Caption from={338} to={510} title="Export under 10 MB for Discord." sub="Or 50 MB, 100 MB, or the original file." x={CAP_X} />
    </AbsoluteFill>
  )
}

// Feature clip: a clip arrives, preview it, filter, favorite, select in bulk.
export const LIBRARY_FRAMES = 510
export const LibraryFeature: React.FC<{ layout: Layout; posterFrame?: number }> = ({ layout }) => {
  const frame = useCurrentFrame()
  const L = LAYOUTS[layout]
  const R = (shot: string, key: string) => rect(layout, shot, key)
  const P = (shot: string, key: string) => center(R(shot, key))
  const full = { x: L.width / 2, y: L.height / 2, z: 1 }
  const newCard = R('03-library-new-clip', 'newCard')
  const bulkBar = R('08-library-selected', 'bulkBar')
  const fadeIn = interpolate(frame, [0, 14], [0, 1], clamp)
  const filters = union(R('01-library', 'favorites'), R('01-library', 'gameFilter'), R('01-library', 'tagFilter'))

  return (
    <AbsoluteFill>
      <Backdrop />
      <AppScene
        layout={layout}
        fit={FIT}
        offsetY={OFFY}
        opacity={fadeIn}
        shots={[
          { name: '01-library', at: 0 },
          { name: '03-library-new-clip', at: 96, fade: 14 },
          { name: '02-library-hover', at: 196, fade: 8 },
          { name: '05-library-favorites', at: 262, fade: 8 },
          { name: '04-library-filter-game', at: 326, fade: 8 },
          { name: '03-library-new-clip', at: 380, fade: 10 },
          { name: '08-library-selected', at: 420, fade: 8 },
        ]}
        cam={[
          { at: 0, ...full },
          { at: 250, ...full },
          { at: 272, ...center(pad(filters, 200)), z: 1.45, dur: 22 },
          { at: 360, ...center(pad(filters, 200)), z: 1.45 },
          { at: 384, ...full, dur: 24 },
        ]}
        ptr={[
          { at: 150, x: newCard.x + newCard.w * 1.3, y: newCard.y + newCard.h * 1.25 },
          { at: 194, ...P('02-library-hover', 'card'), dur: 34 },
          { at: 258, ...P('01-library', 'favorites'), dur: 26, click: true },
          { at: 322, ...P('01-library', 'gameFilter'), dur: 24, click: true },
          { at: 372, ...P('01-library', 'gameFilter'), dur: 1, click: true },
          { at: 400, x: R('08-library-selected', 'c0').x + R('08-library-selected', 'c0').w - 22, y: R('08-library-selected', 'c0').y + 22, dur: 26, click: true },
          { at: 410, x: R('08-library-selected', 'c2').x + R('08-library-selected', 'c2').w - 22, y: R('08-library-selected', 'c2').y + 22, dur: 10, click: true },
          { at: 420, x: R('08-library-selected', 'c5').x + R('08-library-selected', 'c5').w - 22, y: R('08-library-selected', 'c5').y + 22, dur: 10, click: true },
          { at: 470, ...center(bulkBar), dur: 30 },
        ]}
        spots={[
          { from: 112, to: 186, rect: newCard, radius: 12 },
          { from: 204, to: 252, rect: R('02-library-hover', 'card'), radius: 12, dim: 0.45 },
          { from: 436, to: 510, rect: pad(bulkBar, 6), radius: 10, dim: 0.5 },
        ]}
        labels={[{ from: 120, to: 184, rect: newCard, text: 'Just saved', side: 'top' }]}
      />
      <KeyCap appear={40} press={54} y={880} />
      <SaveToast from={60} to={150} />

      <Caption from={4} to={188} title="One key, and it's in your library." sub="Every clip shows up as soon as it's saved." x={CAP_X} />
      <Caption from={192} to={256} title="Hover to preview." sub="No need to open a clip to find it." x={CAP_X} />
      <Caption from={260} to={392} title="Favorites, tags and games." sub="Filter the library in one click." x={CAP_X} pos="bottom" />
      <Caption from={396} to={510} title="Select several, act once." sub="Tag, favorite, export or delete in bulk." x={CAP_X} />
    </AbsoluteFill>
  )
}
