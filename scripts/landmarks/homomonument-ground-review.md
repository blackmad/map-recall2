# Homomonument ground correction, 2026-10-08

The monument does not need translation. The original user screenshot, cached RCE overhead image, native-scale game renders and current BGT boundary probes agree: the two mainland triangles stand on Westermarkt paving; the eastern staircase deliberately projects into Keizersgracht.

The concrete ground defect is the adjoining canal-side paved footpath: it is pale green in the basemap and missing from the existing OSM plaza fill. The scoped correction adds only current BGT footpath `G0363.eb965d61629d424c934f94b634ebf74f` as `paved-area` through the existing park landscape layer. It changes no GLB, native anchor, destination, pin, source card, building suppression or water polygon.

The derived polygon preserves its surveyed tree/open-space hole, simplifies in local metres at 8 cm, and retains 28 of 619 source vertices. Maximum checked raw-boundary deviation is 0.076697 m. Both inland stair base corners lie inside it; the stair tip and centroid remain outside it over water. Both mainland triangles remain on their existing plaza fill.

Raw acquisitions and private review evidence are staged at `artifacts/homomonument-ground-source/`; see `homomonument-ground-sources.json` for URLs, original response checksums, access attempts and assertions. Curl succeeded for all four bounded BGT queries after Python's local certificate verification failed. Filter historical BGT versions by null `eind_registratie` and `termination_date`.

Validation:

- `node --import tsx scripts/landmarks/build-homomonument-ground.ts`
- `node --import tsx scripts/check-homomonument-ground.ts artifacts/homomonument-ground-source`
- Actual started bike route to genuine `lm-extract_landmarks_7630368`, native overhead/oblique, opposite-side and stationary-rider camera-pan renders; no page errors.
- Before/after native images retain open Keizersgracht, the east stair projection, mainland triangles and surrounding facades. Shared park dataset was restored byte-identical after the isolated trial: SHA256 `b063bc6ffe0c7b32d9417b5c613eb62f0a821afd739d3698d1404b25b918b0ed`. Original 10771 features; trial 10772.

Integration is proposed in `artifacts/homomonument-ground-source/park-generator.patch`. Apply it to the generator and append the derived feature to the current published park dataset, retaining all existing features. Runtime code and bundles do not change. The existing park layer handles themes and visibility; the base map remains its fallback.

Acceptance remains pending root private source archival/push, integrated data refresh, independent source/native comparison, visibility/fallback behavior and touch camera-pan verification. Physical info-card clicking was not retested in this scoped ground diagnostic. The earlier setup-only capture was not gameplay evidence; `installed-basemap.json` is the saved setup diagnostic, while the started-game captures are `before-*` / `after-*`.
