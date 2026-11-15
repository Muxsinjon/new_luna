// Lit-terrain map of the south pole at one moment (idea adapted from astoreyai/lunar-lighting-planner).
// For every cell of the polar LOLA grid, march along the body's local azimuth and test the terrain against the
// body's upper limb with exact spherical geometry (no refraction). Pure function, no DOM.
import { D2R, R_MOON_KM, enuBasis, unitVec, type Vec3 } from './geometry'
import { R_EARTH_KM, SUN_RADIUS_DEG } from './physics/disc'
import { polarLatLon } from './terrain'

const R_M = R_MOON_KM * 1000

export interface PolarGrid {
  h: Int16Array
  n: number
  scaleM: number
  offsetPx: number
}
export type LightTarget = { kind: 'sun'; dir: Vec3 } | { kind: 'earth'; posKm: Vec3 }

export interface LightMap {
  /** first grid row / col and side length (cells) of the window */
  r0: number
  c0: number
  size: number
  /** 1 = body (upper limb) above the terrain, 0 = hidden or below the horizon */
  lit: Uint8Array
  /** Lambert shading of the ground by the body, 0..1 (0 where hidden) */
  shade: Float32Array
  /** share of cells where the body is up, % */
  litPct: number
}

function sample(g: PolarGrid, row: number, col: number): number {
  const r0 = Math.floor(row),
    c0 = Math.floor(col)
  if (r0 < 0 || c0 < 0 || r0 >= g.n - 1 || c0 >= g.n - 1) return NaN
  const fr = row - r0,
    fc = col - c0,
    i = r0 * g.n + c0
  const a = g.h[i] * (1 - fc) + g.h[i + 1] * fc
  const b = g.h[i + g.n] * (1 - fc) + g.h[i + g.n + 1] * fc
  return a * (1 - fr) + b * fr
}

/**
 * Light (or Earth view) for a square window of the polar grid centred on the pole.
 * @param halfCells half the window side in cells
 * @param obsM observer height above the ground (m)
 * @param maxKm how far each ray is marched (km)
 */
export function lightMap(g: PolarGrid, halfCells: number, target: LightTarget, obsM = 2, maxKm = 200): LightMap {
  const size = 2 * halfCells
  const r0 = Math.round(g.offsetPx - halfCells),
    c0 = r0
  const lit = new Uint8Array(size * size)
  const shade = new Float32Array(size * size)
  let hMax = -Infinity
  for (let i = 0; i < g.h.length; i++) if (g.h[i] > hMax) hMax = g.h[i]
  const stepM = g.scaleM
  const steps = Math.floor((maxKm * 1000) / stepM)
  const sinT = new Float64Array(steps + 1),
    cosT = new Float64Array(steps + 1)
  for (let k = 1; k <= steps; k++) {
    sinT[k] = Math.sin((k * stepM) / R_M)
    cosT[k] = Math.cos((k * stepM) / R_M)
  }
  let up = 0,
    total = 0
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const row = r0 + r,
        col = c0 + c
      if (row < 1 || col < 1 || row >= g.n - 1 || col >= g.n - 1) continue
      const x = (col + 0.5 - g.offsetPx) * g.scaleM
      const y = (g.offsetPx - row - 0.5) * g.scaleM
      const { lat, lon } = polarLatLon(x, y)
      const h0 = g.h[row * g.n + col]
      const b = enuBasis(lon, lat)
      let d: Vec3, radiusDeg: number
      if (target.kind === 'sun') {
        d = target.dir
        radiusDeg = SUN_RADIUS_DEG
      } else {
        const p = unitVec(lon, lat)
        const rk = (R_M + h0) / 1000
        const v: Vec3 = [target.posKm[0] - p[0] * rk, target.posKm[1] - p[1] * rk, target.posKm[2] - p[2] * rk]
        const len = Math.hypot(v[0], v[1], v[2])
        d = [v[0] / len, v[1] / len, v[2] / len]
        radiusDeg = Math.asin(R_EARTH_KM / len) / D2R
      }
      const de = d[0] * b.e[0] + d[1] * b.e[1] + d[2] * b.e[2]
      const dn = d[0] * b.n[0] + d[1] * b.n[1] + d[2] * b.n[2]
      const du = d[0] * b.u[0] + d[1] * b.u[1] + d[2] * b.u[2]
      const limb = Math.atan2(du, Math.hypot(de, dn)) + radiusDeg * D2R
      total++
      const k0 = r * size + c
      if (limb < -0.2) continue // deeper than any dip a 20 km-high observer could see
      // local north/east in grid (col, row) units: north = (sin lon, cos lon) in map x/y, row grows with −y
      const sl = Math.sin(lon * D2R),
        cl = Math.cos(lon * D2R)
      const hz = Math.hypot(de, dn) || 1
      const mx = (dn * sl + de * cl) / hz, // map x component of the horizontal direction
        my = (dn * cl - de * sl) / hz
      const tanL = Math.tan(limb)
      const ro = R_M + h0 + obsM
      let blocked = false
      for (let k = 1; k <= steps; k++) {
        // past the turning point, if even the highest terrain could not block, stop
        if (k * stepM > -limb * R_M && (R_M + hMax) * (cosT[k] - tanL * sinT[k]) < ro) break
        const hs = sample(g, row - 0.5 - my * k, col - 0.5 + mx * k)
        if (Number.isNaN(hs)) break
        const rp = R_M + hs
        if (rp * cosT[k] - ro > tanL * rp * sinT[k]) {
          blocked = true
          break
        }
      }
      if (blocked) continue
      lit[k0] = 1
      up++
      // Lambert shading with the local slope (central differences, map frame)
      const dzdx = (g.h[row * g.n + col + 1] - g.h[row * g.n + col - 1]) / (2 * g.scaleM)
      const dzdy = (g.h[(row - 1) * g.n + col] - g.h[(row + 1) * g.n + col]) / (2 * g.scaleM)
      const ch = Math.cos(limb - radiusDeg * D2R),
        sh = Math.sin(Math.max(0, limb - radiusDeg * D2R))
      const lam = (-dzdx * mx * ch - dzdy * my * ch + sh) / Math.sqrt(1 + dzdx * dzdx + dzdy * dzdy)
      shade[k0] = Math.max(0, Math.min(1, lam * 4 + 0.35))
    }
  return { r0, c0, size, lit, shade, litPct: total ? (100 * up) / total : 0 }
}
