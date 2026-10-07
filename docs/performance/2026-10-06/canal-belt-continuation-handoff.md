# Canal-belt ordinary-building handoff

Updated 2026-10-07 20:51 UTC. This replaces the earlier temporary-directory checkpoint. The continuous building request remains active; the newest two models are **not yet published**.

## Scope and acceptance

Work on fairly boxy ordinary/non-landmark warehouse conversions and modern buildings inside the Amsterdam canal belt. Preserve observed opening groups, top-floor windows, ground-floor doors, material colors, roof steps and native footprints. Use inexpensive source-specific assemblies rather than generic facade painting. Exclude elaborate monuments, unresolved raised structures and complex courtyard/multiwing buildings from this quick queue. Do not invent signage, curated POIs or route destinations.

Root owns shared catalogue, registration, bundles, browser/GPU review and git/source publication. Fresh scoped workers own isolated building directories. Acceptance requires source/geometry review, independent actual rendered comparison, exact loaded-ID suppression across all ordinary layers, retained neighbors/fallback, desktop and touch gameplay pans away from a stationary rider, zoom-out and performance evidence. CPU checks alone are insufficient. Read AGENTS.md and docs/landmark-building-recipe.md before integration.

## Persistent workspace and recovery

Temporary worktrees and process handles disappeared during a tool-session transition. Do not use old /tmp paths or describe their processes as running. Published private checkpoints survived and were recovered and checksum-verified. Keep ongoing work in persistent paths:

- Canonical shared repo: `/Users/blackmad/Code/map-recall2`. Large unrelated dirty tree; preserve its files, index and dependencies. Its local HEAD is not current public main.
- Clean integration clone: `/Users/blackmad/Code/map-recall2-worktrees/canal-box-release-recovery`, detached public base **59dab6aec058827fd3b8d1e421e54531efad75bf**. Public origin is `git@github.com:blackmad/map-recall2.git`. It currently contains published20 plus two pending models, portable generator/checker changes and rebuilt signature bundle. Never stage its entire tree blindly.
- Private sparse source clone: `/Users/blackmad/Code/map-recall2-worktrees/canal-box-source-recovery`, HEAD **ce20c5f717902d0363d6151d51223d6386f1b4db**, origin `git@github.com:blackmad/map-recall2-source-data.git`. Sparse prefix `experiments/canal-belt-continuation-20261007`. Other agents' canonical source repo is dirty; do not use its index.
- Independent review: `/Users/blackmad/Code/map-recall2-worktrees/canal-box-final-review/review.json`.

The integration clone now has its own package-lock-pinned dependencies from `npm ci --ignore-scripts --no-audit --no-fund`; canonical node_modules was left untouched. Server port49329/session92728 was started before this install: verify ownership and restart with current dependencies before final browser checks. Session handles are hints, not durable evidence.

## Two recovered models awaiting release

### Haarlemmerdijk1–7 / KortePrinsengracht22–34 — BAG0363100012165204

1967; native1,151m², no holes. Main edge9: three11-group green-window tiers, white Juliets, broad retail piers/canopy and thin roof rail/beams. Canal edge6: raised shops, pink basement doors and corrected continuous pale lower4.5m zone. Preserve rear raised188m² roof and275m² low6m roof; documented tiny equipment omissions do not become whole-building heights.

Final packed GLB: **520,176bytes / 7,357triangles / 3materials**, SHA256 **15d6ea5dd01e55344422b75767cc539563bd1932ad52f7e5d3d008ee738f310b**. Original7-material author export violated the three-material budget. Packing preserves expanded positions, normals, facade UVs and roof attributes exactly, merges physical colors into normalized uint8 vertex colors, and unifies roughness .9/.95 to .95. Maximum linear color error .0019437888 <=1/510. Size is4% over the500KB preference; retain this explicit exception instead of removing defining geometry.

Independent source/geometry/actual packed GPU **PASS** at20:41UTC, including corrected canal face. Original tan lower-zone HOLD remains archived. Portable stage: `scripts/ordinary-buildings/build-canal-belt-box-details.mjs`; it applies only this ID and rejects double application.

### Singel532–540 / Reguliersdwarsstraat59–63 — BAG0363100012168482

1966; native1,349m², no holes. Gray slab panels, square-pane groups, dark recessed top and end stacks, tall retail glazing. Retain dominant989m² roof at21.52m and342m² roof at18.06m; documented roof equipment/cutout simplifications do not invent ground courts.

Final GLB: **139,672bytes / 956triangles / 3materials**, SHA256 **466b074f4d5ae238b0570cf5218390e6e409d58e275e4ffa839faa165f497a6f**. Southern actual edge9 uses current municipal01838: four paired tiers, western shops, eastern loading doors. Neighbor's glazed edge7 is no longer borrowed.

