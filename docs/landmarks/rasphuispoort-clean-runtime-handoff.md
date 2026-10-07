# Rasphuispoort clean release runtime

Ported 2026-10-06 into the latest clean release without importing the dirty root's surveyed-envelope, facade or performance changes. This is a source/runtime integration checkpoint; visual/game acceptance remains pending.

The native spec config selects installed tile ring edge 18–19 of `NL.IMBAG.Pand.0363100012165086`. Only its ground-connected arch is subtracted. Other host triangles and neighboring textured facade/roof attributes remain exact; the distant wall 74.69 m behind the anchor stays. Combined gate, host, retained neighbors and extras have seven metres of clear entrance sightline.

The runtime transports exact opening config/revision through the existing worker, inline and cached-source paths. Successful cuts record explicit `hostOpeningIds` in the returned chunk. Picking rebuilds released CPU buffers with the installed opening metadata. Availability changes invalidate affected groups only; stale config/look/profile replies cannot replace current geometry. The existing indexed building pipeline, special kits/boats, keyed build queue, context lookup, shader/depth fade and frustum culling remain intact.

Signature model drawing and picking share `canShowModel`. Ordinary landmarks retain their usual eligibility. Opening-dependent models default to withheld unless the host supplies an active clipping predicate. In the game, Rasphuispoort is eligible only after Three is active/visible/ready and every resident host shell confirms its current revision and successful source cut. Pending loads/builds, validation rejection, disabled/absent/unready Three, measured colours, detailed/photoreal mode and out-of-zoom fallback withhold the gate. Active opening config is removed in fallback modes, restoring full ordinary geometry. Distant models skip eligibility checks until within residency radius.

Passed:

- `node --import tsx scripts/check-rasphuispoort-installed-passage.ts`
- `node --import tsx scripts/check-host-opening-chunks.ts`
- `node --import tsx scripts/check-host-opening-availability.ts`
- `node --import tsx scripts/check-building-look-transition.ts` (worker fixture echoes the new revision field)
- `node --import tsx scripts/check-building-lod.ts`
- `node --import tsx --test src/canalRecall/chunkBuildQueue.test.ts src/canalRecall/buildingContextIndex.test.ts`
- JS syntax checks and `git diff --check`

Full TypeScript checking reports existing unrelated errors; none reference the changed host/runtime files. Source records reuse private archive commit `9926aa1` at `models/rasphuispoort`.

Root still owns catalogue/spec registration, original GLB export/fingerprint, generated bundles, independent gallery/reference review, live source-facing/oblique/low gameplay views, desktop/touch pans and performance, destination/pin/card and meaningful physical-click checks. No GPU/git/catalogue/export mutations were made by this runtime worker. Suggested target anchor `[4.891053469773061,52.367740805556565]`, street camera `[4.89099354,52.36780312]`, camera elevation 2–3 m; review both retained neighbors `0363100012167502` / `0363100012175881` and host roof/windows/doors outside the opening. Preserve saved original uncut-host failure and earlier independent review.
