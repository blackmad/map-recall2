# Rasphuispoort: required localized host opening

The original additive portal is CPU/source ready but **not visually or game accepted**. Do not register it as complete until the host opening and gallery/live reviews pass. Do not suppress or rebuild the entire Kalverpassage for this gate.

`buildRasphuispoort(w, d, BuildingTools)` in `scripts/landmarks/rasphuispoort-builder.ts` ignores fitting dimensions and exports native geometry. Genuine POI identity is `extract_landmarks_953524097`. Its address is Heiligeweg 19. Current BAG identifies the host as `NL.IMBAG.Pand.0363100012165086`, a 1997 shopping complex with 72 VBOs; the historic gate dates from 1603. Keep the existing POI's prison/brazilwood facts.

Current BAG facade edge, retrieved 2026-10-05:

- West/south endpoint: `[4.891024733991401, 52.367730439137524]`.
- East/north endpoint: `[4.891082205554721, 52.367751171975605]`.
- Anchor `[4.891053469773061, 52.367740805556565]`; coordinates are longitude/latitude.
- Measured edge length 4.53726 m; authored portal frontage 4.46 m.
- Author rotation around Y is -2.6079504457462543 radians (-149.42455 degrees).
- Native axes east/south metres; transform `east = x*cos(a)+z*sin(a)`, `south = -x*sin(a)+z*cos(a)`. Authored +Z points northwest toward Heiligeweg; interior is -Z. Scale 1, ground Y 0.

Approximate portal clearance from the inspected 2020 author photograph: X ±1.07 m, Y 0–2.63 m plus round arch to crown Y 3.70 m. Portal depth is approximately 0.94 m; highest figure reaches 7.23 m. These vertical dimensions are photo estimates, not measured drawings. A host cutout must use this profile or a verified compatible passage profile, with explicit side/soffit surfaces and no solid threshold. The portal itself leaves its opening clear.

The source polygon has a covered passage finger behind the gate. Its current BAG local vertices are `[-2.13308,-10.67570], [-2.26863,0], [2.26863,0], [2.36992,-7.25237]` (X/Z metres). These specify attachment context, not authorization to carve the entire finger or create a new destination. The opening must continue far enough into the host for a real clear sightline; determine the actual internal passage/ceiling extent from survey or current context evidence before broadening it. Source data and a synthesized installed wall ray establish the blocker, not a completed runtime implementation.

The installed tile gives host height 29.36 m and fills the edge through the gate. `scripts/check-rasphuispoort-geometry.ts` reconstructs the actual installed host outline as an ordinary shell and confirms that its wall blocks the otherwise open portal. Preserve this failed integration evidence prominently. Current BAG and installed outlines differ slightly; retain both as recorded, use native attachment carefully, and do not claim their coordinates identical.

Required capability behavior: a small, explicit opening scoped by host identity and the gate edge/profile, activated only when the additive GLB is available; restore full ordinary fallback on unavailable/disabled replacement. It must apply consistently to ordinary facades/streamed or cached geometry without hiding the whole complex or its independent roofs. Avoid a global nearest-facade heuristic or padded spatial mask.

Retention regressions: keep the host complex, its roofs and courtyard/other entrances; keep immediate neighbors `NL.IMBAG.Pand.0363100012167502` and `NL.IMBAG.Pand.0363100012175881` plus all other intersecting records in the source pack. Check current residency from both street directions, exposed portal columns/cart relief, open passage ray/sightline, no floating depth offset, host windows/ground doors beyond the bounded opening, unavailable-model fallback and neighbor roofs. Gallery views need reference comparison and an independent reviewer. Live camera checks must include actual gameplay desktop/touch pans, meaningful card pointer selection, retained destination, geographic pin and route arrival/failure behavior.

Raw sources are in `artifacts/landmarks/rasphuispoort/references`, with URL/date/checksum/access states in `raw-source-manifest.json`. The locally packaged ZIP contains unchanged original installed tile GZIP bytes; it is explicitly not an HTTP response. Current BAG/RCE/Commons page bodies and original photographs are separately retained. Beeldbank address search returned a JavaScript shell; a bounded search located archival photo 012000006381 via Commons. No inspected drawing or email access is claimed. All raw files must be archived privately and committed before a model commit. Shared registration/export/GPU/git remain coordinator work.

## Subsequent CPU/runtime draft progress

