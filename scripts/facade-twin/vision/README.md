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
