# SAM 3 for storey counts and half-souterrains: spike, 2026-11-21

**Verdict:**
- **Storeys:** SAM 3 is the first method that reaches the majority baseline. It does not clearly beat it, and it is no better than 3DBAG `storeys - 1`. Its value is as an independent second opinion: where SAM 3 and 3DBAG−1 agree (82 % of fronts), they are right 95 % of the time.
- **Bays:** SAM 3 is worse than the free width rule.
- **Souterrain:** a fixed "low window at the pavement line" rule gives **precision 0.92, recall 0.57**. It finds the Oud-Zuid souterrains, and misses most canal and Jordaan ones on our older, blurrier strips.

**Recommendation:**
- Use it as a **gate or flag**, not a measurer.
- Do not wire it into the storey fit yet.
- A souterrain fact from SAM 3 is usable as a high-precision positive. A "no" from it means nothing.

No `src/` code was written. The scripts are in `scripts/vision/sam3/`.

## Setup and licence

- **Install:** venv at `~/Code/sam3-20261121/.venv`: Python 3.12, torch 2.15.0 (MPS), transformers 5.24.0 (`Sam3Model`, `Sam3Processor`).
- **Weights:** `facebook/sam3` `model.safetensors`, 3.44 GB, sha256 `6d06f0a5…cc14a` (matches the HF etag). They sit in `~/Code/sam3-20261121/weights`, together with the config and tokenizer files. `sam3.pt` (another 3.45 GB) was not fetched.
  - The xet download stalled at about 30 kB/s, so I fetched the weights with 8 parallel HTTP range requests (`weights/dl.sh`).
- **Disk:** 4.1 GB in total (weights 3.2 GiB, venv 0.9 GB, work dir 24 MB). The HF xet cache did not grow; its 1.5 GB was already there. Free space stayed at 28 GB or more throughout.
- **Gating:** `facebook/sam3` is gated (manual approval). The existing token already had access: `config.json` resolved with HTTP 206. No action is needed from David.
- **Licence:** the "SAM License" (Meta, last updated 2025-11-19), https://huggingface.co/facebook/sam3/blob/main/LICENSE. It is not an OSI licence. The key terms for a public game:
  - It is a non-exclusive, worldwide, royalty-free licence to use, reproduce, distribute and modify the materials, and to make derivatives.
  - If we redistribute the SAM materials or derivatives (e.g. the weights), we must ship a copy of the licence.
  - Publications of research results must acknowledge SAM.
  - Trade-control compliance is required, and military/ITAR uses are banned.
  - We may not reverse engineer the model.
  - Any licence terminates if we sue Meta for IP infringement over SAM.
  - Meta claims no ownership of outputs or derivatives we make.
  - **Using SAM 3 offline to derive facts (storeys, souterrain flags) that ship in the game data is fine. We would ship no SAM materials.** If we ever shipped the model itself (e.g. in-browser), we would have to include the licence.

## Storeys and bays (53 gold fronts)

**Gold set.**
- The 11-10 spike's `truth.json` (which maps gold index to crop) was lost with its worktree.
- I rebuilt the crop list from the lane branch's `scripts/block-face` tree plus block-face strips recovered from `map-recall2-source-data` history. I picked each face's strip whose pixel size matches its `strip.json`: 111 of 136 faces. This gives 333 crops.
- A DP alignment then chose the face subset whose crop sequence fits the gold labels: type bays agree on 53/53 gold indices.
- I checked every gold crop by eye. 45 agree with the old label. 6 were relabelled and 2 dropped (a mixed stitch and an occluded side wall).
- The result is `scripts/vision/sam3/gold-crops.json`, with columns `storeys` (the original labels) and `storeysV2` (my check). It also carries `storeys3dbag` (`facts.heights.storeys`, from 3DBAG) and the placed type's storeys.
- The rule is unchanged: ground storey included, dormers and gable tops excluded, souterrain counted.
- Because the crop set is a reconstruction, **OWLv2 was re-run on the same reconstructed crops** (`owl-probe.py`, same protocol; `owl-rescore.py`).

**Method** (`sam3-probe.py`, `sam3-eval.py`):
- Each crop is padded to a square and passed through the vision encoder once. Then 9 text prompts run: window, dormer, balcony, door, shop window, stairs, railing, sidewalk, roof.
- **Window filtering:** window masks are kept if they are 0.35–3.0 m wide and 0.45–3.6 m tall. A mask is dropped if its centre falls inside a dormer box (dormer windows) or a door box (door glazing).
- **Rows:** masks are grouped into rows by ≥ 50 % vertical overlap. Rows with fewer than half the windows of the fullest row are dropped.
- **Count:** storeys = rows whose bottom sits more than 3.2 m above the crop bottom, plus 1 for the ground floor. Bays = the most common window count per upper row.
- The a-priori parameters were fixed before scoring. Split-half tuning (a 48-point grid, dev = even keys, test = odd keys) was run in addition, exactly as for OWLv2.