Independent source/geometry/actual corrected-secondary GPU **PASS** at20:41UTC. Earlier wrong street/camera failures are archived. Required secondary metadata is normalized in recovered recipe/catalogue: target[4.891887,52.366339], bearing196.04, distance42, height9 and referenceImages array. Shared build.ts now conditionally propagates gallery metadata and supports opt-in fixedFacadeTopMetres.

### Verification boundaries

Both had exact-hash desktop/touch functional game checks before temporary-directory loss; the original archived runs are in checkpoint03. Earlier warm frames were16.7–16.8ms; startup maximum longtasks251ms desktop /175ms touch. Packed Haarlemmer desktop later passed functional checks but warmmedian/p9533.3/33.4ms, startup181ms. Same-code original7-material baseline also measured33.3/33.4ms, startup432ms: no observed packing regression, **no stall-free claim**. The later baseline files were lost and must be repeated if durable baseline evidence is needed. Packed touch final evidence was lost; do not claim it passed.

Current public59dab6ae includes newer suppression changes: rerun both exact-hash models on this runtime before admission. Structural check now passes all22 models; signature bundle rebuild passes. Standalone `npm run lint` passed with pinned dependencies at20:51UTC. Full old20 byte-identical regeneration must be re-established with pinned dependencies and complete processed reference inputs. Previous reproduction proof is archived, but it predates final packing.

## Current next-building worker and findings

Only `/root/kalver_persistent_rebuild` is actively modeling at this checkpoint. It owns:
`.../canal-box-source-recovery/experiments/canal-belt-continuation-20261007/kalver-rebuild`.

**Kalverstraat99 — BAG0363100012168201**, native463m²/no holes, cached checkpoint02 discovery sources. Current exact wall-plane projection corrects an earlier handoff: brick core occupies **northern/left ~12.5m**, glazed commercial flank **southern/right ~6m** of street edge2. Do not use the reversed old orientation. Broad transomed ground bays and paired tall upper openings; small top openings are being cross-checked. Dominant roof40=397m²/12.49m; strip38=3.61m²/~14.54m; raised39=52.20m²/~15m; equipment41=4.54m² explicitly omitted. First rebuilt export105,016bytes/675triangles/2materials passed structural checks but CPU views found nearest-roof-region perimeter fins. Worker is correcting per-edge heights before freezing; **not accepted**. References/failures remain persistent.

**Spuistraat242–250 — BAG0363100012175754** is next, with cached checkpoint02 original discovery sources. No active Spui worker currently. Ochre brick, dark recessed balconies, central polygonal glazed top bay/red frames. Official BAGv4 footprint644.495m² matches native644.212m²;584.55m² is a3DBAG reconstructed-area statistic, not the official outline. Main native edges13 central,15+16 north and11 south; earlier draft omitted edge16 and was corrected. Roof masses include312.8m²/14.67m,80.6m²/12.08m,70.9m²/3.87m low interior and32.9m²/12m. A tiny steep fitted high patch remains explicitly uncertain; do not make its20.25m plane a whole-building height. Prior temporary Kalver/Spui GLBs were not archived and disappeared. Their reported sizes/checks are historical findings, **not existing recoverable exports**. Rebuild from cached sources in fresh persistent scoped workers.

## Held/deferred work

- Singel475–483 / Kalver228–230, BAG0363100012175221: HOLD. Corrected composition/source ownership was promising, but Kalver attic/pier backing and an inset far roof-cap support remain unresolved. Latest temporary continuous-backing repair was not archived and vanished. Original older drafts/sources survive checkpoint01. Do not extend all party edge7 to21m: root boundary rays mostly hit low8.35m interior roof, contradicting that repair.
- Pale Singel arcade, BAG0363100012175216: HOLD. AHN supports a broad high-return cluster; the literal32m roof sail's physical role/ownership remains unresolved. Do not lower it from parent median alone. Archived checkpoint01/02 evidence survives.
- Telephone exchange Herengracht295 / Singel340, BAG0363100012164994: deferred from quick boxes; registered ornate historic assembly needs full architecture loop. Sources/draft archived; no invented POI.

## Source gates and feedback

Private pushed source checkpoints under `experiments/canal-belt-continuation-20261007`:

