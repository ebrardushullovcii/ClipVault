import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { C } from '../theme'

// Drawn mouse pointer; (x, y) is the arrow tip in stage pixels.
export const Pointer: React.FC<{ x: number; y: number; clicks: number[]; appear: number }> = ({ x, y, clicks, appear }) => {
  const frame = useCurrentFrame()
  const recent = clicks.filter(c => frame >= c && frame < c + 16).pop()
  const press = recent !== undefined ? interpolate(frame - recent, [0, 3, 8], [1, 0.84, 1], { extrapolateRight: 'clamp' }) : 1
  const fade = interpolate(frame, [appear, appear + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <>
      {recent !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: 0,
            height: 0,
          }}
        >
          {[0, 5].map(delay => {
            const t = interpolate(frame - recent - delay, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            if (t <= 0 || t >= 1) return null
            const size = 18 + t * 70
            return (
              <div
                key={delay}
                style={{
                  position: 'absolute',
                  left: -size / 2,
                  top: -size / 2,
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  border: `3px solid ${C.accent}`,
                  opacity: (1 - t) * 0.9,
                }}
              />
            )
          })}
        </div>
      )}
      <svg
        width={40}
        height={40}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: x - 5,
          top: y - 3,
          opacity: fade,
          transform: `scale(${press})`,
          transformOrigin: '5px 3px',
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))',
        }}
      >
        <path d="M5 3 L5 20 L9.5 15.8 L12.6 22.2 L15.4 20.9 L12.4 14.6 L18.5 14.6 Z" fill="#ffffff" stroke="#0a0a0a" strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
    </>
  )
}
