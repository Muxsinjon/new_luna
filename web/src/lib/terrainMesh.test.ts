import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { meshArrays, localToSurface, surfaceToLocal, sampleGrid, validateTerrain, type TerrainAsset } from './terrainMesh'
import { polarLatLon } from './terrain'
import { DEFAULT_STATE, fromHash, toHash } from './state'
const base = new URL('../../public/data/terrain/site01/', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('terrain.json', base), 'utf8'))
const load = (file: string) => {
  const b = readFileSync(new URL(file, base))
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
const asset: TerrainAsset = { meta, heights: load('elevation.f32'), errors: load('uncertainty.f32'), imageUrl: null }
const arrays = meshArrays(asset)
describe('real NASA Site01 terrain', () => {
  it('verifies checked-in asset checksums and native metadata', () => {
    validateTerrain(asset)
    for (const a of [...Object.values(meta.assets), meta.imagery] as { file: string; sha256: string }[])
      expect(
        createHash('sha256')
          .update(readFileSync(new URL(a.file, base)))
          .digest('hex'),
      ).toBe(a.sha256)
    expect(meta.sources.surf.metadata.resolutionM).toEqual([5, 5])
    expect(meta.sources.surf.metadata.width).toBe(3200)
  })
  it('matches independent native-source checkpoints throughout the subset', () => {
    for (const p of meta.alignment.checkpoints) {
      expect(asset.heights[p.row * meta.width + p.col]).toBeCloseTo(p.elevationM, 5)
      expect(sampleGrid(asset, p.lat, p.lon)).toBeCloseTo(p.elevationM, 5)
      expect(p.projectionErrorM).toBeLessThan(1e-6)
    }
    expect(sampleGrid(asset, -89.53432, 209.94767)).toBeGreaterThan(1600)
    expect(sampleGrid(asset, -89.53432, 209.94767)).toBeLessThan(1700)
  })
  it('round trips curved mesh positions and radial heights at real vertices', () => {
    for (const p of meta.alignment.checkpoints) {
      const ll = polarLatLon(meta.x0 + p.col * meta.dx, meta.y0 + p.row * meta.dy)
      const point = { ...ll, elevationM: p.elevationM },
        local = surfaceToLocal(point, arrays.origin),
        result = localToSurface(local, arrays.origin)
      expect(result.lat).toBeCloseTo(p.lat, 9)
      expect(result.lon).toBeCloseTo(p.lon, 9)
      expect(result.elevationM).toBeCloseTo(point.elevationM, 6)
      const i = p.row * meta.width + p.col
      expect(Math.hypot(...local.map((n, j) => n - arrays.positions[i * 3 + j]))).toBeLessThan(0.002)
    }
    expect(arrays.indices.length).toBe(400 * 400 * 6)
  })
  it('excludes NoData triangles and rejects out-of-coverage or wrong-planet data', () => {
    const missing = asset.heights.slice()
    missing[0] = NaN
    const next = meshArrays({ ...asset, heights: missing })
    expect(next.indices[0]).not.toBe(0)
    expect(next.indices.length).toBe(arrays.indices.length - 3)
    const ll = polarLatLon(meta.x0, meta.y0)
    expect(sampleGrid({ ...asset, heights: missing }, ll.lat, ll.lon)).toBeNull()
    expect(sampleGrid(asset, 0, 0)).toBeNull()
    expect(() => validateTerrain({ ...asset, meta: { ...meta, radiusM: 6378137 } })).toThrow()
    expect(() => validateTerrain({ ...asset, heights: missing.slice(1) })).toThrow()
  })
  it('retains measured source RMS separately from rendering residuals', () => {
    expect(sampleGrid(asset, meta.origin.lat, meta.origin.lon, asset.errors)).toBeGreaterThan(0)
    expect(meta.decimationResidualM.samples).toBe(1601 * 1601)
    expect(meta.decimationResidualM.rms).toBeGreaterThan(0)
  })
  it('maps imagery UV edges to the exact projected vertex bounds', () => {
    const p = JSON.parse(readFileSync(new URL('imagery-provenance.json', base), 'utf8'))
    expect(p.targetBounds).toEqual([meta.x0, meta.y0 + 400 * meta.dy, meta.x0 + 400 * meta.dx, meta.y0])
    expect(Array.from(arrays.uv.slice(0, 2))).toEqual([0, 1])
    expect(Array.from(arrays.uv.slice(-2))).toEqual([1, 0])
  })
  it('round trips shared terrain workspace and landing-site selection', () => {
    const s = { ...DEFAULT_STATE, ws: 'terrain' as const, surfaceSite: 'B' as const }
    expect(fromHash(toHash(s))).toEqual(s)
  })
})
