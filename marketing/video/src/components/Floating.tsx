import React from 'react'
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Layout } from '../data'

// A secondary app window (the export-complete preview) floating over the scene.
export const FloatingShot: React.FC<{ layout: Layout; name: string; from: number; to: number; width: number; height: number; scale?: number; x?: number; y?: number }> = ({
  layout,
  name,
  from,
  to,
  width,
  height,
  scale = 0.95,
  x = 960,
  y = 560,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (frame < from || frame > to) return null
  const s = spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 150 } })
  const out = interpolate(frame, [to - 8, to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const w = width * scale
  const h = height * scale
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: 12,
        overflow: 'hidden',
        opacity: s * out,
        transform: `translateY(${(1 - s) * 40}px) scale(${0.96 + 0.04 * s})`,
        boxShadow: '0 60px 160px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.12)',
        background: '#1a1a1a',
      }}
    >
      <Img src={staticFile(`shots/${layout}/${name}.png`)} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
