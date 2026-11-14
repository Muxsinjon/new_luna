import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import {
  analysisAt,
  classify,
  footprint,
  loadHazards,
  valuesAtIndex,
  type AnalysisLayer,
  type Criteria,
  type HazardData,
} from '../lib/hazardAnalysis'
import { type SurfacePoint, type TerrainAsset } from '../lib/terrainMesh'
import { cssVar, hexToRgb } from '../lib/theme'
export interface HazardVisual {
  texture: THREE.Texture | null
  footprint: { point: SurfacePoint; radius: number } | null
  layer: AnalysisLayer
}
export default function HazardPanel({
  asset,
  point,
  theme,
  onVisual,
}: {
  asset: TerrainAsset
  point: SurfacePoint | null
  theme: string
  onVisual: (v: HazardVisual) => void
}) {
  const [data, setData] = useState<HazardData | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0)
  const [layer, setLayer] = useState<AnalysisLayer>('elevation'),
    [maxSlope, setMaxSlope] = useState(10),
    [maxRough, setMaxRough] = useState(0.3),
    [radius, setRadius] = useState(100)
  useEffect(() => {
    const a = new AbortController()
    loadHazards(a.signal)
      .then((d) => {
        if (
          d.meta.x0 !== asset.meta.x0 ||
          d.meta.y0 !== asset.meta.y0 ||
          d.meta.sourceSha256 !== asset.meta.sources.surf.sha256 ||
          (d.meta.width - 1) * d.meta.dx !== (asset.meta.width - 1) * asset.meta.dx ||
          (d.meta.height - 1) * d.meta.dy !== (asset.meta.height - 1) * asset.meta.dy
        )
          throw new Error('Scientific layer does not align with elevation source')
        if (!a.signal.aborted) setData(d)
      })
      .catch((e: Error) => {
        if (!a.signal.aborted) setError(e.message)
      })
    return () => a.abort()
  }, [asset, retry])
  const criteria = useMemo<Criteria>(() => ({ slope: maxSlope, roughness: maxRough }), [maxSlope, maxRough])
  const values = data && point ? analysisAt(data, point.lat, point.lon) : null
  const stats = useMemo(
    () => (data && point ? footprint(data, point.lat, point.lon, radius, point.elevationM, criteria) : null),
    [data, point, radius, criteria],
  )
  const texture = useMemo(() => {
    if (!data || layer === 'elevation') return null
    const canvas = document.createElement('canvas')
    canvas.width = data.meta.width
    canvas.height = data.meta.height
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(canvas.width, canvas.height)
    const low = hexToRgb(cssVar('--c-earth')),
      high = hexToRgb(cssVar('--c-warn')),
      yes = hexToRgb(cssVar('--c-both')),
      none = hexToRgb(cssVar('--c-none'))
    for (let i = 0; i < data.slope.length; i++) {
      const v = valuesAtIndex(data, i),
        state = classify(v.slope, v.roughness, criteria)
      const value = layer === 'slope' ? v.slope : v.roughness
      const t = value === null ? 0 : Math.max(0, Math.min(1, value / (layer === 'slope' ? 30 : 1)))
      const rgb =
        layer === 'hazard'
          ? state === 'meets'
            ? yes
            : state === 'exceeds'
              ? high
              : none
          : value === null
            ? none
            : low.map((c, j) => Math.round(c * (1 - t) + high[j] * t))
      image.data.set([...rgb, 255], i * 4)
    }
    ctx.putImageData(image, 0, 0)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    result.minFilter = THREE.NearestFilter
    result.magFilter = THREE.NearestFilter
    result.generateMipmaps = false
    result.repeat.set((canvas.width - 1) / canvas.width, (canvas.height - 1) / canvas.height)
    result.offset.set(0.5 / canvas.width, 0.5 / canvas.height)
    return result
    // Theme is a DOM token dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layer, criteria, theme])
  useEffect(
    () => () => {
      texture?.dispose()
    },
    [texture],
  )
  const boundary = useMemo(() => (point && stats ? { point, radius: stats.projectedRadiusM } : null), [point, stats])
  useEffect(() => {
    onVisual({ texture, footprint: boundary, layer })
  }, [texture, boundary, layer, onVisual])
  const state = values ? classify(values.slope, values.roughness, criteria) : 'insufficient'
  const format = (n: number | null, unit: string) => (n === null ? 'Unavailable' : `${n.toFixed(unit === '°' ? 2 : 3)} ${unit}`)
  return (
    <section className="panel" aria-labelledby="hazard-heading">
      <h3 id="hazard-heading">Scientific terrain analysis</h3>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button
            className="btn"
            onClick={() => {
              setError('')
              setRetry((v) => v + 1)
            }}
          >
            Retry analysis
          </button>
        </p>
      ) : !data ? (
        <p role="status">Loading source-derived scientific layers…</p>
      ) : (
        <>
          <p className="hint" data-testid="slope-method-warning">
            Slope screening uses our 3 × 3 OLS fitted plane, not NASA’s supplied slope raster. Estimator choice can change threshold
            classifications: full-crop comparison differs by {data.meta.officialComparison.rmsDifferenceDeg.toFixed(3)}° RMS and up to{' '}
            {data.meta.officialComparison.maxAbsDifferenceDeg.toFixed(3)}°. Agreement with a central-gradient reconstruction does not
            establish the exact NASA method.
          </p>
          <div className="terrain-toolbar">
            <label className="field">
              Analysis layer
              <select aria-label="Analysis layer" value={layer} onChange={(e) => setLayer(e.target.value as AnalysisLayer)}>
                {(['elevation', 'slope', 'roughness', 'hazard'] as const).map((l) => (
                  <option key={l} value={l}>
                    {l === 'hazard' ? 'Hazard Assessment' : l === 'slope' ? 'Slope (3×3 OLS)' : l[0].toUpperCase() + l.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Maximum slope (degrees; 15 m support)
              <input
                aria-label="Maximum slope"
                type="number"
                min="0"
                max="90"
                step="1"
                value={Number.isFinite(maxSlope) ? maxSlope : ''}
                onChange={(e) => setMaxSlope(e.target.valueAsNumber)}
              />
            </label>
            <label className="field">
              Maximum roughness (m RMS; 25 m support)
              <input
                aria-label="Maximum roughness"
                type="number"
                min="0"
                step="0.05"
                value={Number.isFinite(maxRough) ? maxRough : ''}
                onChange={(e) => setMaxRough(e.target.valueAsNumber)}
              />
            </label>
            <label className="field">
              Circular footprint radius (m)
              <input
                aria-label="Footprint radius"
                type="number"
                min="5"
                max="2000"
                step="25"
                value={Number.isFinite(radius) ? radius : ''}
                onChange={(e) => setRadius(e.target.valueAsNumber)}
              />
            </label>
          </div>
          <p className="hint">
            Threshold defaults are illustrative, not NASA safety standards. Native analysis sampling: 5 m; displayed mesh: 20 m. Slope: 3 ×
            3 fitted plane (15 m pixel support, 10 m centre span). Roughness: detrended RMS over 5 × 5 pixels (25 m support, 20 m centre
            span). Quantization ±0.0005 in each unit.
          </p>
          <p className="hint">
            Point metrics use the nearest 5 m sample centre, not the interpolated mesh face. Extra decimals describe computation/encoding,
            not measurement accuracy.
          </p>
          <p data-testid="analysis-legend">
            {layer === 'slope'
              ? 'OLS fitted-plane slope legend: blue 0° → orange ≥30°; gray unavailable.'
              : layer === 'roughness'
                ? 'Roughness legend: blue 0 m → orange ≥1 m RMS; gray unavailable.'
                : layer === 'hazard'
                  ? 'Hazard legend: green meets selected terrain criteria; orange exceeds; gray insufficient.'
                  : 'Elevation: shaded radial height (m), 1× scale.'}
          </p>
          <div data-testid="hazard-point" data-slope={values?.slope ?? undefined} data-roughness={values?.roughness ?? undefined}>
            <strong>
              Point:{' '}
              {state === 'meets'
                ? 'Meets selected terrain criteria'
                : state === 'exceeds'
                  ? 'Exceeds selected terrain criteria'
                  : 'Insufficient or unavailable data'}
            </strong>
            <p>
              Slope (3×3 OLS) {format(values?.slope ?? null, '°')}; roughness {format(values?.roughness ?? null, 'm')}.
            </p>
            {state === 'exceeds' && (
              <p>
                {values?.slope !== null && values && values.slope > maxSlope ? 'Slope exceeds the selected maximum. ' : ''}
                {values?.roughness !== null && values && values.roughness > maxRough ? 'Roughness exceeds the selected maximum.' : ''}
              </p>
            )}
          </div>
          <div
            data-testid="footprint-summary"
            data-valid={stats?.valid}
            data-total={stats?.total}
            data-meets={stats?.meets}
            data-slope-min={stats?.slope?.min}
            data-slope-mean={stats?.slope?.mean}
            data-slope-max={stats?.slope?.max}
            data-roughness-min={stats?.roughness?.min}
            data-roughness-mean={stats?.roughness?.mean}
            data-roughness-max={stats?.roughness?.max}
          >
            <h4>Circular footprint summary</h4>
            {stats ? (
              <>
                <p>
                  {stats.valid} valid / {stats.total} selected 5 m sample centres; data coverage {stats.coveragePct.toFixed(1)}%.{' '}
                  {stats.meetsPct === null
                    ? 'Criteria unavailable'
                    : `${stats.meetsPct.toFixed(1)}% of valid samples meet both criteria (${stats.meets} samples).`}
                </p>
                <p>
                  Slope min / mean / max:{' '}
                  {stats.slope
                    ? [stats.slope.min, stats.slope.mean, stats.slope.max].map((n) => n.toFixed(2) + '°').join(' / ')
                    : 'Unavailable'}
                  . Roughness min / mean / max:{' '}
                  {stats.roughness
                    ? [stats.roughness.min, stats.roughness.mean, stats.roughness.max].map((n) => n.toFixed(3) + ' m').join(' / ')
                    : 'Unavailable'}
                  .
                </p>
                <p className="hint">
                  Circle uses sample-centre inclusion with local horizontal scale correction. Outside-coverage samples count as unavailable.
                  A favorable mean never overrides individual exceedances.
                </p>
              </>
            ) : (
              <p>Select a terrain point and a radius between 5 and 2000 m.</p>
            )}
          </div>
        </>
      )}
      <p className="hint">
        Preliminary terrain screening only. Does not independently detect boulders or small craters, verify regolith bearing capacity,
        lander dynamics, or all landing hazards. Source DEM is ~90% interpolated and may not resolve sub-grid obstacles. Elevation RMS shown
        above is not a slope/roughness confidence interval; residual roughness can be comparable to source error. No probabilistic safety
        certification.
      </p>
    </section>
  )
}
