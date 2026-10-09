# Viñoly next-review preparation

Prepared in isolated `/Users/blackmad/Code/map-recall2-vinoly-finish-oct7` on 2026-10-07. GPU/browser/prepush, shared root/index and publication remain reserved to root. Current asset is SHA-256 `e25e62032c28211db0729dec875b2d783fe8a9d37a34e78d61ae729ed30cd7e1`, 22,942 triangles / 322,440 bytes, runtime fingerprint `e25e62032c28211d`. No mesh or runtime bundle changed during this preparation.

Private source closure is commit `fa73c85693429a169df717b11b6b5cbb9cd97507`, verified contained by `origin/main`. Path `models/vinoly/validation/draft-cpu-only-20261007/public/canal-drive/models/vinoly.glb` exactly matches current mesh bytes. Local front/side/current-context/current-front photos and current OSM map response exactly match committed source bytes. The archive checkpoint explicitly remains CPU-only. Original 19,372-triangle roof-cap-failure mesh was not found by bounded archive inventory; its failure assertion remains preserved, not a recovered mesh claim. Updated active source provenance in `vinoly-footprints.json` and `vinoly-review.json`; older historical archive claims remain historical evidence.

## Reference/render comparisons to prepare after GPU release

References are in `/Users/blackmad/Code/map-recall2-source-data/models/vinoly/raw/`:

- `current-context.jpg`: current north broad facade, upper NE→NW rise, lower opposite rise, crown and podium/tower width/height relationships. Compare fulltower neutral game view and lower gallery north rotation. Photo is from across the rail corridor; candidate camera is an inferred north/northeast inspection pose, not a surveyed photograph pose.
- `current-front.jpg`: street-level glazing, strongly projecting pale vertical fins, ground-floor frontage and uninterrupted diagonal notch at podium. Compare near-facade game view and lower gallery podium rotation. Candidate is elevated and cannot itself establish eye-level street fidelity.
- `front.jpg`: early/current-state distinctions, oblique offset podium/middle/tower composition, white stair edges, glass/aluminium palette. Compare source-side lower gallery rotation; night illumination is not a material-color authority.
- `side.jpg`: reverse broad tower face, diagonal edge returns and side fin attachment. Compare opposite game view and remaining gallery rotations. Trees occlude lower source facade.
- `sketch.jpg`: interpret ordered exterior flights only; concealed 18m same-height transit/patio location remains unverified.

Keep each source beside a current render carrying current loaded fingerprint. Historical `1004d3b7…` gallery acceptance does not establish current `e25e6203…` acceptance. Preserve old sawtooth, roof-cap and nonresident-south-alias failure evidence.

## Camera preparation

Original `vinoly-native-plan.json` stays intact. Its eye altitude12m → target48m over87.56m computes requested pitch112.35°. `public/canal-drive/js/vector-map.js` does not override MapLibre's default maxPitch60°. The plan therefore clamps and cannot preserve its intended eye. Record requested options, actual pitch/center/zoom/elevation, screenshot and framing failure before any adjustment.

Separate ready candidates:

- `vinoly-native-fulltower-plan.json`: north/northeast eye `[4.87313,52.33875]`, altitude130m, tower target `[4.87215,52.33778]`, altitude46m. Ground distance126.90m, requested pitch56.50°.
- `vinoly-native-near-facade-plan.json`: north/northeast eye `[4.87305,52.33815]`, altitude58m, podium target `[4.87260,52.33777]`, altitude17m. Ground distance52.21m, requested pitch51.86°.

These are downward inspection candidates below default maxPitch, not visual passes. Record actual framing/occlusion; adjust only after preserving failures. Shared root harness `scripts/landmarks/review-manual-pois.mjs` is absent from this frozen base and must be explicitly supplied/reconciled or run by root. Running both plans in one invocation overwrites `artifacts/vinoly-review`; move each result to a distinct camera evidence directory before the next run. Default opposite view remains a separate map camera with its own recorded state.

## Integration and independent failure review

