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
                       [--archive <dir>] [--limit <n>] [--years <n>] [--restart] [--rejudge] [--report]
```

`npm run house:crops -- --help` prints the same text (the `HELP` constant in `scripts/house-crops/crops.ts`).

| Flag | Meaning |
|---|---|
| `--buurt <key>` | required. CBS buurt by 4-letter code (`AB07`), CBS code (`BU0363AB07`) or name (`Bloemgrachtbuurt`), from `public/data/extracts/amsterdam/coverage-v1/buurten.json`. Pands are the BAG pands whose footprint centroid lies inside the outline. |
| `--pand <id,id>` | only these pands (16-digit BAG ids, with or without `NL.IMBAG.Pand.`); they must lie in the buurt. |
| `--years <n>` | best of up to n mission years per pand, default 6; `--years 1` is the single-year baseline. |
| `--rejudge` | recompute `usable`/`reasons` for every manifest entry from its stored flags (no network); after a THRESHOLDS-only change. A change to what a crop *is* bumps `RULES_VERSION` (manifest.ts) and needs `--restart`; `--resume` refuses an older manifest. |
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
   `rankPanos`: camera 5-35 m from the wall (8-25 m preferred), obliquity <= 55 degrees, standoff > 2 m. Each candidate is ray-checked: a camera ray to the wall centre that crosses another BAG footprint is `blocked` (alley and neighbour views).
   One representative per mission year (up to `--years`, 2016-2025) is ranked: clear ray and <= 35 degrees first, then leaf-off months (Nov-Apr), then newer years.
3. **Route.** Normal: `rectifyWall` onto the BAG wall at 50 px/m. Strip fallback (`planStrip`, `block-face/intake.ts` method): the
   wall is under 4 m, or the best view is over 35 degrees oblique (a mid-row pand on a narrow street, camera beside the wall). The
   pand's block face (collinear neighbouring walls, `groupFaces`) is planned on one capture day, up to 3 panoramas >= 2.5 m apart are
   median-fused at 40 px/m over the pand's span plus 1 m each side, and the pand's span is cut out (`spanPixels`, `cutSpan`).
4. **Best of N years.** The years are rectified in that order and the first crop that passes every check wins, so extra panoramas are fetched only for fronts that need them; if none passes, the crop with the fewest broken caps is kept. `front.json` records `chosenYear`, `candidates` (year, panorama, verdict, reasons) and `missionYearsAvailable`. A cross-year median that masks occluders was not built (optional in the brief): on the labels the failures are bare trees and wrong walls, which a median over years does not fix, and it would risk blending colour across years.
5. **Flags and archive** as below.

### Flags and `usable`

All thresholds live in the `THRESHOLDS` constant of `scripts/house-crops/flags.ts`; `usable` is true when none is broken.

| Flag | Measures | Cap |
|---|---|---|
| `voidShare` | share of pixels not sampled from the panorama, rows 10-90 % of the crop | <= 0.35 (as `auto-place.ts`) |
| `foliage` | leaf-coloured share after a1's white balance (`src/canalRecall/blockFace/stripWhiteBalance.ts`, copied unchanged; it removes the green-cast false positives). `foliagePlain` is the unbalanced share | <= 0.30 (as `auto-place.ts`) |
| `washedOut` | bright, colourless mid-wall share: sheeting, overexposure, fog | <= 0.50 |
| `occluderShare` | largest connected dark blob in the lower third. **A proxy** for a parked van or scaffold: dark shopfront glass trips it, pale vans and bare trunks do not | <= 0.35 |
| `obliquity` | angle between wall normal and wall-to-camera ray | <= 35 usable; 35-55 is a fallback: made and archived, not usable |
| `cameraDistance` | camera to wall centre, metres | 5-35 |
| `rayBlocked` | the camera ray to the wall centre crosses another BAG footprint | must be false |
| `wallWidthM` | BAG wall length | >= 3.5 m (slivers) |
| `heightCover` | valid rows counted up from the ground, share of crop height | >= 0.85 (never fired on AB07) |
| `edgeDensity` | share of mid-crop pixels with a luma gradient > 20 (blank wall) | >= 0.04 |
| `seamStep` | largest mean-luma step between adjacent bands | recorded, **not a gate** (no separation on the labels) |
| `missing` | share of invalid pixels over the whole crop | informational |

Known blind spots: the flags do not see bare winter trees in front of a front (the largest group of "marginal" crops), a white van,
or a window close-up of a tall wall. **`usable` is a flag verdict, not a quality verdict**; the label evaluation below measures how far apart they are.

### Hand labels and evaluation

`scripts/house-crops/label-sheet.ts` draws blind numbered sheets (no flags), a judge calls each crop good / marginal / bad into
`scripts/house-crops/labels/<code>.json` (with the panorama ids, so a label counts only while the crop is unchanged), and
`scripts/house-crops/evaluate.ts --buurt <code> [--sweep]` prints, per flag, precision and recall as a defect detector and the precision/recall of `usable` for `good`. good = a full, straight front, ground floor to roof, no heavy occlusion; marginal = mostly good but flawed (tree, truck, cut top); bad = wrong wall, close-up, blank, oblique, smeared. Marginal counts as not good.

AB07 labels (150 crops: the 48 on the first sheet plus 102 random; labelled blind by a Claude judging session, not a human, so the user should spot-check `artifacts/house-crops/label/AB07-*.png`):
good 64, marginal 43, bad 43; true good rate 42.7 % (95 % CI 35-51). `usable` flagged 106 (70.7 % of the labelled set), **precision for good 50.9 %, recall 84.4 %**. Per flag as a defect detector: blocked 20 fired / 95 % real defects, blank 5 / 100 %, narrow 6 / 83 %, oblique 25 / 68 % (but it threw 8 good fronts away: narrow Jordaan streets only have oblique panoramas), seam 17 / 47 % (worse than the base rate, so removed as a gate), foliage / washed-out / occluder / void / distance / short fired on none of the labelled set after the changes.
Raising the obliquity cap from 35 to 55 lifts recall from 0.84 to 0.97 at the same precision (0.49 vs 0.51); the cap is kept at 35 as briefed, the number is here for the integrator to decide.
**Gate not met**: precision for good 0.51 (< 0.9) and a human-good share of about 43 % (< 70 %). The remaining gap is bare trees (the largest marginal group), alley/side walls that are not blocked by a footprint, and window close-ups; none has a cheap flag.

### Multi-year (best of N) against one year

Same 150 pands, same rules: flag-usable one year 80 / 150 vs best of N 106 / 150; buurt-wide 45.8 % vs 63.9 % of pands with a wall. **True good rate one year 43.3 % vs best of N 42.7 %** (42 of the 150 crops differ; I labelled both): best of N satisfies the flags more often but does not produce better-looking fronts, because what fails is trees and wrong walls, not the capture year. Cost: 89 min, 1,719 requests, 3.8 GB for N <= 6 (2.9 crops tried per pand on average) against 29 min, 955 requests, 1.7 GB for one year plus a second try. The shared panorama cache holds the downloads (49 GB total at the end of the pilot; the disk was at 4.6 GB free).

Pilot (Bloemgrachtbuurt AB07, 662 pands, final run 2026-11-10): 659 walls, 652 crops, 421 flag-usable (63.9 % of pands with a wall); rejected (primary) oblique 135, blocked 71, narrow 12, occluder 9, blank 3, foliage 1; 7 no panorama, 3 no exposed wall; 0 x 429. The strip route: 64/88 flag-usable.

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