| Storeys, exact | Original labels (53) | Checked labels V2 (51) |
|---|---|---|
| **SAM 3, a-priori rule, all fronts** | **71.7 %** | **84.3 %** |
| SAM 3, a-priori rule, test half | 76.9 % | 88.5 % |
| SAM 3, tuned on dev → test / tuned on test → dev | 84.6 % / 66.7 % (mean 75.6 %) | 88.5 % / 80.0 % (mean 84.2 %) |
| SAM 3 within ±1 | 96.2 % | **100 %** |
| OWLv2, reported 11-10 (held out) | 77 % | — |
| OWLv2 re-run on these crops (held out, mean of both directions) | 69.8 % | 74.6 % |
| Majority class ("4"), all / test half | 84.9 % / 80.8 % | 82.4 % / 84.6 % |
| 3DBAG `storeys` as is | 7.5 % | 2.0 % |
| **3DBAG `storeys − 1`** | 79.2 % | **88.2 %** |
| Placed type `body.storeys` | 67.9 % | 70.6 % |
| SAM 3 = 3DBAG−1 (42 of 51 fronts, 82 %) | — | **95.2 % correct on those** |

- On the 9 fronts where SAM 3 and 3DBAG−1 disagree, SAM 3 is right on 3 and 3DBAG−1 on 5.
- The 3DBAG figure is systematically one high on this sample. It counts the roof or attic as a storey, so the honest 3DBAG baseline is `storeys − 1`.
- Confusion against V2 labels (gold → predicted): 4→4 ×37, 3→3 ×6, 4→5 ×4, then 5→4, 3→4, 3→2 and 4→3 once each. **SAM 3 never misses by more than one storey.** OWLv2 and the classic CV path produced 0- and 1-storey answers.

**Bays (53):**
- SAM 3: 81.1 % overall, 88.5 % on the test half.
- Width rule (≤ 4.6 m → 2, else 3): **96.2 %**. OWLv2 held out: 85 % (11-10) and 77 % (re-run).
- Failures: balcony doors swallowed by the door mask (3→2 ×5), and two wide or misaligned crops (3→7, 3→11).
- SAM 3 adds nothing over the width rule for bays on these terraced fronts.

