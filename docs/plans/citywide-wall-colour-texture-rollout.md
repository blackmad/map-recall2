# Amsterdam wall colour and texture rollout

Updated 2026-09-26. Deliverable requested: city-wide colours/textures by morning,
or a concrete executable plan. This plan supersedes the earlier requirement to
establish exact colour for every ten-case example before any wider experiment.
The owner accepts the current colour direction. Expand a labelled experiment;
do not silently turn uncertain assignments into verified matches.

## Decision

Prioritise colour and material coverage. Leave windows, rooflines and gables out
of this work. Reuse geometry, the photographic registration pipeline, the 100-owner
cohort and the shared material library. Do not train a new CV model for this pass.

Accurate city-wide photo matching is not an honest overnight promise: the cached
geometry is available, but city-wide registered facade imagery and validated cheap
inference are not. The achievable deliverable is a reproducible coverage audit,
a validated 100-building expansion, and a resumable district-to-city queue. If
acquisition or evaluation fails, retain the plan and precise coverage rather than
fill the map with randomly assigned brick colours.

## Inventory measured from local files

Reproduce with `npm run review:wall-materials:city-audit`. The JSON output records
source hashes and the hash of every geometry tile through a tile-set digest.

| Scope | Measured count | Meaning |
| --- | ---: | --- |
| Cached map extent | 342,993 unique features, 295 tiles | Zero duplicate IDs; includes areas outside Amsterdam |
| BAG IDs starting 0363 | 178,441 | Amsterdam-prefix subset; boundary audit still required |
| Other BAG IDs | 156,682 | Do not include in an Amsterdam municipality coverage claim |
| OSM IDs | 7,870 | Require a separate spatial identity join |
| Current Da Costa/Jordaan release | 7,395 buildings | Geometry coverage, not photographed appearance coverage |
| Existing photo measurements | 598 observations / 501 owners | All within the current district release |
| Source-accepted wall colours | 372 owners | Source review, not proof of rendered colour accuracy |
| Material assessments | 100 owners; 89 known / 11 unknown | 99 owners join the older city geometry extract |
| Rendered review | 10 cases; 6 broad-family passes / 4 unresolved | No claim of exact texture or colour acceptance |

The city extract and district release have different geometry snapshots. Of the
501 sampled owners, 499 join the city tiles; 371 of the 372 accepted-colour owners
join. Preserve these missing joins as explicit work items. The cohort miss is entry 90, De Clercqstraat 81 (BAG 0363100012125896). Never attach a missing
ID to the nearest building without a verified identity match.

## Execution order and stop conditions

### 1. Benchmark the cheap classifier and lock the rendering contract

Use the 100 source-bound references. Reserve entire streets/panorama groups for
held-out evaluation; exclude the original ten-image pilot from that holdout.
Existing model assessments are provisional reference labels, not unquestionable
truth. Independently adjudicate disagreement using native photos and owner crops.

The inference payload contains the isolated target crop, a contextual image with
target outline, owner ID, photo hash and acquisition date. Request structured:

- target visible / partly occluded / not verifiable;
- material family (brick, painted brick, render, stone, concrete, metal/glass, unknown);
- colour family and brightness class separately from material;
- a few visible wall regions, excluding windows, vegetation, signs and deep shade;
- visible texture evidence and confidence, with an explicit abstain option.

Use sampled wall-region colours as evidence; do not treat a model's guessed hex
or shadowed photo median as exact albedo. Keep the source colour, palette choice
and rendered appearance separate. The pale-cream correction proved that one
material family needs multiple colour variants.

Proposed expansion gate: zero wrong-owner assignments in the held-out audit;
at least 95% material/colour-family agreement among non-abstentions; report
coverage/abstention rate separately. These are targets, not measured performance
or a statistical guarantee about the whole city. Escalate all disagreements and
low-confidence cases to the stronger visual reviewer. Stop expansion if identity
fails; fix crop/registration before tweaking the palette.

### 2. Render the 100-owner cohort as an explicitly provisional expansion

The 89 known source assignments are candidates, not automatic passes. Keep the
11 unknowns unchanged. Use shared colour variants; retain source evidence per
assignment. Capture exact owner masks, focused front/oblique views, and ordinary
context views. Run the established independent review loop; report identity,
colour direction and texture plausibility separately.

For brick/stone, check zoom 18, 19 and 20, front and oblique, plus slow pan/zoom on
desktop and phone. The current pattern's course dimensions are not proven metric.
If size or aliasing fails, ship flat colours and material metadata, withholding
visible courses until the renderer meets the gate. Texture must not block useful
colour coverage or introduce flickering throughout the city.

### 3. Expand within the existing 7,395-building district

Start with the remaining 401 already photographed owners; this requires less new
acquisition and exposes source conflicts. Then queue street-facing owners without
usable evidence. Deduplicate panorama downloads; derive multiple bounded facade
crops from each photograph. Acquire only the resolution needed for wall colour
and material classification. Record inaccessible or obscured courtyard buildings.

