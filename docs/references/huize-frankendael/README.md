# Huize Frankendael reference handoff

Original native metre draft of the single BAG parent at Middenweg72. Full originals and raw HTTP bodies remain private in `../map-recall2-source-data/models/huize-frankendael/raw/`; `acquisition.json` retains URLs, checksums, dates, rights and failed attempts. No source photos are copied into the game repository.

Read `research.json` and `scripts/landmarks/huize-frankendael-footprints.json`. RCE422420 was read before authoring. The bounded Beeldbank address/name search produced a JS shell, explicitly not a viewed drawing. Front2022 and rear2014 photographs were inspected against BAG/OSM and AHN5 2023 roof evidence. Current operator source is undated (uploaded2016), not described as a2026 capture.

Root integration: register `huize-frankendael-spec.json`, import `buildHuizeFrankendael(w,d,b)` from the dedicated builder, and merge meaningful `huize-frankendael-poi.json` facts under existing `extract_landmarks_746892406`. Exact native +X bearing316.086/+Z principal NE front46.086; spec rotation northOffset226.086. There is no fabricated POI or name lettering. Gate/fountain and immediate southeast church/outbuilding remain separate.

Reproduce draft without shared mutations:

```sh
node --import tsx scripts/landmarks/huize-frankendael-export-draft.ts
node --import tsx scripts/check-huize-frankendael-geometry.ts
LANDMARK_CPU_INPUT_DIR=artifacts/huize-frankendael-draft LANDMARK_CPU_OUTPUT_DIR=artifacts/huize-frankendael-draft LANDMARK_CPU_ELEVATION=.36 LANDMARK_CPU_VIEWS='[[0.24,"front"],[3.38,"rear"],[1.4,"northwest"],[4.64,"southeast"]]' node scripts/landmarks/render-cpu-preflight.mjs huize-frankendael
```

Root-only GPU harness after shared registration/export/bundles: `LANDMARK_REVIEW_BASE=http://127.0.0.1:5196 node scripts/landmarks/huize-frankendael-review.mjs`. It captures the higher gallery, four lower rotations and both native sides; checks selected genuine finish, pin, loaded exact aliases, pyramidal masks, drawable retained neighbors, and physically clicks the sourced card. The harness has only had syntax checking; root owns serial GPU. Root must inspect source comparisons, obtain independent failure review and run shared integration checks before acceptance. Successful geometry/CPU export is not visual or game acceptance.

Source commit/push and both git indices belong to root. The private model originals were locally checksum-verified; source publishing remains pending. Do not publish this draft as accepted merely because checks pass.
