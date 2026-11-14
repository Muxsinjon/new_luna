import { useEffect, useMemo, useState } from 'react'
import HazardPanel, { type HazardVisual } from '../components/HazardPanel'
import SitePair from '../components/SitePair'
import TerrainCanvas from '../components/TerrainCanvas'
import { useStore } from '../lib/store'
import { loadTerrainAsset, sampleGrid, type SurfacePoint, type TerrainAsset } from '../lib/terrainMesh'

export default function TerrainExplorer() {
  const { s, set, site, addCustom, customBusy, theme } = useStore()
  const [asset, setAsset] = useState<TerrainAsset | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0)
  const [picked, setPicked] = useState<SurfacePoint | null>(null),
    [lat, setLat] = useState(''),
    [lon, setLon] = useState(''),
    [pickError, setPickError] = useState(''),
    [imagery, setImagery] = useState(false)
  const [visual, setVisual] = useState<HazardVisual | null>(null)
  const st = site(s.surfaceSite === 'A' ? s.siteA : s.siteB)
  useEffect(() => {
    const abort = new AbortController()
    let loaded: TerrainAsset | null = null
    loadTerrainAsset(abort.signal).then(
      (a) => {
        if (abort.signal.aborted) {
          if (a.imageUrl) URL.revokeObjectURL(a.imageUrl)
          return
        }
        loaded = a
        setAsset(a)
      },
      (e: Error) => {
        if (!abort.signal.aborted) setError(e.message)
      },
    )
    return () => {
      abort.abort()
      if (loaded?.imageUrl) URL.revokeObjectURL(loaded.imageUrl)
    }
  }, [attempt])
  const elevation = asset ? sampleGrid(asset, st.lat, st.lon) : null
  const current = useMemo(
    () => (elevation === null ? null : { lat: st.lat, lon: st.lon, elevationM: elevation }),
    [st.lat, st.lon, elevation],
  )
  const pick = (p: SurfacePoint) => {
    setPicked(p)
    setLat(p.lat.toFixed(5))
    setLon(p.lon.toFixed(5))
    setPickError('')
  }
  const applyPoint = async () => {
    if (!picked) return
    try {
      await addCustom(picked.lat, picked.lon, s.surfaceSite)
    } catch {
      setPickError('Planner terrain failed to load. Try again.')
    }
  }
  const rms = asset && picked ? sampleGrid(asset, picked.lat, picked.lon, asset.errors) : null
  return (
    <div className="workspace terrain-ws">
      <aside className="rail">
        <SitePair />
      </aside>
      <section className="stage" aria-labelledby="terrain-title">
        <div className="stage-head">
          <div>
            <h2 id="terrain-title">3D lunar terrain explorer</h2>
            <p className="lede">
              Connecting Ridge, NASA LOLA Site01. Explore an actual lunar elevation mesh and choose a mission location.
            </p>
          </div>
          <div className="seg" role="radiogroup" aria-label="Terrain site shown">
            {(['A', 'B'] as const).map((slot) => (
              <button
                type="button"
                key={slot}
                role="radio"
                aria-checked={s.surfaceSite === slot}
                className={s.surfaceSite === slot ? 'on' : ''}
                onClick={() => set({ surfaceSite: slot })}
              >
                Site {slot}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              className="btn"
              onClick={() => {
                setError('')
                setAttempt((a) => a + 1)
              }}
            >
              Retry terrain loading
            </button>
          </div>
        ) : !asset ? (
          <p role="status">Loading verified NASA terrain…</p>
        ) : (
          <>
            <p className="terrain-quality">
              Real NASA PGDA Site01 elevation: 5 m source pixels, 20 m mesh spacing, 8 × 8 km coverage. True horizontal and vertical scale
              (1×), including lunar curvature.
            </p>
            <p className="muted">
              {st.name}. About 90% of native pixels are interpolated between laser returns. Pixel spacing is not measurement accuracy.
            </p>
            {asset.meta.imagery && (
              <p className="hint" data-testid="registration-warning">
                LROC WAC registration is unverified. The texture is off by default and available only as optional context; geographic
                reprojection does not establish landmark alignment accuracy.
              </p>
            )}
            <div className="terrain-toolbar">
              <label className="field">
                <span>Terrain appearance</span>
                <select
                  aria-label="Terrain appearance"
                  value={imagery ? 'imagery' : 'elevation'}
                  onChange={(e) => setImagery(e.target.value === 'imagery')}
                >
                  <option value="elevation">Shaded elevation</option>
                  {asset.meta.imagery && <option value="imagery">LROC WAC — registration unverified</option>}
                </select>
              </label>
            </div>
            {current ? (
              <TerrainCanvas
                key={st.id + ':' + attempt + ':' + imagery}
                asset={asset}
                site={current}
                selectedPoint={picked}
                imagery={imagery}
                theme={theme}
                onPick={pick}
                visual={visual}
              />
            ) : (
              <div className="panel">
                <p>This site is outside the Site01 terrain coverage. No terrain is extrapolated.</p>
                <button
                  className="btn"
                  onClick={() => set(s.surfaceSite === 'A' ? { siteA: 'connecting-ridge' } : { siteB: 'connecting-ridge' })}
                >
                  Show Connecting Ridge
                </button>
              </div>
            )}
            <p className="hint">
              Drag to rotate, scroll or pinch to zoom, right drag or two fingers to pan. Focus the canvas and use arrow keys to pan, or use
              the camera buttons. Click terrain to select a point. Magenta marks the mission site; cyan marks your picked point. Local axes:
              X east, Y up, Z south. Inspection lighting does not model mission sunlight.
            </p>
            {imagery && <p className="hint">{asset.meta.imagery?.note}</p>}
            <section className="panel">
              <h3>Selected surface point</h3>
              <p
                className="num"
                aria-live="polite"
                data-testid="terrain-readout"
                data-lat={picked?.lat}
                data-lon={picked?.lon}
                data-elevation-m={picked?.elevationM}
              >
                {picked
                  ? `${picked.lat.toFixed(5)}° latitude, ${picked.lon.toFixed(5)}° E, ${picked.elevationM.toFixed(1)} m elevation`
                  : 'Click terrain or enter lunar coordinates to inspect elevation.'}
              </p>
              {picked && (
                <p>
                  Source height uncertainty (RMS): {rms === null ? 'unavailable' : `${rms.toFixed(2)} m`}. This does not include mesh
                  decimation error or image registration error.
                </p>
              )}
              <form
                className="terrain-toolbar"
                onSubmit={(e) => {
                  e.preventDefault()
                  const la = Number(lat),
                    lo = Number(lon)
                  if (!lat.trim() || !lon.trim() || !Number.isFinite(la) || Math.abs(la) > 90 || !Number.isFinite(lo)) {
                    setPickError('Enter a valid lunar latitude and east longitude.')
                    return
                  }
                  const h = sampleGrid(asset, la, lo)
                  if (h === null) {
                    setPickError('Coordinates are outside valid terrain coverage.')
                    return
                  }
                  pick({ lat: la, lon: ((lo % 360) + 360) % 360, elevationM: h })
                }}
              >
                <label className="field">
                  <span>Latitude (degrees)</span>
                  <input type="number" step="any" min="-90" max="90" value={lat} onChange={(e) => setLat(e.target.value)} />
                </label>
                <label className="field">
                  <span>East longitude (degrees)</span>
                  <input type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} />
                </label>
                <button className="btn" type="submit">
                  Inspect coordinates
                </button>
              </form>
              <button className="btn" disabled={!picked || customBusy} onClick={() => void applyPoint()}>
                {customBusy ? 'Computing horizon…' : `Use selected point as Site ${s.surfaceSite}`}
              </button>
              {pickError && <p role="alert">{pickError}</p>}
              <p className="hint">
                Elevation is relative to the 1737.4 km lunar sphere. Clicks report the rendered triangle surface; coordinate entry samples
                the 20 m grid bilinearly. Decimal places do not imply accuracy. Planner custom-site horizons still use the existing 960 m
                regional DEM over 250 km, not this local mesh.
              </p>
            </section>
            <HazardPanel asset={asset} point={picked} theme={theme} onVisual={setVisual} />
            <details className="panel">
              <summary>Sources, uncertainty and image alignment</summary>
              <p>
                <a href="https://pgda.gsfc.nasa.gov/products/78" target="_blank" rel="noreferrer">
                  NASA GSFC PGDA, Barker et al. (2021), Site01 adjusted LOLA DEM
                </a>
              </p>
              <p>{asset.meta.uncertaintyNote} The product uses MOON_ME/DE421; existing astronomical calculations are unchanged.</p>
              <p>
                Mesh decimation relative to the native 5 m DEM adds {asset.meta.decimationResidualM.rms.toFixed(2)} m RMS error over this
                crop (maximum {asset.meta.decimationResidualM.maxAbs.toFixed(2)} m). These residuals are separate from source uncertainty.
              </p>
              <p>
                DEM SHA-256: <code className="terrain-hash">{asset.meta.sources.surf.sha256}</code>
              </p>
              {asset.meta.imagery && (
                <p>
                  <a href={asset.meta.imagery.url} target="_blank" rel="noreferrer">
                    {asset.meta.imagery.title}
                  </a>
                  . Map-coordinate reprojection is checked, but image-to-terrain registration is unverified. No independent landmark
                  residual or subpixel image/DEM co-registration has been established. WAC is coarse context imagery, not high-resolution
                  NAC.
                </p>
              )}
            </details>
          </>
        )}
      </section>
    </div>
  )
}
