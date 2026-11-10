# House line

The canonical doc for the house assembly line (plan: `docs/handoffs/house-line-plan-20261110.md`, issue #339 for this
section). Sections 1-4 and 5-6 belong to the other lanes (H1 spec, H2 preview, H3 stage/publish, H5 describe, H6 kit
gaps); this file starts with the section the crop lane (H4) owns. The integrator unions the sections when the lanes merge.

## 4a. Crops: `npm run house:crops`

Station "describe at scale", first half: one rectified, quality-flagged facade image per street-facing pand of a buurt,
so that pixel measurement and the Jev typed judge (H5) and the preview compare sheet (H2 `--photo`) read a photo
instead of a hand-run block. Manual crops covered 887 strips + 571 reference walls against 192,567 pands; this makes
the crop a city-scale, resumable step.

### Command

```
npm run house:crops -- --buurt <code> [--pand <id>] [--resume] [--dry-run] [--rate-ms 500]
                       [--archive <dir>] [--limit <n>] [--restart] [--report]
```

`npm run house:crops -- --help` prints the same text (the `HELP` constant in `scripts/house-crops/crops.ts`).

| Flag | Meaning |
|---|---|
| `--buurt <key>` | required. CBS buurt by 4-letter code (`AB07`), CBS code (`BU0363AB07`) or name (`Bloemgrachtbuurt`), from `public/data/extracts/amsterdam/coverage-v1/buurten.json`. Pands are the BAG pands whose footprint centroid lies inside the outline. |
| `--pand <id>` | one pand only (16-digit BAG id, with or without `NL.IMBAG.Pand.`); it must lie in the buurt. |
| `--resume` | continue from the manifest: pands with status `ok`, `no-wall`, `no-pano` are skipped, `error` is retried. A kill between the archive write and the manifest write is healed from the archived `front.json`. Without `--resume` an existing manifest stops the run. |
| `--restart` | throw the manifest away and start over (cached API responses are still reused, so this repeats no requests). |
| `--dry-run` | no network, no writes: walls found, how many take the strip route, panorama-list cells, estimated requests and minutes. |
| `--rate-ms <ms>` | minimum gap between the starts of two network requests, default 500. Cache hits cost nothing. |
| `--archive <dir>` | root of the `map-recall2-source-data` checkout or lane worktree; default env `HOUSE_CROPS_ARCHIVE`. Required unless `--dry-run`. |
| `--limit <n>` | stop after n pands this session (smoke runs). |
| `--report` | print the coverage table and write the contact sheet from the manifest, nothing else. |

Set `PAND_REFERENCE_CACHE=/Users/blackmad/Code/map-recall2/.cache/pand-reference` so every worktree shares one panorama cache
(a re-run, or a neighbouring buurt, then downloads only what is new).

### What it does per pand

1. **Wall.** `scripts/pand-reference/select.ts pickWall`: the longest exposed (not party-wall) BAG edge whose normal faces the
   nearest road or quay.
2. **Panoramas.** One panorama list per 30 m cell (radius 57 m, one request set shared by every pand in the cell), then
   `rankPanos`: camera 5-35 m from the wall (8-25 m preferred), obliquity <= 55 degrees, standoff > 2 m, straightest view first, newer breaks near-ties.
3. **Route.** Normal: `rectifyWall` onto the BAG wall at 50 px/m. Strip fallback (`planStrip`, `block-face/intake.ts` method): the
   wall is under 4 m, or the best view is over 35 degrees oblique (a mid-row pand on a narrow street, camera beside the wall). The
   pand's block face (collinear neighbouring walls, `groupFaces`) is planned on one capture day, up to 3 panoramas >= 2.5 m apart are
   median-fused at 40 px/m over the pand's span plus 1 m each side, and the pand's span is cut out (`spanPixels`, `cutSpan`).
4. **Second try.** A crop that breaks a cap gets one more attempt from a panorama of another capture day (leaf-off months and straight views preferred); the one with the smaller total excess is kept.
5. **Flags and archive** as below.

### Flags and `usable`

All thresholds live in the `THRESHOLDS` constant of `scripts/house-crops/flags.ts`; `usable` is true when none is broken.