- **a588990cc983751afd09ac17d0ffd62d11401596**, checkpoint01:473payloads,52,046,531bytes; older drafts, failures and originals.
- **ac1c67511a5d39085212b46247b97c287980d482**, checkpoint02:284payloads,113,205,415bytes; raw discovery APIs/panos/3DBAG/AHN, derived feature subsets, initial GPU/game and AHN contradiction.
- **2249ce1e871c2c39ddcf1adeb603f02fb716c098**, checkpoint03:157payloads,55,768,213bytes; final two author packages, original Reguliers01838, corrected GPU/game and portable normalized integration metadata. All157 checksum payloads verified after recovery. An earlier erroneous copied node_modules directory was removed in this checkpoint; exclude dependencies/symlinks/.git in future archives.
- **7a366827879aadd6f1059bf6424c3eef5b8480ab**, packing04:19payloads; final packed Haarlemmer GLB, portable packing/checker, exact geometry/color proof, GPU and packeddesktop evidence. All19 checksums verified after recovery.

Canonical author reference roots: `checkpoint-03/processed/authors/<BAG>/source`. Root normalized recipes/catalogue/build.ts: `checkpoint-03/processed/integration`. Actual source/render review verified48 relevant checksum files with no failures. Archive/push the new independent review and current-runtime checks before the public model commit, and record their commit/path in fidelity/inventory/docs. Do not recursively copy dependencies or unrelated files. Cache raw API/photos in private repo; main artifacts are acquisition staging only. Retry transient source failures boundedly; a network-disabled worker is not a host outage.

Latest successful Firebase pulls: **2026-10-07T20:38:15.436Z**, open1/in-progress1. Open OCCII `063e3e2c-0627-48a8-b835-f407fee9cbe7` reports facade misalignment; full note/screenshot were previously inspected, remains unclaimed/unresolved. Melkweg `26b15ccf-5dd2-46e9-abf3-a103dc2ab5d5` is claimed elsewhere; do not duplicate. Evidence: integration `.cache/canal-feedback/queue-{open,in-progress}.json`. Use canal-feedback skill and update-time conditional claims; pull before release/batch checkpoints and at least every30minutes.

## Next actions and useful split

1. Integration owner: finish current pinned-dependency lint/reproduction, restart own current server, run gallery and desktop/touch stationary-pan/zoom-out/suppression/neighbor/fallback checks for the two recovered hashes. Inspect actual frames and record performance honestly. Check manual22-card page/feedback dialogs without submitting test feedback.
2. Archive current review/runtime evidence in private source clone; checksum and push before public models. Update scoped fidelity and work inventory only for passed models. Keep held assets out of catalogue and preserve earlier queues.
3. Commit only accepted changes, fetch/rebase public latest without disrupting shared work, push periodically. Firebase workflow requires lint/build/smoke. Verify specific deployed revision and hosted GLB hashes, manual page and feedback on desktop/touch. New models remain unpublished until this completes.
4. Building owner: let persistent Kalver worker finish its bounded corrections; independently review export, actual source/gallery and game. Start fresh persistent Spui worker from archived sources. Continue more true canal-belt boxes after batch checkpoints; source paperwork does not replace modeling.

Production demo remains https://canalrecall-blackmad.web.app/manual-ordinary-buildings.html with20 published buildings. New two are pending in the clean22-entry integration clone. The old `artifacts/canal-belt-continuation/index.html` is stale CPU evidence, not a current demo. Do not mark the continuous goal complete at this checkpoint.

## 21:00 UTC release checkpoint

Both recovered boxes now pass current59dab6ae desktop/touch exact-hash gameplay replacement, neighbors, disabled/load-failure fallback, stationary pans and zoom-out. Warmmedian/p9516.7–16.8ms; startup longtasks remain. Root inspected current gallery/main/secondary and gameplay frames. Manual22 models load on desktop/touch and feedback captured previews work without submitting notes. Pinned-dependency lint/structural checks pass; all22 full generator+detail-stage GLB hashes reproduce exactly. Scoped fidelity/catalogue acceptance is recorded; hosted publication is still pending.

Private acceptance archive **b444eca8edfc9cc545047bebbf92b9c315d79c23**, `experiments/canal-belt-continuation-20261007/runtime-05`,42payloads36,424,004bytes, checksummed and pushed. Source origin switched to HTTPS after SSH publickey rejection; gh existing keyring authentication works. New review summary: `public/canal-drive/ordinary-buildings-data/canal-box-review-20261007.json`.

Kalver independent review held first frozenff4d: glass shifted1.3m, source-backed rightbrick/windowstrip omitted. Author is implementing12.9–18.9m glass plus18.9–21.05m brick; frozenfailed export preserved. Spui204476byte1579triangle draft has58pane/topbay probes but CPU exposed native-versus3DBAG roof coverage gaps; author correcting bounded native roof infill/closures before freezing. Neither next draft is accepted.