**Failure modes** (sheet `sheet-storeys-failures.jpg`):
- A roof-tower window becomes a row (#6). This needs "tower"/roof exclusion, not just dormers.
- Small frieze or attic windows beside a dormer form a row (#126).
- Souterrain row missed (#26). The ground floor is assumed, never measured.
- Ghosted panorama stitch (#64).
- Neck/bell-gable windows counted as a storey (#28, #30). This is also a labelling-convention question.
- Wide multi-house crop (#96).

**What SAM 3 does well:** it fixes the row-confusion that killed OWLv2 and the classic path. Cornices, brackets and balconies no longer fire as rows, and dormers come out as their own masks (cyan in the sheets).

## Half-souterrain (41 gold fronts, 21 positive)

**Gold set** (`scripts/vision/sam3/souterrain-gold.json`):
- Per-pand crops cut from block-face strips (40 px/m; the strip bottom is the ground line). I labelled them by eye from bottom-5 m sheets at 1.3× zoom.
- I took 41 of 157 candidate crops: clear yes or clear no only. I skipped hedges, vans and unclear stoops.
- **Oud-Zuid** (Willemsparkweg 2025-01, Valeriusstraat, Lairessestraat, P.C. Hooftstraat 2024-11/12, Van Baerlestraat 2024-12) and **Jordaan** Bloemgracht 80-128 (2024-12-16) are 2024–25 captures.
- **Canal belt and the rest of the Jordaan** (Prinsengracht 312-328, Lauriergracht 62-110, Egelantiersgracht 47-101) only exist as 2021/2023 strips. These are older and blurrier, and I used them anyway.
- There are no rectified Herengracht or Keizersgracht strips in the archive.

**Rule A (a-priori):** souterrain = at least one "window" mask (score ≥ 0.4, not inside a door or shop-window box, ≥ 0.3 m wide) whose bottom is within 0.5 m of the ground line and whose top is under 1.6 m. "Stairs" and "railing" masks touching the ground zone count as stoop evidence.

| Rule | TP | FP | FN | Precision | Recall |
|---|---|---|---|---|---|
| **A: low window (a-priori)** | 12 | 1 | 9 | **0.92** | **0.57** |
| A, top ≤ 2.0 m, bottom ≤ 0.8 m (post hoc) | 14 | 1 | 7 | 0.93 | 0.67 |
| A, score ≥ 0.5 | 10 | 0 | 11 | 1.00 | 0.48 |
| B: low window AND stoop | 8 | 1 | 13 | 0.89 | 0.38 |
| C: low window OR stoop | 17 | 9 | 4 | 0.65 | 0.81 |
| Stoop (stairs/railing) alone | 13 | 9 | 8 | 0.59 | 0.62 |

- **By district:** Oud-Zuid recall is 10/12. Canal and Jordaan recall is 2/9.
- **Why the canal and Jordaan misses happen:**
  - Canal-house souterrain windows reach about 2 m, above the 1.6 m cap.
  - Parked bikes and cars cover the pavement band.
  - The 2021/2023 strips are blurrier.
  - On several stoop houses SAM labels the souterrain opening as "stairs" instead of "window".
- **The one false positive** is a low painted panel on Egelantiersgracht.
- **Stoop evidence alone is weak:** Oud-Zuid's raised-ground-floor houses without a souterrain have steps too.
- See sheet `sheet-souterrain.jpg`: red = low windows that fired, yellow = stairs/railing.

## Time, memory, cost

- **Time per front:** M4 Pro, MPS, fp32, all 9 prompts on one vision pass.
  - **5.6 s mean** (5.3 s median) on the 53 gold fronts, and 6.1 s on the souterrain set, with machine load around 50–90.
  - Under load around 200 (many lanes), it was about 40 s per front.
  - The model loads in 5 s warm and 49 s cold.
- **Memory:** MPS driver 5.6 GB (9.5 GB peak on the widest crop), tensors 3.7 GB, process RSS 1.3–4.9 GB.
- **City-wide cost, rough:**
  - About 100k street-facing fronts × 5.6 s ≈ 155 h, roughly 6.5 days of one quiet Mac.
  - With 4 prompts (window, dormer, door, stairs) and fp16, I estimate 2–3 s per front, so 2.5–3.5 days. This is not measured.
  - The canal belt plus inner ring, at about 15k fronts, is about one night.
  - Crops must exist first. They come from block-face strips or `house:crops`, which is panorama-bound and the real bottleneck.

## Recommendation

1. **Storey fit:**
   - Do not replace anything.
   - Add SAM 3's row count as a **cross-check flag** next to 3DBAG `storeys − 1`. Where they agree, treat the count as confirmed (95 % here). Where they disagree, hold the front for the reviewer or the row-coherence rule.
   - Use the per-row window masks (y-extent in metres) as *measured storey heights*. These are useful evidence for the WG/GG-Zuid `storeyHeights` work even when the count is not new.
   - Before any wiring, run a balanced 3/5/6-storey set. This sample is 80 % "4", so it cannot show a real lift.
2. **Kit facts:**
   - The `souterrain` fact can come from Rule A as a **positive-only** signal. The precision is good enough for kit facts in Oud-Zuid, where recall is about 0.8.
   - For the canal belt, it needs 2024–25 crops of Herengracht and Keizersgracht, and a canal-specific window cap of about 2.2 m. It should be re-measured before use.
   - The dormer and stoop masks could also feed `dormerAt` and stoop facts, but this was not measured here.
3. **Bays:** keep `baysByWidth`.
4. **If we continue:** run it as a batch lane on quiet machine time, one buurt at a time. Store the per-front npz (about 12 kB each) beside the crops in source-data, and keep the rules in a typed reader. Do not run the model at game runtime.

## Reproduce

```
# venv (outside the repo): python 3.12, torch, transformers>=5, pillow, numpy
cd ~/Code/sam3-20261121
.venv/bin/python -I <repo>/scripts/vision/sam3/sam3-probe.py --weights weights --crops work/gold --index <repo>/scripts/vision/sam3/gold-crops.json --out work/probe-gold
.venv/bin/python -I <repo>/scripts/vision/sam3/sam3-probe.py --weights weights --crops work/sout --index <repo>/scripts/vision/sam3/souterrain-gold.json --out work/probe-sout
.venv/bin/python -I <repo>/scripts/vision/sam3/sam3-eval.py storeys work/probe-gold
.venv/bin/python -I <repo>/scripts/vision/sam3/sam3-eval.py souterrain work/probe-sout
.venv/bin/python -I <repo>/scripts/vision/sam3/sam3-sheet.py storeys work/probe-gold work/gold OUT.jpg [keys]
python3 <repo>/scripts/vision/sam3/owl-rescore.py OWL_JSON
```

- Crops: `python3 -I scripts/vision/sam3/build-crops.py ~/Code/sam3-20261121/work` rebuilds `gold/` and `sout/` from git history alone (`strip.json` from this repo, `strip.jpg` from any ref of `map-recall2-source-data`). They are also kept in `~/Code/sam3-20261121/work/{gold,sout}`.
- Results are in `scripts/vision/sam3/results-*.json`.
- Sheets are in `map-recall2-screenshots/research/sam3-storeys-20261121/` (commit 125f1e5, not pushed). They are `sheet-storeys-failures.jpg`, `sheet-storeys-ok.jpg` and `sheet-souterrain.jpg`.
- `scripts/vision/*.py` from lane/vision-measure-20261110 are included, because main never had them.