| Flag | Measures | Cap |
|---|---|---|
| `voidShare` | share of pixels not sampled from the panorama (behind the camera, off the image), rows 10-90 % of the crop | <= 0.35 (as `auto-place.ts`) |
| `foliage` | leaf-coloured share, `isLeaf` (`pand-reference/rectify.ts foliageFraction`) | <= 0.30 (as `auto-place.ts`) |
| `washedOut` | bright, colourless mid-wall share: sheeting, overexposure, fog (`washedOutFraction`) | <= 0.50 (white-painted fronts reach 0.3) |
| `occluderShare` | largest connected dark (luma < 50) blob in the lower third as a share of that third. **A proxy** for a parked van or scaffold, not a detector: dark shopfront glass trips it, pale vans and bare tree trunks do not | <= 0.35 |
| `obliquity` | angle between wall normal and wall-to-camera ray, degrees | <= 55 |
| `cameraDistance` | camera to wall centre, metres | 5-35 |
| `missing` | share of invalid pixels over the whole crop (informational, not a gate) | - |

Known blind spots, found in the pilot: bare winter branches over a front are not foliage; a white van is not dark; a dark shop
window can read as an occluder. Judge the contact sheet, not the flags.

### Archive and manifest

* Crops: `map-recall2-source-data/pand-crops/<pandId>/front.jpg` (JPEG q80, rectified: x along the wall left to right seen from the
  street, y up from the ground, 50 px/m or 40 px/m on the strip route) and `front.json`: panorama id(s) with timestamp, camera
  distance, obliquity and source URL (`https://api.data.amsterdam.nl/panorama/panoramas/<id>/`), mission date, the wall in RD
  (EPSG:28992), crop size / scale / ground height, flags, `usable`, `rejectedBecause`, the thresholds used, attribution (Gemeente
  Amsterdam, CC BY 4.0). Every crop is archived, usable or not, so rejections can be judged by eye.
* Game repo: `scripts/house-crops/manifests/<buurt code>.json`: buurt, thresholds, one record per pand (`status` `ok` /
  `no-wall` / `no-pano` / `error`, `method` `wall` or `strip`, `usable`, `reasons`, `flags`, `archive` path, `panoIds`, `date`,
  `ppm`) and one entry per run session (requests, bytes, retries, 429s, wall seconds). This is what H5's `house:describe --buurt`
  and H2's `--photo` read to find a pand's crop.
* The lane commits the archive on a branch of a dedicated `map-recall2-source-data` worktree; the integrator pushes it.

### Rate rule

One request start per 500 ms process-wide (`http.minGapMs` in `scripts/pand-reference/core.ts`, off by default so older scripts are
unchanged), at most 3 in flight, up to 6 attempts with exponential backoff (400 ms x 2^n) on 429 and 5xx, `Retry-After`
honoured. User-Agent `MapRecall-HouseCrops/1.0 (+repo URL; Gemeente Amsterdam panoramas CC BY 4.0)`. The request, byte, retry
and 429 counts are in the manifest sessions and the report. A 429 in a log is a failure of this rule: stop and raise `--rate-ms`.

### Report

`--report` (also printed at the end of every run) gives the coverage table: pands, walls found, crops made, usable, rejected by
reason (primary and every broken cap), by route, API requests, bytes, wall time; and writes
`artifacts/house-crops/<code>-report.md` and `<code>-sheet.png`, a contact sheet of 48 random crops (fixed seed) labelled with
route, verdict and flags (green frame usable, red rejected).

### Running the next buurt

1. `node --import tsx scripts/house-crops/crops.ts --buurt <code> --dry-run`: pands, narrow-wall count, estimate.
2. Make a source-data worktree: `git -C ~/Code/map-recall2-source-data worktree add --no-checkout -b lane/<lane>-pand-crops-<date> ~/Code/map-recall2-source-data-<lane> origin/main`, then in it `git sparse-checkout init --cone && git sparse-checkout set pand-crops && git checkout`.
3. `PAND_REFERENCE_CACHE=... HOUSE_CROPS_ARCHIVE=<that worktree> nohup npm run house:crops -- --buurt <code> > artifacts/house-crops/<code>-run.log 2>&1 &` (the log lives in the worktree; zero bytes means working; kill with Ctrl-C or by PID, then `--resume`).
4. Read the sheet, commit the archive in the source-data worktree, commit the manifest in the game repo.
5. Pick buurten by where players ride (centre and inner ring, `RIDE_PRIORITY_GEBIEDEN`), then by the number of staged hand intents (they let H5 score writer-versus-hand agreement).

Tests: `node --import tsx --test scripts/house-crops/flags.test.ts` (thresholds, void/occluder shares, span cut, face grouping).
