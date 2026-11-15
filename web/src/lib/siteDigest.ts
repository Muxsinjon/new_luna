// Plain-word summary of one site for the Surface View cards (idea adapted from astoreyai/lunar-lighting-planner):
// Sun and Earth right now, sunlight share, longest night and whether Earth is always / sometimes / never in view.
// Built only from hourly samples (a sample at t covers [t, t + 1 h)); no sub-hour claims.
import type { Sample } from './analysis'
import { SUN_RADIUS_DEG } from './physics/disc'
import { type VisModel, signal } from './visibility'

export type EarthClass = 'always' | 'sometimes' | 'never'
export interface SiteDigest {
  hours: number
  sunPct: number
  earthPct: number
  /** longest unbroken run of hours without the Sun */
  longestNightH: number
  earth: EarthClass
  /** the Sun state right now, in words */
  sunState: 'sunlit' | 'behind terrain' | 'night'
  earthState: 'in view' | 'behind terrain' | 'below the horizon'
}

export function siteDigest(samples: Sample[], model: VisModel = 'terrain'): SiteDigest | null {
  if (!samples.length) return null
  let sun = 0,
    earth = 0,
    run = 0,
    longest = 0
  for (const s of samples) {
    const up = signal(s, 'sun', model) > 0
    if (up) {
      sun++
      run = 0
    } else longest = Math.max(longest, ++run)
    if (signal(s, 'earth', model) > 0) earth++
  }
  const n = samples.length
  const s0 = samples[0]
  const sunUp = signal(s0, 'sun', model) > 0
  const earthUp = signal(s0, 'earth', model) > 0
  return {
    hours: n,
    sunPct: (100 * sun) / n,
    earthPct: (100 * earth) / n,
    longestNightH: longest,
    earth: earth === n ? 'always' : earth === 0 ? 'never' : 'sometimes',
    sunState: sunUp ? 'sunlit' : s0.sunEl + SUN_RADIUS_DEG > 0 && model === 'terrain' ? 'behind terrain' : 'night',
    earthState: earthUp ? 'in view' : s0.earthEl + s0.earthRadiusDeg > 0 && model === 'terrain' ? 'behind terrain' : 'below the horizon',
  }
}