Reuse `inventory-expansion.mjs`, `run-area-pipeline.ts`, the panorama source adapter
and persistent acquisition caches. The current routing inference runner is a
mechanism for batching/reuse and budget journals, not a ready-made wall-material
classifier: it needs the structured task above and a held-out quality report.
The best existing visual benchmark harness is
`scripts/facade-rebuild/benchmark-appearance-routing.mjs`: it supports dry runs,
image sizing, hashed prompts/schemas, usage/time logs and budget reservations.
Adapt that mechanism to this cohort and material/colour task rather than treating
its existing routing labels as wall-colour QA. The OpenCode CLI lists the vision
pilot model, but a catalog listing is not a verified live service or price.
No OpenCode MCP tools are exposed in this session; the CLI is the available path.
Do not run the full roof/window reconstruction pipeline to obtain wall colours.

Publish one immutable district appearance overlay at a time. Independently audit
all identity conflicts plus a stratified sample of confident outputs by street,
material, lighting condition and acquisition year. A failed stratum stays withheld.

### 4. Expand across Amsterdam neighbourhoods

First join the cached geometry to a pinned official municipal boundary and publish
the actual target denominator. Inventory panorama metadata per bounded area,
recording dates and usable street-facing coverage before downloading photographs.
Add outer-city typologies (post-war blocks, industrial buildings, painted/rendered
facades, waterfront buildings) to the benchmark before relying on a canal-house
model everywhere. Existing Slotervaart, Tuindorp Nieuwendam, Apollobuurt and
Oosterpark area configurations offer starting points, not proven city coverage.

Queue, resume and cache per owner/source hash. Report these states separately:
no imagery, registration uncertain, source assessed, render candidate, accepted,
withheld, geometry missing. Show evidence coverage as a percentage of the pinned
municipal target. “All buildings have a fallback” is not “city-wide matched.”

## Runtime architecture

Use a source-bound sparse table keyed by canonical BAG ID, partitioned by the
existing z14 tile keys as it grows. Each assignment records source observation,
photo hash/date, material family, colour variant, uncertainty, review state and
version. OSM-only features stay unmatched until a spatial identity join is audited.

Join the table when `BuildingTileStreamer` decorates loaded features in
`src/canalRecall/buildingTilesBrowser.ts`; emit `renderMaterialId` and provenance.
Do not put hundreds of thousands of IDs in a MapLibre style expression. The
runtime currently limits residency to 12 tiles; preserve that lifecycle and load
only appearance partitions needed by resident tiles.

The existing city-wide fallback is explicitly tagged
`citywide-identity-palette-v2-not-measured`: a deterministic identity palette,
not photographic evidence. Never count it as inferred material/colour coverage.
Prefer trustworthy explicit source tags where available, retaining their provenance;
missing tags are not a reason to infer brick from a generated brown wall.

One fixed material expression reads the feature property. Use the same source
and exclusive filters for flat versus patterned walls. Preserve the existing
coverage/landmark suppression, ground-floor base, visibility and highlight rules
in `public/canal-drive/js/vector-map.js`. Highlighting needs a separate treatment:
pattern paint ignores fill colour. No duplicate coplanar walls.

MapLibre patterns replace the flat wall colour. Do not discard a supported wall
colour simply to add brick lines. For the first rollout use a bounded, visually
reviewed material/colour palette; keep flat source-supported colour when no palette
variant fits. Start detailed courses only at reviewed near-view zooms, with flat
colour farther away. Thirteen 128px RGBA sprites occupy about 0.85 MB before GPU
padding/mipmaps; this scales much better than a unique image per building.

If coarse palette quantisation or non-metric pattern scaling remains unacceptable,
prototype a single batched metric shader on the same LoD1 wall geometry, with
vertex colour and procedural mortar. That is a later renderer task with explicit
performance and depth-composition checks, not a prerequisite for broad colour data.

## Time and cost: measured pilot, not a quote

The only current cheap-model pilot used ten small contact-sheet references:
11.25 seconds, 0.00247575 reported cost units, currency unverified. It had a target
identity error and shadow sensitivity, so it is not a production accuracy result.
Simple arithmetic at exactly that payload gives:

| Owners | Serial inference only | Reported cost units only |
| --- | ---: | ---: |
| 100 | 1.9 minutes | 0.0248 |
| 7,395 | 2.3 hours | 1.83 |
| 178,441 | 55.8 hours | 44.18 |

These exclude image acquisition, registration, higher-resolution inputs, retries,
rate limits and independent review. Do not label the units USD or promise a
parallel speedup until provider billing and a larger run verify it. The weekly
subscription budget is not exposed to this audit. Keep existing runner spending
caps/journals; no new paid calls were made for this plan.

Work in bounded stages: first an approximately one-hour classifier/renderer check,
then the 100-building capture/review batch, then an acquisition/inference tranche
only if the prior stage passes. Log actual throughput and cost before scheduling
an overnight district run. Do not represent these estimates as completed work.

## Commands available now

```sh
npm run review:wall-materials:city-audit
npm run review:wall-materials:capture -- --run=<new-run> --isolated=true --indices=11,17 --base-url=http://localhost:5195
npm run review:wall-materials:focus -- <new-run>
PW_PORT=5195 npx playwright test tests/e2e/wall-material-demo.spec.ts
```

The classifier benchmark, general city overlay loader and municipal acquisition
queue are implementation work still to do; there is no turnkey command that
already produces a validated city. The existing plan-only pipeline entry points
can preview selected area acquisition without paid calls. Keep the existing live
colour demo usable while those components are built.
