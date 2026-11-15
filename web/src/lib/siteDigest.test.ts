import { describe, expect, it } from 'vitest'
import type { Sample } from './analysis'
import { siteDigest } from './siteDigest'

const mk = (sunUpper: number, earthUpper: number, sunEl = sunUpper, earthEl = earthUpper): Sample => ({
  t: 0,
  sunAz: 0,
  sunEl,
  sunHorizon: 0,
  sunMargin: sunUpper - 0.27,
  sunUpper,
  sunFrac: sunUpper > 0 ? 1 : 0,
  earthAz: 0,
  earthEl,
  earthHorizon: 0,
  earthMargin: earthUpper - 0.95,
  earthUpper,
  earthFrac: earthUpper > 0 ? 1 : 0,
  earthRadiusDeg: 0.95,
  earthDistKm: 384_400,
})

describe('siteDigest', () => {
  it('counts sunlit hours, the longest night and the Earth class', () => {
    const s = [mk(1, 1), mk(1, 1), mk(-1, 1), mk(-1, 1), mk(-1, 1), mk(1, 1), mk(-1, 1)]
    const d = siteDigest(s)!
    expect(d.hours).toBe(7)
    expect(d.sunPct).toBeCloseTo((100 * 3) / 7)
    expect(d.longestNightH).toBe(3)
    expect(d.earth).toBe('always')
    expect(d.sunState).toBe('sunlit')
  })
  it('names terrain blocking separately from night', () => {
    // Sun 1° above the flat horizon but hidden by a 3° ridge
    expect(siteDigest([mk(-1.7, -5, 1, -5)])!.sunState).toBe('behind terrain')
    expect(siteDigest([mk(-3, -5, -3, -5)])!.sunState).toBe('night')
    expect(siteDigest([mk(-3, -5, -3, -5)])!.earth).toBe('never')
    expect(siteDigest([mk(1, -1), mk(1, 1)])!.earth).toBe('sometimes')
  })
  it('returns null without samples', () => expect(siteDigest([])).toBeNull())
})
