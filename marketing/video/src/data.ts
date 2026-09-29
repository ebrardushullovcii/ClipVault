import wideRects from '../public/shots/wide/rects.json'
import compactRects from '../public/shots/compact/rects.json'

export type Layout = 'wide' | 'compact'
export type Rect = { x: number; y: number; w: number; h: number }

export const LAYOUTS: Record<Layout, { width: number; height: number }> = {
  wide: { width: 1600, height: 1000 },
  compact: { width: 1280, height: 800 },
}

const RECTS: Record<Layout, Record<string, Record<string, Rect | null>>> = {
  wide: wideRects as never,
  compact: compactRects as never,
}

export const rect = (layout: Layout, shot: string, key: string): Rect => {
  const r = RECTS[layout][shot]?.[key]
  if (!r) throw new Error(`No rect ${layout}/${shot}/${key}`)
  return r
}

export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

// Thumbnail area of a grid card (16:9 at the top of the card).
export const thumbOf = (card: Rect): Rect => ({ x: card.x, y: card.y, w: card.w, h: (card.w * 9) / 16 })

export const pad = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p })

export const union = (...rs: Rect[]): Rect => {
  const x = Math.min(...rs.map(r => r.x))
  const y = Math.min(...rs.map(r => r.y))
  const x2 = Math.max(...rs.map(r => r.x + r.w))
  const y2 = Math.max(...rs.map(r => r.y + r.h))
  return { x, y, w: x2 - x, h: y2 - y }
}

export const SAVED_PATH = 'C:\\Users\\Player\\Videos\\ClipVault\\2026-09-28_23-30-00_VALORANT.mp4'
