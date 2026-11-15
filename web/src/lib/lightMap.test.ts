import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2R, R_MOON_KM, enuBasis, unitVec, type Vec3 } from './geometry'
import { lightMap, type PolarGrid } from './lightMap'
import { polarLatLon } from './terrain'

const N = 81
const flat = (): PolarGrid => ({ h: new Int16Array(N * N), n: N, scaleM: 960, offsetPx: N / 2 })
/** Sun direction with elevation el (deg) toward map azimuth along +x (grid east of the pole column) */
function sunAt(elDeg: number, lat: number, lon: number): Vec3 {
  const b = enuBasis(lon, lat)
  // horizontal direction pointing toward +map x at this cell: north=(sin lon, cos lon), east=(cos lon, −sin lon)
  const sl = Math.sin(lon * D2R),
    cl = Math.cos(lon * D2R)
  const n = sl,
    e = cl
  const c = Math.cos(elDeg * D2R),
    s = Math.sin(elDeg * D2R)
  return [0, 1, 2].map((i) => c * (n * b.n[i] + e * b.e[i]) + s * b.u[i]) as Vec3
}

describe('lightMap', () => {
  it('flat ground: Sun up everywhere when high, down when well below the horizon', () => {
    const g = flat()
    const { lat, lon } = polarLatLon(10 * 960, 0)
    expect(lightMap(g, 20, { kind: 'sun', dir: sunAt(5, lat, lon) }).litPct).toBeGreaterThan(95)
    expect(lightMap(g, 20, { kind: 'sun', dir: sunAt(-3, lat, lon) }).litPct).toBe(0)
  })

  it('a wall casts a shadow on the side away from the Sun only', () => {
    const g = flat()
    const wallCol = Math.floor(N / 2) + 8
    for (let r = 0; r < N; r++) for (let c = wallCol; c < wallCol + 2; c++) g.h[r * N + c] = 1500
    const { lat, lon } = polarLatLon(0, -20 * 960) // the Sun lies toward +x from a point at lon 180
    const m = lightMap(g, 20, { kind: 'sun', dir: sunAt(2, lat, lon) })
    const mid = 20
    // west of the wall (toward −x) is in shadow; the wall's own top and the far side are lit
    expect(m.lit[mid * m.size + mid]).toBe(0)
    expect(m.lit[mid * m.size + (wallCol - m.c0)]).toBe(1)
    expect(m.lit[mid * m.size + (wallCol - m.c0 + 4)]).toBe(1)
  })

  it('Earth view uses the topocentric direction and Earth’s angular radius', () => {
    const g = flat()
    // Earth on the horizon line from the pole: only its upper limb (≈0.95°) clears flat ground
    const d = 384_400
    const pos = unitVec(0, 0).map((x) => x * d) as Vec3
    const m = lightMap(g, 10, { kind: 'earth', posKm: pos })
    expect(m.litPct).toBeGreaterThan(30)
  })

  it('real LOLA polar grid: runs on the 85° S window in bounded time and gives a partial light pattern', () => {
    const root = resolve(__dirname, '../../public/data')
    const meta = JSON.parse(readFileSync(resolve(root, 'dem_polar.json'), 'utf8')) as PolarGrid
    const b = readFileSync(resolve(root, 'dem_polar.bin'))
    const g: PolarGrid = { ...meta, h: new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }
    const R = R_MOON_KM * 1000
    const half = Math.ceil((2 * R * Math.tan(Math.PI / 4 - (85 * D2R) / 2)) / g.scaleM)
    const sun: Vec3 = [Math.cos(0.5 * D2R), 0, Math.sin(0.5 * D2R)] // Sun 0.5° above the equator plane, toward lon 0
    const t = performance.now()
    const m = lightMap(g, half, { kind: 'sun', dir: sun })
    expect(performance.now() - t).toBeLessThan(5000)
    expect(m.litPct).toBeGreaterThan(5)
    expect(m.litPct).toBeLessThan(95)
  })
})
