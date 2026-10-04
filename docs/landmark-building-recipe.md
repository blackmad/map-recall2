# Amsterdam landmark building recipe

Build a recognizable original low-poly POI in the existing house style, at its real map location. Completion includes the model, destination, map pin/label and meaningful sourced card. This recipe preserves the current quality bar; its efficiency rules remove repeated context and work, not visual acceptance.

## 1. Give one worker one bounded assignment

Use a fresh worker with a short handoff rather than a long inherited conversation. Include the building name, existing POI identity, owned paths, this recipe, relevant references, known defects and acceptance requirements. Read the applicable `AGENTS.md`, then only relevant files. Do not load every builder or the city dataset into the conversation.

Prefer an isolated checkout/worktree for outside agents. In a shared checkout, one coordinator owns catalogue registration, generated manifests/bundles and the git index. Retire the worker after its deliverable; use a new short handoff for the next building.

## 2. Establish identity and physical scope

- Find the existing destination in `public/canal-drive/landmark-backlog.json` and the source feature in `public/data/extracts/amsterdam/landmarks.json`. Preserve its genuine identity and researched facts.
- Resolve current OSM outlines, mapped parts, BAG parent identities and public entrance. Nearby labels and address points are clues, not proof of building ownership.
- Record the exact replaced identities and at least one adjacent building that must remain visible. A complex may have several physical parts; their aliases do not require duplicate destinations.
- Preserve holes, courtyards, raised volumes and underpasses. Do not model an entire parcel as an opaque slab or hide neighbors with a padded rectangle.

Save source footprints and their provenance alongside the builder. Keep source IDs, URLs, dates where known, coordinate conventions and the measured-versus-approximate distinction.

## 3. Research recognition before coding

Use primary architectural, operator, heritage or municipal references. Obtain a clear principal facade and roof view, plus an opposite/context view when needed. Identify the few features that distinguish the building: silhouette, roof profile, tower, entrance, window rhythm, materials and open spaces.

Use actual dimensions and survey data where available. OSM/BAG/AHN/3DBAG each describe different things: equipment maxima are not whole-building heights; a fitted roof can omit a thin spire or open crane. Record uncertainty instead of inventing precision. A historical construction date may not date every present wing.

Reuse stored research first. Browse only for missing evidence or changed conditions. Reference images guide original reconstruction; do not import their pixels or third-party geometry into an asset attributed as original.

## 4. Author the model

Use Three.js geometry and the shared `BuildingTools` palette/primitives in `scripts/landmarks/cultural-builders.ts` and `build-manual-landmarks.ts`. Use `house-geometry.ts` for open-top footprint shells and upward-facing roof planes. Geometry is in metres, glTF Y-up; surveyed local axes and the placement specification determine map orientation. Existing facade-oriented primitives generally face +Z.

Build silhouette and main volumes first, then the characteristic facade assemblies. Clip details to the real perimeter. On angled walls, derive each window's position and tangent from that wall; fixed coordinates can leave windows floating. Glazing and columns must be physically exposed, not buried in the main extrusion.

Give explicit roofs ownership of their surfaces. Avoid duplicate wall caps, downward winding, coplanar trims, unsupported roof plates and rotated/nonuniformly scaled primitives whose bounds no longer match the intended roof. For unusual roofs, directly construct bounded surfaces from the intended profile.

Do not add building-name lettering for identification. Retain lettering only when the actual sign is a defining part of the architecture, supported by references. Map labels handle names. Architectural signs must fit their actual panels, follow the wall plane and remain subordinate to the building.

## 5. Persist the reusable deliverable

Typical files are:

- `scripts/landmarks/<id>-builder.ts`: original geometry, exporting a function using `BuildingTools`.
- `<id>-spec.json`: canonical POI, model URL, native anchor/bearing, exact suppression IDs, dimensions and attribution.
- `<id>-footprints.json`: source geometry, references, height notes and important open-space probes.
- `<id>-poi.json`: meaningful sourced description when existing information needs supplementing.
- `scripts/check-<id>-geometry.ts`: focused checks for this building's actual failure risks.
- `scripts/landmarks/review-<id>.mjs`: reproducible gallery/live review where appropriate.

Reusable examples: Faralda for open structures; Concertgebouw for exposed columns/courtyards; Heineken for multiple historical fronts and calibrated roofs; Stopera for elevated parts and open passages. Read the closest example, not all of them.

## 6. Integrate and generate once the source is ready

The coordinator registers the spec in `src/canalRecall/landmarks/manualCatalogue.json` and the dedicated builder in `scripts/landmarks/build-manual-landmarks.ts`. Builder argument signatures differ: read the export before wiring it. Add useful fallback facts in `src/canalRecall/game/manual-poi-data.json` while preserving genuine existing facts.

```sh
node --import tsx scripts/landmarks/build-manual-landmarks.ts --only MODEL_ID
npm run build:canal-signature-landmarks
npm run build:canal-route-selection
npm run build:canal-game-landmarks
```

The generator updates the GLB, asset manifest and content fingerprints. Rebuild the relevant bundles so the runtime requests the new asset rather than a cached old version. Existing per-model budgets are under 40,000 triangles and 500,000 bytes, with no textures. Do not loosen budgets to make a failing model pass.

## 7. Keep the same acceptance checks

Run focused geometry checks, the shared asset check, POI contract and TypeScript check. Test real risks: finite bounds, native scale, roof support/winding, actual first-hit glazing/column visibility, open-space rays and exact source identities. Avoid tests that merely repeat constants from the implementation.

```sh
node --import tsx scripts/check-MODEL_ID-geometry.ts
node --import tsx scripts/landmarks/check-manual-landmarks.ts
node --import tsx scripts/check-manual-poi-contract.ts
npm run lint
```

Inspect native-scale gallery views against references and live-game views from both relevant sides. Verify exact replacement masks, drawn neighboring geometry, actual chosen destination/finish, visible geographic pin and physical clicking of the correct sourced card. A direct call to show a card is not a pointer-selection test. Wait for current local building residency before evaluating neighbors; coarse/streamed buffers can differ.

Fix concrete observed failures. Repeat the affected checks after edits; do not rerun unrelated checks without reason. Batch independent exports and shared checks; keep GPU reviews serial. Run the required route-start smoke check before pushing. Mark a model verified only after acceptance, not just successful generation.

## 8. Close the handoff

Report owned files, source evidence, output budget, checks, reference/render findings and unresolved limitations. Keep the report short. Update `poi-work-queue.json`, regenerate POI/dominant-building backlogs when coverage changes, and preserve earlier requests. The public views are `/landmark-queue.html` and `/manual-landmarks.html`.

## Cost discipline without reducing quality

Keep worker context small, references cached on disk, tool output bounded and shared integration coordinated. Do not print huge source datasets. Batch common build/check work. Preserve researched architecture and actual visual/game acceptance. Elapsed time includes research, waiting and review; token totals include cached context rereads and are not a direct percentage of subscription allowance.