CPU contract gives one genuine `osm_building_27653949` / selectable `lm-osm_building_27653949` destination. Pin/card location is `[4.872403,52.337767]` (longitude/latitude); approximate southern route arrival is `[52.33768,4.87262]` (latitude/longitude). Card has architect/year, exterior spiral and meaningful architect source URL, preserves exact six identities and is worthwhile by runtime card predicate. Both prepared plans assert exact pin and route-arrival coordinates. Physical pointer card, actual chosen finish and visible pin/label remain GPU acceptance requirements; keep selected destination fixed if routing fails.

Independent reviewer should actively seek: misplaced east podium relative to west tower; wrong stair rise directions/landings; roof cap sealing podium landing; generic glass slab instead of exposed pale fins; buried glass panes; unsupported crown/plant or wrong winding; wall caps over explicit roofs; unattached side windows; unmodeled/filled source-supported voids; model drift/scale/bias; masked neighbors; fake complete exterior path/patio.

Root and reviewer must inspect higher gallery plus four lower rotations and native front/opposite context. Verify every exact alias hides only after load, and fallback reappears after disabling/unavailable replacement, including independent pyramidal roofs. Current installed tile14/8413/5386 bytes match recorded hash and contains actual west `NL.IMBAG.Pand.0363100012109184` / `w37804729` and south `w754894015`. Source relationr10402579 links south part to outlinew277373193/BAG0363100012112073; nonresident direct BAG alias is not a substitute for drawn south geometry. Capture real unchanged drawn neighbors in front/opposite views. Pending GPU evidence also includes desktop/touch stationary-rider pan, current frame measurements and bounded enabled/disabled comparison; generic city startup performance cannot substitute for Viñoly scene evidence.

## Checks

Authored and decoded mesh checks pass:36 exposed panes, five recesses,50 supported flight probes, eight corner landing support probes/joins, four upward roof triangles, finite native bounds. Shared manual assets and POI contract pass. Initial `npm run lint` failed only in unchanged city appearance/preview files under mismatched root-shared dependencies; root and frozen package-lock hashes differ. Frozen-worktree dependency install and final lint result recorded below. Required route-start smoke/prepush remains root-owned and pending.

Frozen-worktree `npm ci --ignore-scripts --no-audit --no-fund` completed (469 packages); `npm run lint` now passes. Authored/decoded Viñoly, shared assets and POI contract were repeated under the correct lock and pass. `git diff --check` passes. No tracked lock/dependency file changed; worktree now owns an isolated dependency directory instead of the root symlink.

## Reserved launch command (not run)

After root explicitly releases GPU ownership and confirms port5212 serves the current asset/catalogue/bundles, use a fresh evidence working directory. This isolates harness-relative output from prior reviewer files:

```sh
mkdir -p /Users/blackmad/Code/map-recall2-vinoly-finish-oct7/artifacts/vinoly-release-review-20261007/fulltower
cd /Users/blackmad/Code/map-recall2-vinoly-finish-oct7/artifacts/vinoly-release-review-20261007/fulltower
LANDMARK_REVIEW_URL=http://127.0.0.1:5212 LANDMARK_REVIEW_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node /Users/blackmad/Code/map-recall2-vinoly-finish-oct7/scripts/landmarks/review-vinoly-ready.mjs /Users/blackmad/Code/map-recall2-vinoly-finish-oct7/scripts/landmarks/vinoly-native-fulltower-plan.json > review.log 2>&1
```

Log: `artifacts/vinoly-release-review-20261007/fulltower/review.log` relative to the isolated worktree. Captures/proofs: `artifacts/vinoly-release-review-20261007/fulltower/artifacts/vinoly-review/`. For near-facade, use a separate `near-facade` directory and `vinoly-native-near-facade-plan.json`. For preserved clamp diagnostic, use `original-clamp` and original `vinoly-native-plan.json`. Run serially. Loaded proof fingerprint must equal `e25e62032c28211d`; shared harness records it but does not itself assert equality. Port5210 remains reserved for root prepush smoke.

The reserved command now uses `review-vinoly-ready.mjs`: validates frozen SHA before/after shared harness and asserts actual game fingerprint equality. Successful run writes `frozen-comparison-proof.json`; source/render visual acceptance stays explicitly pending. Wrapper syntax checked; GPU execution remains reserved.
