# LunaWindow project status

Updated 2026-11-14. Local branch: `feat/connecting-ridge-3d`. No GitHub push, remote PR, publication or merge. Milestone 2 has not started.

## Milestone 1 final acceptance

**Core terrain explorer accepted for local review, with WAC registration explicitly unverified and disabled by default.** Full evidence for every acceptance requirement is in [MILESTONE1_ACCEPTANCE.md](MILESTONE1_ACCEPTANCE.md).

| Requirement | Result and evidence |
|---|---|
| LROC WAC alignment | Map projection, extent and UV checks pass, but independent landmark registration accuracy is **unverified**. Dark/coarse imagery supplies no defensible control set. Texture is **off by default**; selector and persistent warning explicitly say unverified. [Review](data/SITE01_REGISTRATION_REVIEW.json). |
| Google Fonts issue | Safely resolved by self-hosting the same four licensed Barlow font faces. No trust-store changes/TLS bypass. All four load locally; zero external HTTP requests in terrain acceptance; nested `/lunawindow/` production paths checked. [Sources/licenses](../web/public/fonts/SOURCES.md). |
| Selected coordinates/elevations | 101 independent native-source reference samples pass. Five actual browser ray picks differ from native 5 m bilinear heights by at most **0.1865 m**, and from source-derived 20 m triangles by less than **0.00005 m**. Numeric entry agrees with independent 20 m bilinear sampling within 1e-5 m. [Evidence](data/SITE01_BROWSER_PICKS.json). |
| Native 5 m → rendered 20 m | All **160,801 mesh elevations** exactly equal every fourth native pixel in the real GeoTIFF crop. No newly fabricated/filled heights. Source/asset hashes and six geographic checkpoints pass. [Tests](../pipeline/test_terrain_site01.py). |
| Full checks | **69 JS tests, 6 Python tests (no skips), lint, formatting, build, unchanged 10-flow smoke suite, terrain browser suite and all 10 existing workspace screenshots pass.** Smoke/screenshots report no console errors or warnings. |
| Documentation | Final results, interpolation limits, source attribution, font licenses, local PR description and reproducible evidence updated. No remote changes. |

## Implemented

Separate lazy Three.js workspace renders real NASA PGDA Connecting Ridge Site01 elevation and RMS uncertainty: an 8 × 8 km curved lunar mesh at 20 m spacing from the verified 5 m GeoTIFF. It supports orbit, zoom, pan, reset, touch/keyboard controls, ray picking, coordinate entry, elevation/RMS readouts and Site A/B planner integration. Existing mission finder, comparisons, ephemeris, regional horizons and 360° Surface View remain intact.

Optional real NASA Moon Trek LROC WAC imagery is map-projected onto the exact mesh extent, with tile hashes and source transforms recorded, but its independent image-to-terrain registration is **not validated**. WAC is ~100 m nominal context, often dark at the pole, and its metadata quotes 12–300 m absolute accuracy. It is not high-resolution NAC or metre-scale ground truth.

## Quantified limits

- NASA's 5 m source is itself ~90% interpolated between laser returns. Pixel size is not independent measurement accuracy.
- Mesh decimation residual against the native interpolated DEM: **0.2526 m RMS, 0.5125 m p95 absolute, 8.1865 m maximum**, over 2,563,201 samples. This is separate from NASA source RMS uncertainty and image registration error.
- The five tested ray picks are representative checks, not a claim that their 0.1865 m maximum applies globally. UI decimals are not accuracy claims.
- Planner custom-site elevation and 250 km horizons still use the original 960 m regional DEM and can differ from local high-resolution readings.
- Inspection lighting and photographed texture shadows are not physical shadow simulations for mission time.
- WebGL screenshot capture on the software renderer emits counted `ReadPixels` performance warnings. No other application/browser errors or failed requests remain in the acceptance run.
- Vite retains the advisory for the lazy Three.js chunk (>500 kB uncompressed, ~144 kB gzip). No check is suppressed to hide this advisory.

The previous Google Fonts proxy-certificate failure is resolved at the application level by local font assets. Browser/system trust is unchanged. Independent WAC landmark co-registration remains the substantive unverified item, handled by the default-off policy requested for acceptance.

## Review and reproduction

See [TERRAIN_3D.md](TERRAIN_3D.md) for source metadata and commands, [MILESTONE1_ACCEPTANCE.md](MILESTONE1_ACCEPTANCE.md) for final evidence, and [local PR draft](PULL_REQUEST_MILESTONE_1.md) for later review. Run `cd web && npm run dev`, choose **3D Terrain**, and select **Site B** or **Show Connecting Ridge**. Use the existing isolated checkout; do not create an extra Git worktree for routine cloud development.
