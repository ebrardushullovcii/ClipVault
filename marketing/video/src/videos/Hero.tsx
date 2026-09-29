import React from 'react'
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { AppScene, stageRect } from '../components/AppScene'
import { Backdrop, Gameplay, KeyCap, SaveToast } from '../components/Parts'
import { LAYOUTS, Layout, center, pad, rect, thumbOf, union } from '../data'

// 12 s seamless loop: win the round, press the hotkey, the clip lands in the library, trim, export.
export const HERO_FRAMES = 360
const FIT = 0.88
const START = 84 // game-won.mp4 frame shown on frame 0 (0:40.8 in the clip)

export const Hero: React.FC<{ layout: Layout; posterFrame?: number }> = ({ layout }) => {
  const frame = useCurrentFrame()
  const r = (shot: string, key: string) => rect(layout, shot, key)
  const newCard = r('03-library-new-clip', 'newCard')
  const cardTarget = stageRect(layout, thumbOf(newCard), undefined, FIT)
  const c = (shot: string, key: string) => center(r(shot, key))
  const start09 = r('09-editor', 'startMarker')
  const start10 = r('10-editor-trimmed', 'startMarker')
  const L = LAYOUTS[layout]
  const full = { x: L.width / 2, y: L.height / 2, z: 1 }
  const focus = (q: { x: number; y: number; w: number; h: number }, z: number) => ({ ...center(q), z })
  const video = r('10-editor-trimmed', 'video')
  const trimArea = pad(union(r('10-editor-trimmed', 'timeline'), { ...video, y: video.y + video.h * 0.55, h: video.h * 0.45 }), 20)
  const exportArea = union(r('11-editor-audio', 'exportButton'), r('11-editor-audio', 'trimOriginal'), r('11-editor-audio', 'sizeMenu'))

  const appOpacity = interpolate(frame, [106, 124, 328, 350], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill>
      <Backdrop />
      <AppScene
        layout={layout}
        fit={FIT}
        opacity={appOpacity}
        shots={[
          { name: '03-library-new-clip', at: 0 },
          { name: '09-editor', at: 196, fade: 10 },
          { name: '10-editor-trimmed', at: 230, fade: 18 },
          { name: '13-editor-exporting', at: 292, fade: 5 },
          { name: '13b-editor-exported', at: 318, fade: 8 },
        ]}
        spots={[{ from: 138, to: 196, rect: newCard, radius: 12 }]}
        labels={[{ from: 146, to: 192, rect: newCard, text: 'Just saved', side: 'top' }]}
        cam={[
          { at: 0, ...full },
          { at: 204, ...full },
          { at: 228, ...focus(trimArea, 1.3), dur: 24 },
          { at: 262, ...focus(trimArea, 1.3) },
          { at: 284, ...focus(pad(exportArea, 90), 1.45), dur: 22 },
          { at: 318, ...focus(pad(exportArea, 90), 1.45) },
          { at: 340, ...full, dur: 22 },
        ]}
        ptr={[
          { at: 160, x: newCard.x + newCard.w * 1.4, y: newCard.y + newCard.h * 1.3 },
          { at: 182, ...center(thumbOf(newCard)), dur: 22, click: true },
          { at: 222, x: start09.x + 2, y: start09.y + 4, dur: 24 },
          { at: 246, x: start10.x + 2, y: start10.y + 4, dur: 20, click: false },
          { at: 286, ...c('10-editor-trimmed', 'exportButton'), dur: 26, click: true },
          { at: 330, ...c('10-editor-trimmed', 'exportButton'), dur: 1, hide: true },
        ]}
      />

      {/* Gameplay: the round win, the hotkey, then it shrinks into the new clip's card. */}
      <Sequence from={0} durationInFrames={150}>
        <Gameplay src="game-won.mp4" trimBefore={START} zoom={[1.04, 1.0]} shrink={{ from: 110, to: 140, rect: cardTarget }} fadeOut={[134, 148]} />
      </Sequence>
      <KeyCap appear={84} press={96} />
      <SaveToast from={100} to={176} />

      {/* Loop seam: fade back to the first gameplay frame. */}
      <Sequence from={330} durationInFrames={30}>
        <Gameplay src="game-won.mp4" trimBefore={START - 30} zoom={[1.04, 1.04]} fadeIn={28} />
      </Sequence>
    </AbsoluteFill>
  )
}
