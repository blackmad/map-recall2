# Façade model — decisions log

A record of decisions actually taken, with the evidence behind each. Append-only.
Where a decision was later reversed, say so here rather than editing history.

Companion docs: [FACADE_MODEL_EVALUATION_PLAN.md](FACADE_MODEL_EVALUATION_PLAN.md)
(the evaluation design and its fixed rule),
[AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](AMSTERDAM_FACADE_GEOMETRY_DESIGN.md) (the
point-cloud pipeline).

---

## D1 — Openings come from the union of RF-DETR-seg-2XL and YOLO26x-seg; doors win over windows

**Decided 2026-09-22.** For a wall's openings, run **both** photo models and
**union** their boxes:

- **windows** from `building-facade-segmentation-instance/4` (RF-DETR-seg-2XL)
  **and** `facade-rsjek/5` (YOLO26x-seg);
- **doors** from `facade-rsjek/5`'s `entrance` class — it is the only photo model
  we have with a door class;
- **overlap rule:** where a window box overlaps a door box, the **door wins** —
  the window is dropped, not averaged. A window *inside* a door is a glazed
  panel of that door, not a separate opening.

Rationale, from the measured gold set (60 Oud-Zuid walls, 70 measured openings):

| model | precision | recall | median centre |
| --- | --- | --- | --- |
| RF-DETR-seg-2XL | 4.6 % | 15.7 % | 0.298 m |
| YOLO26x-seg | 8.3 % | 18.6 % | 0.188 m |

They fail differently: RF-DETR over-detects (241 boxes for 70 openings) but has
the better centre error on what it does hit; YOLO26x-seg is more conservative
(156 boxes) and is the only one that names doors. Neither is good enough alone,
so union for coverage and a class-priority rule for the doors/windows ambiguity.

**Consequence to keep honest:** the union inherits both models' precision
problems. It is a *proposal source*, not an accepted observation; the measured
gold set stays the arbiter, and the plan's adoption rule is still not met by
either model or by their union.

**Implementation:** `src/canalRecall/facade/openingMerge.ts` (+ test),
`scripts/facade-eval/build-union.ts`. Priority: doors first, then windows, with
cross-model de-duplication by IoU.

---

## D2 — The point-cloud models are 3-D, and they do not transfer to Amsterdam

**Recorded 2026-09-22.** UnderOneFacade / ZAHA / PTv1 / DGCNN take **point
clouds** `(x,y,z[,rgb])`, not images — they are not photo models. Both were run:

- **PTv1** (global `lofg3` weights) on a rented RunPod A4000, **$0.041** total,
  pod deleted and confirmed. It labelled ~100 % of façade points `terrain` and
  found **0 wall/window/door** on both tiles. Its own checkpoint records
  `val_miou 0.158` against `train_miou 0.66`.
- **DGCNN** (global `lofg3`) locally on CPU/MPS: 76 % `wall`, 23 % `roof`,
  **0.0 % window+door**, 0 of 60 walls.

**Decision: do not adopt either.** The harness is kept — it is one command to
re-run against a future Amsterdam-fine-tuned checkpoint.

---

## D3 — The measured gold set is a lower bound, and it is not a façade test set

**Recorded 2026-09-22.** The point-cloud measurement records an opening only
where it can measure a reveal, so a model is penalised for finding a real window
the scan missed. Measured on the pinned wall: 13 measured against roughly 20
visible. Two further limits:

- **52 of 60 walls are under 3 m wide** — thin 3DBAG wall slices, not frontages —
  and **40 of 60 have no openings at all**. Only **5** walls are ≥ 4 m with a
  window-sized opening.
- All 60 walls are still `spotCheck: "pending"`; nobody has audited the gold set.

**Decision:** treat the measured set as a floor on precision and a valid
denominator for recall, and treat the hand-labelled half of the gold set as the
only route to a real answer. Do not lower the plan's thresholds.

---

## D4 — Alignment is not the explanation for the low recall

**Recorded 2026-09-22.** Allowing every model a global **±1 m translate and a
mirror** lifts the best pooled recall only to **25.7 %** (from 18.6 %). If the
crops and the measured geometry were badly registered, this probe would have
recovered most of the recall. It does not.

**Decision:** stop treating registration as the suspected cause; the models
genuinely miss most scan-found openings. The probe stays available as
`--probe` on the scorer.

---

## D5 — `cmp-zosci/amsterdam-facade` is the Amsterdam-specific model to try

**Recorded 2026-09-22, not yet run.** A Roboflow project by `CMP` with **909
images** and classes `background, building, door, sky, window` — semantic
segmentation, so its output is a **mask** and follows curved outlines, unlike the
box models. This is the City of Amsterdam façade dataset lineage (the
~980-mask set annotated by the municipality, North and West), and it is the only
Amsterdam-specific model we have found.

Related segmentation (not box) options if it underperforms: `visionk/
building-facade-complexity` (5,073 images; `door, window, wall, railing, plant`),
and chrise96's Mask R-CNN trained on the Amsterdam masks (GPL-3.0, needs local
setup).

**Blocker at time of writing:** `inference.get_model("cmp-zosci/amsterdam-facade/2")`
raises `InvalidModelIDError`; the local `inference` 1.6.2 package may need the
project/version form, or semantic segmentation may need the hosted route.

---

## D6 — Sky and roof are not model questions here

**Recorded 2026-09-22.** No photo model we have carries a roof or sky class,
because a street-level crop rarely contains either. The pipeline already computes
`skyRowFraction` per crop in `review-data/crop-preflight.json`, and the roofline
is measured from the point cloud. **Decision:** do not chase a sky model; use the
existing classical sky fraction, and keep roofs on the geometry side.
