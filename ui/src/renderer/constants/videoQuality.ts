export const qualityPresets = {
  compact: {
    quality: 30,
    label: 'Compact',
    description: 'Uses the least RAM and storage. Fast motion may look softer.',
    videoBitrateMbps: 6,
  },
  efficient: {
    quality: 27,
    label: 'Efficient',
    description: 'Uses less RAM and storage with good everyday quality.',
    videoBitrateMbps: 9,
  },
  balanced: {
    quality: 23,
    label: 'Balanced',
    description: 'Clear 1080p60 video with moderate RAM and storage use.',
    videoBitrateMbps: 15,
  },
  detailed: {
    quality: 18,
    label: 'Detailed',
    description: 'Keeps motion sharper but uses much more RAM and storage.',
    videoBitrateMbps: 28,
  },
  maximum: {
    quality: 15,
    label: 'Maximum',
    description: 'Best image quality. Uses the most RAM and storage.',
    videoBitrateMbps: 42,
  },
} as const

export type QualityPresetId = keyof typeof qualityPresets

export const qualityPresetIds = Object.keys(qualityPresets) as QualityPresetId[]

// Preserve the behavior of settings written by older ClipVault versions while
// assigning every value to the closest supported quality level.
export const getQualityPresetId = (quality: number): QualityPresetId => {
  if (quality <= 15) return 'maximum'
  if (quality <= 18) return 'detailed'
  if (quality <= 23) return 'balanced'
  if (quality <= 27) return 'efficient'
  return 'compact'
}
