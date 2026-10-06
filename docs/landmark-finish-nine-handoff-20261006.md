# Landmark completion handoff — 2026-10-06

User resumed completion of nine existing unfinished landmarks after the RAI/Pulitzer pause, and then added Boom Chicago / Rozentheater roof and overall architectural-character review. Finish these ten requested items; preserve Viñoly/UvA and unrelated drafts. User explicitly requested this durable handoff before context/usage limits. Update it at each checkpoint.

## Published baseline and workspaces

- Latest completed RAI/Pulitzer public commit `cab071202239f3355427e1099fe5532dbff02001`, Hosting run37522191437 succeeded; exact live GLB bytes verified. Private raw/review source commit4666520 and deployed-fingerprint followupba87c87. Root checkout HEADcab07120; many unrelated dirty/untracked files must survive.
- New clean release/review worktree `/tmp/map-recall2-nine-landmarks-20261006`, detached from upstream `3d2e3d31`. Node_modules links to root. Serve `public/` (not repo root): `python3 -m http.server 5201 --bind 127.0.0.1 --directory public`. Server session70535. Root owns registrations, generation, GPU and Git; Rasphuispoort worker has explicitly delegated shared-runtime source window below.
- Existing private source publisher `/tmp/map-recall2-source-publish-20261006c` at pushedba87c87, private originals/cache sibling `/Users/blackmad/Code/map-recall2-source-data`. Fetch/rebase clean publisher before source push, stage scoped requiredPaths only. Source commit/push must precede each model commit.
- Previous working serial browser harness copied into new release `artifacts/landmark-release-check/{review-batch-current,check-batch-fallback}.mjs`. Set LANDMARK_REVIEW_URL=http://127.0.0.1:5201 and LANDMARK_REVIEW_CHROME=/Users/blackmad/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing.
- Root only runs one GPU review at a time. Source cameras need maxZoom28; default22 can clamp into a neighboring wall. Keep maxPitch85 and choose an eye/target that respects it. Wait actual surrounding-building residency and drawable chunks before neighbor tests.
- Live publication model URL is `/models/<id>.glb`; local development `/canal-drive/models/<id>.glb`. Stamp lives at `/deployment.json`. Verify exact SHA and GLB bytes after Hosting succeeds.

## First batch — De Gooyer, Nieuw Dakota, Pllek

Registered three own specs/builders/POI supplements in clean release and exported. Focused CPU checks pass. Runtime bundles rebuilt. Serial gallery/native review currently running: exec session33031, log `artifacts/landmark-release-check/first-three-native.log`; it produces each `{id}-review` directory. Earlier attempt92429 failed because HTTP root was wrong (404), not model geometry; server corrected.

- De Gooyer: revised source-supported scalloped green/white cap apron and white brackets,4088tri. Existing original native builder reused. Spec retains genuine extract_landmarks_33057057 / OSMn33057057. Source exterior route viewing finish Funenkade junctionn1450614806; preserve separate brewery and five more genuine installed neighbors. Original sources private9926aa1, additional installed tile/provenance copied to private `models/de-gooyer/files` needs new source publication. Camera+neighbor evidence root `artifacts/landmarks/de-gooyer-finish-20261006`. Author workerfinished; final independent/current-hash gallery/live review still required.
- Nieuw Dakota:4619tri/74492B, hash1579cea94e829e387c482fc3cb48b4a590c4dcaf640fddbfcb59f4818e3a7b5a. Full twin-gabled shared host with low extension; honest Former Nieuw Dakota card (public closureJan2025), retain northern tenant identity/front and brick warehouse/yard. Source-facing views should verify current blue facade/green glass and pale corrugation. No blocking source defect in fresh exact-GLB CPU comparison yet.
- Pllek:5787tri/82228B, hashbba5af70cbdea2ae03d045be47351009aba31760b309367b002cde71fceed3a5. Two red barrel halls, waterfront glass, low connector/yellowtower, empty beach. Root corrected canonical identity from requested-pllek to genuineOSMn4913392670 in spec/catalogue/POI supplement; preserve Treehouse neighbors. No blocking source geometry defect in CPU comparison yet.
- Independent reviewer `/root/review_dakota_pllek` owns those two reviewJSONs and `independent-dakota-pllek/` artifacts in clean release. No GPU/Git. Final gallery/live evidence pending; notify when ready. Potential independent review of De Gooyer must be assigned separately or added to bounded batch reviewer scope explicitly.
- Shared POI check baseline from upstream failed new ordinary models with no landmarkId; clean release checker minimally now expects zero destinations for such background-only models (does not invent generic POIs). Pass:187models179independentdestinations. Preserve checks for genuine POIs and existing original facts.

