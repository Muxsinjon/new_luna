import { loadHazards, type HazardData } from './hazardAnalysis'
import { loadTerrainAsset, type TerrainAsset } from './terrainMesh'

/**
 * Session cache of verified terrain + hazard layers for the comparison views. Each site is fetched and
 * checksum-verified once; remounting a pane or returning to the workspace reuses it instead of cancelling and
 * re-downloading ~12 MB. A failed load is evicted so "Retry" fetches again.
 */
const cache = new Map<string, Promise<{ asset: TerrainAsset; hazards: HazardData }>>()
export function loadSiteLayers(siteId: string) {
  let p = cache.get(siteId)
  if (!p) {
    const abort = new AbortController() // never aborted: callers ignore results they no longer need
    p = Promise.all([loadTerrainAsset(abort.signal, siteId), loadHazards(abort.signal, siteId)]).then(([asset, hazards]) => ({
      asset,
      hazards,
    }))
    p.catch(() => cache.delete(siteId))
    cache.set(siteId, p)
  }
  return p
}
