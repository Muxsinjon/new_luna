import { D2R, enuBasis, unitVec, type Vec3 } from './geometry'
import { polarXY, polarLatLon } from './terrain'

export interface SurfacePoint {
  lat: number
  lon: number
  elevationM: number
}
interface AssetFile {
  file: string
  sha256: string
  min: number
  max: number
  median: number
}
export interface TerrainMeta {
  version: number
  width: number
  height: number
  x0: number
  y0: number
  dx: number
  dy: number
  radiusM: number
  projection: string
  frame: string
  origin: { lat: number; lon: number }
  sourceResolutionM: number
  assets: { surf: AssetFile; toterr: AssetFile }
  decimationResidualM: { rms: number; p95Abs: number; maxAbs: number }
  uncertaintyNote: string
  sources: Record<string, { url: string; file: string; sha256: string }>
  imagery: null | { file: string; sha256: string; title: string; url: string; note: string }
}
export interface TerrainAsset {
  meta: TerrainMeta
  heights: Float32Array
  errors: Float32Array
  imageUrl: string | null
}
const R = 1737400
export const terrainBase = `${import.meta.env.BASE_URL}data/terrain/site01/`

export function validateTerrain(asset: TerrainAsset) {
  const { meta: m, heights, errors } = asset
  if (
    m.version !== 1 ||
    m.radiusM !== R ||
    m.projection !== 'south-polar-stereographic' ||
    ![m.width, m.height].every((n) => Number.isInteger(n) && n >= 2 && n <= 1025) ||
    ![m.x0, m.y0, m.dx, m.dy, m.origin.lat, m.origin.lon].every(Number.isFinite) ||
    m.dx <= 0 ||
    m.dy >= 0 ||
    heights.length !== m.width * m.height ||
    errors.length !== heights.length ||
    !heights.some(Number.isFinite)
  ) {
    throw new Error('Unsupported or incomplete lunar terrain asset')
  }
}
/** Never clamp coordinates or bridge NoData gaps. Grid values are radial elevations/RMS errors. */
export function sampleGrid(asset: TerrainAsset, lat: number, lon: number, values = asset.heights): number | null {
  const { meta: m } = asset,
    { x, y } = polarXY(lat, lon)
  const c = (x - m.x0) / m.dx,
    r = (y - m.y0) / m.dy
  if (![c, r].every(Number.isFinite) || c < -1e-8 || r < -1e-8 || c > m.width - 1 + 1e-8 || r > m.height - 1 + 1e-8) return null
  const c0 = Math.max(0, Math.min(m.width - 2, Math.floor(c))),
    r0 = Math.max(0, Math.min(m.height - 2, Math.floor(r)))
  const a = [values[r0 * m.width + c0], values[r0 * m.width + c0 + 1], values[(r0 + 1) * m.width + c0], values[(r0 + 1) * m.width + c0 + 1]]
  if (!a.every(Number.isFinite)) return null
  const fc = Math.max(0, Math.min(1, c - c0)),
    fr = Math.max(0, Math.min(1, r - r0))
  return (a[0] * (1 - fc) + a[1] * fc) * (1 - fr) + (a[2] * (1 - fc) + a[3] * fc) * fr
}
/** Curved lunar surface in metres, local X east, Y up, Z south. */
export function surfaceToLocal(p: SurfacePoint, origin: SurfacePoint): Vec3 {
  const b = enuBasis(origin.lon, origin.lat),
    u = unitVec(p.lon, p.lat),
    o = unitVec(origin.lon, origin.lat)
  const v = u.map((n, i) => n * (R + p.elevationM) - o[i] * (R + origin.elevationM))
  const dot = (a: Vec3) => v.reduce((s, n, i) => s + n * a[i], 0)
  return [dot(b.e), dot(b.u), -dot(b.n)]
}
export function localToSurface(p: Vec3, origin: SurfacePoint): SurfacePoint {
  const b = enuBasis(origin.lon, origin.lat),
    u = unitVec(origin.lon, origin.lat)
  const v = u.map((n, i) => n * (R + origin.elevationM) + b.e[i] * p[0] + b.u[i] * p[1] - b.n[i] * p[2])
  return {
    lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) / D2R,
    lon: (((Math.atan2(v[1], v[0]) / D2R) % 360) + 360) % 360,
    elevationM: Math.hypot(...v) - R,
  }
}
export function meshArrays(asset: TerrainAsset) {
  validateTerrain(asset)
  const { meta: m, heights: h } = asset
  const origin = { ...m.origin, elevationM: sampleGrid(asset, m.origin.lat, m.origin.lon) ?? 0 }
  const positions = new Float32Array(h.length * 3),
    uv = new Float32Array(h.length * 2),
    indices: number[] = []
  for (let r = 0; r < m.height; r++)
    for (let c = 0; c < m.width; c++) {
      const i = r * m.width + c,
        ll = polarLatLon(m.x0 + c * m.dx, m.y0 + r * m.dy)
      positions.set(surfaceToLocal({ ...ll, elevationM: Number.isFinite(h[i]) ? h[i] : 0 }, origin), i * 3)
      uv.set([c / (m.width - 1), 1 - r / (m.height - 1)], i * 2)
    }
  for (let r = 0; r < m.height - 1; r++)
    for (let c = 0; c < m.width - 1; c++) {
      const a = r * m.width + c,
        b = a + 1,
        d = a + m.width,
        e = d + 1
      for (const tri of [
        [a, d, b],
        [b, d, e],
      ])
        if (tri.every((i) => Number.isFinite(h[i]))) indices.push(...tri)
    }
  if (!indices.length) throw new Error('No valid terrain triangles')
  return { origin, positions, uv, indices: new Uint32Array(indices) }
}
async function checkedFile(file: { file: string; sha256: string }, signal?: AbortSignal) {
  const r = await fetch(terrainBase + file.file, { signal })
  if (!r.ok) throw new Error(`Could not load terrain ${file.file} (HTTP ${r.status})`)
  const bytes = await r.arrayBuffer(),
    hash = await crypto.subtle.digest('SHA-256', bytes)
  if (Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('') !== file.sha256)
    throw new Error('Terrain checksum mismatch')
  return bytes
}
function decode(bytes: ArrayBuffer) {
  if (bytes.byteLength % 4) throw new Error('Truncated terrain file')
  const view = new DataView(bytes),
    out = new Float32Array(bytes.byteLength / 4)
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true)
  return out
}
export async function loadTerrainAsset(signal?: AbortSignal): Promise<TerrainAsset> {
  const r = await fetch(terrainBase + 'terrain.json', { signal })
  if (!r.ok) throw new Error(`Could not load terrain metadata (HTTP ${r.status})`)
  const meta: TerrainMeta = await r.json()
  const [h, e, image] = await Promise.all([
    checkedFile(meta.assets.surf, signal),
    checkedFile(meta.assets.toterr, signal),
    meta.imagery ? checkedFile(meta.imagery, signal) : null,
  ])
  const asset = { meta, heights: decode(h), errors: decode(e), imageUrl: null as string | null }
  validateTerrain(asset)
  if (image) asset.imageUrl = URL.createObjectURL(new Blob([image], { type: 'image/jpeg' }))
  return asset
}
