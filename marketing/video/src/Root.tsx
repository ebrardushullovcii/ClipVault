import React from 'react'
import { Composition } from 'remotion'
import { Hero, HERO_FRAMES } from './videos/Hero'
import { Tour, TOUR_FRAMES } from './videos/Tour'
import { LibraryFeature, LIBRARY_FRAMES, TrimExport, TRIM_FRAMES } from './videos/Features'
import { FPS, STAGE } from './theme'
import type { Layout } from './data'
import { LaunchFilm, LAUNCH_FRAMES } from './motion/LaunchFilm'
import { Exploded, EXPLODED_FRAMES } from './motion/Exploded'
import { Vertical, VERTICAL_FRAMES } from './motion/Vertical'
import { Bento, BENTO_FRAMES } from './motion/Bento'

const LAYOUTS: Layout[] = ['wide', 'compact']
const VIDEOS = [
  { id: 'hero', component: Hero, frames: HERO_FRAMES, poster: 165 },
  { id: 'tour', component: Tour, frames: TOUR_FRAMES, poster: 640 },
  { id: 'trim-export', component: TrimExport, frames: TRIM_FRAMES, poster: 200 },
  { id: 'library', component: LibraryFeature, frames: LIBRARY_FRAMES, poster: 150 },
]

export const Root: React.FC = () => (
  <>
    {VIDEOS.flatMap(v =>
      LAYOUTS.map(layout => (
        <Composition
          key={`${v.id}-${layout}`}
          id={`${v.id}-${layout}`}
          component={v.component}
          durationInFrames={v.frames}
          fps={FPS}
          width={STAGE.width}
          height={STAGE.height}
          defaultProps={{ layout, posterFrame: v.poster }}
        />
      ))
    )}
    <Composition id="launch-film" component={LaunchFilm} durationInFrames={LAUNCH_FRAMES} fps={60} width={1920} height={1080} defaultProps={{ posterFrame: 2030 }} />
    <Composition id="exploded" component={Exploded} durationInFrames={EXPLODED_FRAMES} fps={60} width={1920} height={1080} defaultProps={{ posterFrame: 300 }} />
    <Composition id="vertical" component={Vertical} durationInFrames={VERTICAL_FRAMES} fps={60} width={1080} height={1920} defaultProps={{ posterFrame: 230 }} />
    <Composition id="bento-wide" component={Bento} durationInFrames={BENTO_FRAMES} fps={60} width={1920} height={1080} defaultProps={{ square: false, posterFrame: 200 }} />
    <Composition id="bento-square" component={Bento} durationInFrames={BENTO_FRAMES} fps={60} width={1080} height={1080} defaultProps={{ square: true, posterFrame: 200 }} />
  </>
)