The scoped geometry prototype is in `scripts/landmarks/host-opening-geometry.ts`, with independent review in `artifacts/landmarks/rasphuispoort/host-opening/independent-review.json`. The runtime typed-array implementation is `src/canalRecall/hostWallOpenings.ts`, integrated through optional chunk configurations and browser/worker availability revisions. Run `node --import tsx scripts/check-host-opening-chunks.ts` and `node --import tsx scripts/check-host-opening-availability.ts` for exact installed geometry, retained attributes/neighbors and load/fallback/stale-job behavior. The runtime helper adds no Three dependency.

Configurations remain default empty: no Rasphuispoort activation, catalogue registration or native acceptance is implied. Current unverified items include native alignment, the actual deeper passage, MapLibre extrusion fallback with Three disabled, and gallery/game/performance checks. Keep the original blocker and failed evidence until these checks pass.

## 2026-10-06 exact installed passage handoff

The original baseline failure remains valid **without the configured opening**. The saved deeper-ray interpretation has now been corrected: after exact edge clipping the next host wall is **74.69 m behind the anchor**, well beyond the photographed/BAG entrance finger (7.25–10.68 m). Do not carve it. A clear seven-metre entrance sightline is enough for this additive gate's physical scope; this does not reconstruct or claim a walkable through-route across the shopping complex.

`rasphuispoort-spec.json` now owns `hostWallOpenings[0]`. Its source edge is installed ring indexes 18–19, not current BAG 24–25. The local edge coordinates use the actual ordinary-chunk projection (ORIGIN latitude for longitude; 110540 latitude projection) and a source anchor. The renderer supplies current flat-atlas reveal material, and SignatureLandmarks supplies `additiveModelAvailable` only for a successfully loaded/shown entry. No suppress IDs or spatial mask are added. No gate builder change or extra depth was necessary.

`node --import tsx scripts/check-rasphuispoort-installed-passage.ts` combines the original gate, real installed ordinary host/neighbors and relief extras. Walls and coarse modes pass 15 opening rays each to 7 m behind the anchor, show both half-columns ahead of the host, preserve the distant closure and restore ordinary blockage when the asset is unavailable/disabled. `check-host-opening-chunks.ts` retains the independent attribute/triangle/neighbor/fallback checks. `check-host-opening-availability.ts` passes the real worker/source-residency and stale-job checks. These are CPU results; visual/game acceptance is still pending.

### Minimal integration dependencies for root

- Native asset files: `scripts/landmarks/rasphuispoort-{builder,footprints,spec,poi,review}`; original mesh remains 6,440 triangles, scale 1.
- Shared runtime helper: existing `src/canalRecall/hostWallOpenings.ts` and its existing import/config transport in `threeBuildingMesh`, `threeBuildingFeatures`, `threeBuildingsBrowser`, `threeBuildingsWorker`; do not include unrelated facade/roof changes just because those files share edits.
- Existing loaded/shown metadata bridge: `SignatureLandmarks.shownHostWallOpenings()` / `onHostWallOpeningsChanged`, and `VectorBasemap._syncHostWallOpenings()` called after residency, mode and suppression changes.
- Shared catalogue/types must preserve optional `hostWallOpenings` metadata through fetched catalogue to each signature spec. Root exports/registers/fingerprints/rebuilds bundles.
- Focused checks: new `scripts/check-rasphuispoort-installed-passage.ts`, existing `check-rasphuispoort-geometry.ts`, `check-host-opening-chunks.ts`, `check-host-opening-availability.ts`, and the independent Three prototype `scripts/landmarks/host-opening-geometry.ts`.

**Mode/fallback requirement:** Only show this opening-dependent additive gate when the ordinary clipping renderer is available and active. With Three unavailable/disabled or measured-colour mode restoring an opaque MapLibre extrusion, restore the original ordinary host and withhold this additive gate. Do not hide the whole host, move the gate forward, filter the whole complex or silently leave the ornamental gate in front of an uncut wall. On restoring the clipping mode, restore the shown gate/config together. Test repeated mode switches plus load failure. Root owns this shared runtime change.

Suggested native source-facing camera: target anchor `[4.891053469773061,52.367740805556565]`, street-side station approximately `[4.89099354,52.36780312]` (author +Z, 8 m out), elevation 2–3 m with target around 3 m. Also use a full-crown view further out and oblique low views from each street direction. Exact neighbors `NL.IMBAG.Pand.0363100012167502` and `NL.IMBAG.Pand.0363100012175881` must remain, with host roof/windows/doors beyond the opening. Review the original source photo at private `models/rasphuispoort/files/commons-2020.jpg`. Source archive commit remains `9926aa1`; this pass reused its records and did not acquire new raw inputs.
