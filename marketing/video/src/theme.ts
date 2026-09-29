import { loadFont } from '@remotion/google-fonts/Inter'

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] })

export const FONT = fontFamily
export const FPS = 30
export const STAGE = { width: 1920, height: 1080 }

export const C = {
  bg: '#08090a',
  bg2: '#0f1012',
  panel: 'rgba(16,17,19,0.86)',
  line: 'rgba(255,255,255,0.09)',
  text: '#f4f5f6',
  muted: 'rgba(244,245,246,0.62)',
  accent: '#00d4aa',
  accentSoft: 'rgba(0,212,170,0.18)',
}
