# Changelog

All dates 2026 (UTC+local event time). Each milestone has an acceptance report in `docs/` and a recovery patch in `milestones/`.

## Simpler dashboard and a view from the Moon (2026-11-15)
- **Surface View:** the 2D panorama is the default again. A new **View from the Moon** shows the LRO Moon with the Sun and Earth in their real directions, seen from 15 km above the site. The 5 m shadow view is now in "Show all controls".
- **Explore & Compare:** each site gets four plain-word cards (Sun now, Earth now, sunlight and Earth for the rest of the mission). Charts and tables are in "Show all controls".

## Simpler map and Surface View (2026-11-15)
Ideas adapted (no code copied) from astoreyai/lunar-lighting-planner, an independent project:
- **South pole map, lit by the real Sun:** every 960 m LOLA cell is marched toward the Sun (or Earth) at the selected time, with exact spherical geometry and the upper-limb rule. Warm ground is sunlit and dark ground is in shadow. A play button and slider move through the mission. The year-average PGDA layers remain in the expert view.
- **Surface View in plain words:** four cards (Sun now, Earth now with countdowns to the hour, sunlight and longest night over the next 30 days, Earth always/sometimes/never). A whole-sky 360° panorama on a fixed −5° to 15° scale shows the Sun's and Earth's paths. The drag-to-look view and the 3D first-person view are kept as "Look around" and "3D first person".

## Milestone 9: release gate (2026-11-15)
- **Full user-journey e2e on real data with every external request blocked** (`tests/e2e/journey_test.py`): it also produces the demo evidence screenshots. The app makes no runtime requests to external servers.
- **Accessibility audit** from Chrome's computed accessibility tree on every workspace.
- **390 px layout** check of all six workspaces.
- **No-WebGL fallback test** (`tests/e2e/gpu_fallback_test.py`).
- **Provenance block in every export:** UTC time convention, coordinates, units, AI-assistance disclosure and a no-endorsement statement. An `ai-assistance` meta tag was added, and the share image now carries a visible watermark ("Rendered by AI-assisted code; not a NASA image").
- **Docs:** demo script with actual outputs, a submission kit checked against the official 2026 guide, this changelog, and the final acceptance report.

## Milestone 8: optional science overlays
- Diviner Polar Resource Products (model-derived temperatures and ice-stability depth) and the ShadowCam Shackleton mosaic (observed I/F), through a reusable per-site layer framework.
- Fixed a URL-hash race that could undo a pasted or edited link.

## Milestone 7: immersive surface view
- 3D first-person mode on the 5 m sites: true-size Sun and Earth, Earth phase, computed shadows, far-terrain silhouette and walking. WebXR is offered only where supported.

## Milestone 6: explainable mission-date recommendation
- Terrain hard requirement, soft preference weights with a visible score, a downloadable JSON scenario, and a 3D-terrain hand-off.

## Milestone 5: terrain-aware sunlight and Earth line of sight
- Time-dependent shadows and Earth line of sight on the 3D sites, the PGDA permanent-shadow layer, full / partial / disc-weighted sunlight, and a bound on what hourly sampling can miss.

## Milestone 4: Sun and Earth geometry audit
- Independent JPL Horizons validation over 9 sites × 40 epochs, cubic ephemeris upsampling, a tested Earth phase, and Sun/Earth rays in 3D.

## Milestone 3: multi-site terrain
- Site04 (Shackleton Rim) and Site06 (Nobile Rim 1) from NASA PGDA product 78; side-by-side 3D views with an equal-footprint comparison.

## Milestones 1–2: Site01 3D terrain and hazard screening
- Verified 5 m LOLA terrain as a 20 m mesh; OLS slope, RMS roughness, hazard footprints, and the slope-estimator discrepancy study.

## Pre-milestone foundation
- Planner: Explore and Compare, Mission Window Finder, 360° Surface View, About; two visibility models; JPL Horizons ephemeris; LOLA horizon masks.