## Concrete geometry blockers / active ownership

### Centrale Markthal

Worker `/root/finish_markthal` finished authored candidate in ROOT owned builder/footprints/spec/poi/review/check. Copied candidate into clean release but not registered/exported yet. Exact old unprefixed276272968 alias corrected to `w276272968` in release spec; verify against actual installed feature before acceptance.

Geo-matched municipal west panorama proved old review compared wrong side: stair-2016 photo is EAST. Small LoD roof314/309 fragments do not represent entire glazed stairhouse. Candidate original photo-guided three-face projection follows actual BAG sidewall, continuous4.4–17.6m glass, approximate18.5m head and unchanged21.8m inwardtower. Native BAG ground footprint/loading wings/neighbors retained; no arbitrary neighbor cuts. Office upper wing shortened at photo-supported transition52.3m. Metrics explicitly inferred, not claimed surveyed.

CPU25420tri,108 immediate fractional panes pass;90 source-camera samples =85glass+5genuineframe firsthits, zero masonry/neighbor blockers. Exterior-normal contextual23occlusions remain preserved: source-direction comparisons determine whether those are legitimate loading-wall occlusions. Visual acceptance held pending export/reference/native/independent checks. New raw8000px municipal panoramas/metadata/provenance privately `models/centrale-markthal/raw/municipal-20261006`. Root camera/source record `artifacts/landmarks/centrale-markthal-finish-20261006/municipal-source-record.json`. Native west[-55.6059,2.5,54.2016], east[43.1379,2.5,54.2348]. Export then inspect full-context source/render; do not accept solely because CPU rays pass.

### Rasphuispoort

Worker `/root/finish_rasphuispoort` completed exact spec opening+CPU tests in root and now actively PORTS minimal host-opening runtime into CLEAN RELEASE. It owns delegated source window: hostWallOpenings.ts, threeBuildingFeatures/Mesh/BuildingsBrowser/BuildingsWorker.ts, signaturePlacement optional type, signature-landmarks-source.js and vector-map.js. Root must not edit those until worker reports frozen. No bundles/catalogue/export/GPU/Git worker rights. Do not copy whole dirty root runtime files: they contain unrelated envelope, performance, queue and shader changes.

Spec `hostWallOpenings[0]` uses real installed host ring18–19, source edge/profile/anchor and current ordinary projection; no host suppression or broad masks. Gate6440tri unchanged. Combined gate+host+two genuine neighbors+relief extras pass15rays in walls/coarse clear7m behind gate. Next wall is74.69m behind anchor, outside source entrance finger; do not carve it. Disabled/unavailable preserves original blocked fallback. Required gate/config availability together: with Three clipping inactive/unready/hidden, detailed/measured extrusion modes, withhold this opening-dependent additive gate and restore original host; restore both when mode returns.

Docs `docs/rasphuispoort-host-opening-handoff.md` in root has exact minimal dependencies/cameras. Source archived9926aa1 reused. Still need clean meaningful chunk/worker/stale-job/mode regressions, registration/export/fingerprints, independent gallery and actual game passage alignment/fallback/neighbor/card/route/pin plus desktop/touch pans.

### Boom Chicago / Rozentheater

