# Vision models in the façade pipeline

## Why

The original detector had no concept of a window. `measureFacade` scored any
region deviating from its local wall — in *either* direction, because glass
reads dark when it shows a room and bright when it reflects sky — and grouped
the results into a bay-and-storey grid. That is a reasonable first pass and it
produced medians that agree with independent sources to a centimetre. It also
boxed bare trees, blank sky, and the gaps in a bridge railing, and it could not
do otherwise: nothing in it knew what a window was.

## What is used

**`cmp-zosci/amsterdam-facade` v2** — semantic segmentation, 909 Amsterdam
façades, 7,245 labelled windows, 1,048 doors, plus `building` and `sky`.

The `sky` and `building` classes matter as much as the windows. They give the
pipeline the quality gate it never had. A rectified strip is supposed to be one
building's frontage seen square-on; if the model says the frame is 47% sky and
13% building, the rectifier was pointed at nothing and no careful measurement
of it is worth anything. Measured on two strips during the yaw repair:

| strip | building | sky | windows | verdict |
|---|---|---|---|---|
| `…164989` | 65.9% | 4.1% | 6 | usable |
| `…174874` | 13.3% | 47.4% | 0 | rejected — a street receding to a vanishing point |

That rejection is automatic, and it is the thing that would have caught the
180° yaw error on day one.

## How

```bash
set -a; . ./.env.local; set +a     # ROBOFLOW_API_KEY, gitignored
.venv-vision/bin/python scripts/facade-twin/vision/detect_openings.py \
  --strips .cache/facade-twin/strips-clean \
  --meta   public/data/extracts/.../facade-evidence.json \
  --out    public/data/extracts/.../segmented-openings.json
```

The venv is `.venv-vision` (Python 3.11 — torch has no 3.14 wheels), created
with `uv venv --python 3.11 .venv-vision`. Both it and `.env.local` are
gitignored.

## Known limits, and what is next

- **It is a hosted API.** Fine for offline extraction, wrong as a permanent
  dependency: the brief rules out runtime third-party APIs, and 1,800 calls per
  full run is slow and rate-limited. The durable path is to pull the dataset
  and train a YOLO segmentation model locally with ultralytics, which is
  already installed and has MPS available.
- **It replaces detection, not measurement.** Instances come back as pixel
  components and are converted to metres by the strip's own pixels-per-metre.
  Storey and bay inference still comes from `measure.ts`, and should be re-run
  over these openings rather than the old ones.
- **It has not been checked against a human.** The same standing caveat as
  everything else here. A model trained on Amsterdam façades agreeing with a
  strip that looks like an Amsterdam façade is not validation.


## The ensemble

`ensemble.py` replaces `detect_openings.py` for production. Two detectors and a
grid, because each fails differently:

- **`amsterdam-facade` v2** is trained on Amsterdam and excellent on the brick
  canal house it has seen a thousand of. On a pale classical frontage it goes
  uncertain and paints half the wall `background` — one strip returned two
  windows where eight are plainly visible.
- **YOLO-World** (`yolov8s-worldv2.pt`, prompt `window`, `imgsz=960`) is
  open-vocabulary and knows nothing about Amsterdam, so it has no such blind
  spot. It is also looser and will box a windscreen. At the default 640 it finds
  almost nothing on a tall narrow strip; the image size is load-bearing.

**The grid is proposed by geometry, not derived from detections.** That was the
bug worth recording: bay runs were taken where the column profile exceeded a
quarter of its own maximum, so a strongly-detected left half pushed a weaker
right half below the bar. Half of a five-bay Herengracht frontage produced no
cells at all, and every window in it was missed along with two plainly visible
front doors — not because the models failed, but because nothing ever looked
there. The grid is now laid across the whole observed wall at the measured
2.6 m bay pitch and 3.0 m storey height, and every cell is asked.

**Doors get their own pass.** They cannot come out of a window grid: storey rows
are found from the window vote profile, and a front door is by definition not
window-like. The ground storey is therefore asserted from geometry — the
pavement is where the pavement is — and a bay in it that is wall rather than
glazing is the way in. Doors went from 31 to 560 across 1,821 strips on this
change alone.

**Occlusion is reported, not guessed through.** Where more than 40% of the
ground storey is behind parked cars and bicycles, no door is emitted and the
façade is marked `groundStoreyOccluded`. 1,129 of 1,821 strips are in that
state. A door not found under a van is unobserved, not absent, and the earlier
version put a doorway on a car.

Every opening carries `sources` — which of `segmentation`, `yolo-world`,
`grid`, `grid-ground-storey` produced it — and `inferred: true` where the grid
proposed it and neither model saw it.

| | |
|---|---|
| Strips | 1,821 |
| Windows | 5,507 |
| Doors | 560 (30% of strips) |
| Ground floor too occluded to say | 1,129 (62%) |
| Seen by both models | 211 |
| Proposed by the grid alone | 1,675 |

### Still wrong

- **Doors are placed, not seen.** Every one is `inferred`. The box lands in the
  right bay but its vertical placement is anchored to the strip base rather than
  the visible pavement, so it can sit low — on the quay wall in one checked case.
- **Doors are still labelled as windows** where they sit in a storey row that
  the window grid found.
- **1,675 of 7,282 openings were seen by no model.** They are marked, and they
  should not be treated as observations.


## Where the ground is, and why doors are hard

Two findings from the door work, both worth keeping.

**The height model and the photograph disagree about the ground.** Doors were
anchored to `3DBAG ground − strip base`. On one checked building that put the
doorway on the quay wall below the parked cars: reading the strip bottom-up it
is solid masonry (the quay), then a gap (cars on the pavement), then the façade
proper **3.6 m above** where the height model put the ground. The façade foot is
now found from the mask — the lowest unbroken run of wall — and the gap between
that and the geometric line is reported as `groundResidualM`.

Across 1,821 strips the median residual is **0.02 m**, which says the height
model is usually right. But **425 are over 1.5 m out**, and those get no door at
all: when the two sources disagree by more than a storey, placing a doorway on
either answer is a guess.

**Doors are mostly unobservable from this imagery, and that is the real limit.**
Of 1,821 façades, 977 have their ground storey more than 40% hidden behind
parked cars and bicycles. A survey car photographs a canal from 20–40 m across
the water, and the one part of the wall that is reliably occluded is the bottom
three metres — which is exactly where the front door is. This is not a
detection problem and a better model will not fix it.

The fix that would work is **multiple panoramas per building**. A car parked in
front of the door in January's pass is not there in March's, and the pipeline
already knows every panorama that sees each wall — it just picks one. That is
the highest-value remaining change for the ground floor.

| | after door work |
|---|---|
| Windows | 5,343 |
| Doors | 403 (22% of strips) |
| Ground storey too occluded | 977 (54%) |
| Ground residual over 1.5 m | 425 (23%) |
| Seen by both models | 201 |
| Grid-proposed only | 1,372 |
