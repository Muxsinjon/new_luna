# LunaWindow project status

Updated 2026-11-14. Local branch: `feat/connecting-ridge-3d`. No GitHub push, remote pull request, merge or deployment has been performed.

## Milestone 1: core explorer implemented and locally tested

The real high-resolution NASA Site01 source is now accessible and verified. The earlier coarse-context implementation's local-only commit was absent from this replacement environment; the feature was recreated from the original checkout using the real source. Existing application behavior and scientific datasets remain in place.

Implemented:

- NASA GSFC PGDA Connecting Ridge Site01 5 m elevation GeoTIFF and matching total RMS height-uncertainty GeoTIFF downloaded over verified HTTPS, opened with GDAL/Rasterio, inspected for projection, coverage, pixel centres, NoData, units, scale/offset and uncertainty. Exact source hashes are pinned.
- Efficient 8 × 8 km, 401 × 401 vertex terrain asset at 20 m spacing, sampled directly from real 5 m pixels; no fabricated or newly filled heights. The 3D mesh includes lunar curvature at 1× scale.
- Separate lazy-loaded Three.js workspace with orbit, zoom, pan, reset, touch/keyboard controls, real ray/triangle point selection, coordinate entry and radial elevation/RMS readouts.
- Shared Site A/B selection and URL integration; a selected terrain location can become a custom mission site. Existing regional horizon/ephemeris algorithms remain unchanged.
- Optional real LROC WAC texture from NASA Moon Trek, geospatially reprojected with GDAL into the exact mesh extent, with metadata, tile hashes, transforms and explicit accuracy limitations. Shaded elevation remains the default.
- Reproducible processor, pinned Python dependencies, source attribution, automated tests, desktop/mobile screenshots and local PR draft.

## Data and alignment evidence

The source DEM is 3200 × 3200 Float32, 5 m/pixel, south-polar stereographic on the 1,737,400 m sphere, MOON_ME/DE421. Its X/Y bounds are −19,000…−3,000 m and −20,000…−4,000 m. NoData is NaN; no missing samples occur in the acquired raster. The band unit tag is unset; metre heights were confirmed in NASA's README. About 90% of native pixels are interpolated, per NASA; 5 m spacing does not imply 5 m independent measurements or accuracy.

The existing curated coordinate −89.53432°, 209.94767° E lies inside the source and crop, with native elevation about 1653.2899 m. Six geographic/elevation checkpoints and the full native subset identity are checked. Projection round-trip residuals are below 1e-6 m. The mesh's 20 m decimation residual against the native DEM is 0.2526 m RMS, 0.5125 m p95 absolute, 8.1865 m maximum over 2,563,201 samples. These are not independent ground-truth accuracy estimates.

The optional WAC mosaic is real, ~100 m nominal context, often dark at the pole. WMTS geometry, lunar reference radius, texture bounds and UV orientation are verified. Its metadata quotes 12–300 m absolute accuracy. **No independent image/DEM landmark residual or subpixel co-registration has been established.** It is not a high-resolution NAC orthophoto. Its shadows are photographed, not computed for mission time.

## Validation

| Check | Before development | Current local result |
|---|---|---|
| Unit tests | 61 passed | 68 passed, 8 files |
| Python real-source/asset tests | Not present | 5 passed, no skips, including full native subset identity |
| Lint | Passed | Passed |
| Formatting | Existing source clean | Passed |
| TypeScript and production build | Passed | Passed; Three.js lazy chunk ~144 kB gzip triggers Vite's >500 kB uncompressed advisory |
| Existing smoke functional checks | 10 passed | 10 passed |
| Existing smoke zero-console gate | Failed on Google Fonts proxy certificate | Same external certificate failure; full smoke suite is not claimed green |
| New terrain browser suite | Not present | Passed rendered camera changes, picking/drag distinction, coordinates/RMS, decoded LROC texture, planner integration, coverage rejection, mobile layout, checksum failure/retry |
| Repeat processing | Not present | Identical elevation, RMS and JPEG output hashes from cached inputs |

Screenshots in ignored `pipeline/out/terrain-screenshots/` were visually inspected at desktop and mobile sizes. Software-renderer warnings about `ReadPixels` during screenshot capture are reported separately from application errors. Unexpected application errors/local asset failures remain fatal in the new browser test.

## Remaining limits and review work

- Independent landmark/image co-registration and a suitable high-resolution NAC orthophoto remain future validation work. The WAC texture must not be used as metre-scale ground truth.
- Full native 5 m mesh/LOD streaming is not implemented; the bounded 20 m mesh is deliberate and its measured residuals are disclosed.
- The planner still uses its original coarser regional DEM/elevation for custom-site horizons over 250 km. Its numbers may differ from local high-resolution readings. No distant terrain or science result was silently replaced.
- Rendering uses inspection lighting, not time-dependent physical shadows; this adds no new astronomical claims.
- Google Fonts certificate trust in Chromium remains an environment limitation observed before these changes. TLS verification was not disabled and persistent trust was not changed.
- User review and permission are still required before pushing, creating a GitHub PR or merging. A local PR description is prepared in [PULL_REQUEST_MILESTONE_1.md](PULL_REQUEST_MILESTONE_1.md).

See [TERRAIN_3D.md](TERRAIN_3D.md) for authoritative source URLs, metadata, hashes, processing and exact commands. To review, run `cd web && npm run dev`, open the application, choose **3D Terrain**, and select **Site B** or **Show Connecting Ridge**. Use the existing isolated checkout; do not create an extra Git worktree for routine cloud development.