Fresh worker `/root/finish_boom_rozentheater` active in ROOT owns only boom-chicago branch of shared `scripts/landmarks/nes-rozentheater-builders.ts` plus dedicated research/check/review. No shared catalogue/bundles/GPU/Git. Source current aerial/3DBAG/RCE518326 establish existing errors: hall truncatedz11, rear annex wrongly11.75m vs3.2m, frontage5single panes vs6pairs. Worker repairing source hallridge14.5/eaves10.7, short front barrel, two hipped towers,3.2mrearleftannex and13mflat rearpart. Two actual signpanels have roundedredBOOM and redsansCHICAGO; source-backed native contour/stroke lettering allowed, generic pixel name lettering rejected. Originals privately raw/2026-10-06 under canonicalmodelpack; root must source-sync/verify/push. Preserve old failed export and full building-character source/render comparison. Root extracts only owned branch diff from dirty shared root file.

## Remaining queued ready builders

Copied current own files/checks into CLEAN RELEASE for Monk, STRAAT, Treehouse, Vondeltuin; not yet registered/exported.

- Monk Amsterdam:4135tri full sharedhost,31surveyroofs229walls; fixed rooflights, varying glazing sill and0.55mroof/wall seam. Need independent fresh export/source comparison, native roof/support/tenant scope/route/pin/card etc. Whole host is not exclusively Monk-owned. Genuine extract_landmarks_2270458123, exact BAG0363100012136881.
- STRAAT Museum:8960tri; entryglazing repair/sourcegrey-brown material repaired; reexport and compare mural/portal/office and4rooflights from lowfront, then native integration. Genuine extract_landmarks_6741685223, exact Lasloods parent0363100012079735; retain NDSMcomplex neighbor.
- Treehouse NDSM:18779tri,16separate sourcePands; sourceyellow/mint cabin colors repaired. New export/native streetrow must establish color recognition, whitepitched roofs/twotallerworkinghalls, open courts/lanes and Pllekneighbors. Resolve genuine existing OSMsite/place identity instead of requested-treehouse-ndsm before publication.
- Vondeltuin:1869tri; source unequaloffsetroof volumes retained, repaired supportedsolar bank/straightdiagonalsunshade/five roofstep closures. Source/CPU preflight passed but gallery/game held. Genuine extract_landmarks_620869345; keep1927hut/playground/terrace unsuppressed.

## Release procedure / stop condition

Follow AGENTS/recipe and preserve unowned root files. Scoped source archival + checksum/bytes/access truth; private push before model commit. Record private commit/path in review/queue. Batch shared exporter/contracts/decoded checks; all source/photo/GPU comparisons and actual native route/pin/physicalcard/exactmasks/retainedneighbors/fallback required. Performance stationary comparison is bounded custom draw cost, not wholegame/touch proof; runtime clipping changes require actual desktop/touch pan evidence.

Reset generator date output to HEAD plus ONLY owned model date entries; do not stage200 unrelated date changes. Root owns git-index windows, fetch/rebase clean isolated commits for concurrent main activity. Push with PW_PORT=5201 and PW_CHROME path above (prepush lint+route-startsmoke). Watch Firebase and verify exact current model bytes. Periodic user updates; do not call idle workers active. Reconcile published owned assets back into root non-destructively with backups/CAS/index checks; unrelated drafts survive.

Keep all ten user requests tracked in poi-work-queue and regenerated landmark/dominant backlogs. Continuous all-day goal tool still reports paused from previous user pause and cannot be resumed via update_goal; current user explicitly authorizes this bounded new work. Do not start unrelated new queue buildings. Finish these ten, commit/push/deploy and report any genuinely unresolved remaining limitation honestly.

## Checkpoint: first two ready for publication

De Gooyer2ba75a13 and Nieuw Dakota1579cea9 independently source/gallery/native accepted; actual route/pin/physicalcard/masks/6+3neighbor/fallback pass. Sources +finalvalidation pushed private336ad5747f53149c41107f5fd05f01dd49ca87cc. Separate publisher `/tmp/map-recall2-arch-release-20261006` contains ONLY those two model changes +this handoff; no unreviewed model ships. Main review worktree keeps repaired Pllek/newremainingGLBs/runtime for later checks. Root borrowed tested old-review node_modules because dirtyroot dependency set had unrelated @types/threeerrors; typechecking passes with published dependency set. Markthal candidate stillheld narrowouterstairwall; author nowrepairing boundedhighfacade while preserving15.25m sourceannex roofs.
