"""
Two detectors and a grid: openings that neither model finds alone.

Each model fails differently, which is the whole reason to run both.

  - `amsterdam-facade` v2 segmentation is trained on Amsterdam and is excellent
    on the brick canal house it has seen a thousand of. On a pale classical
    frontage it goes uncertain and paints half the wall `background`: one strip
    returned two windows where eight are plainly visible.
  - YOLO-World is open-vocabulary and knows nothing about Amsterdam, so it has
    no such blind spot — it found four to seven on that same strip. It is also
    looser, and will happily box a parked car's windscreen.

Neither is trustworthy alone. Together, with the constraint that façades are
grids, they are much better than either: the union supplies candidates, the grid
supplies the discipline, and a cell that both models hit is worth more than a
cell either found by itself.

The grid also does the thing neither model can. If four windows establish two
bays and the storey bands say five storeys, then the cells with no detection in
them are *probably* windows the models missed — most façades are regular, and a
blank in an otherwise full grid is more likely a miss than a blank wall. Those
are emitted, but marked `inferred`, and they never carry the same weight as a
cell something actually saw.

Doors get the same treatment from the other end. A door is the ground-storey
cell that is an opening but is not glazing, standing on the pavement in a bay.
That is a geometric statement, and it is how the front door is found when the
segmentation model's `door` class — which fired 31 times across 1,821 strips —
does not.
"""
from __future__ import annotations
import argparse, base64, io, json, os, sys, warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np
from PIL import Image, ImageDraw

FACADE_MODEL = "amsterdam-facade/2"
WORLD_WEIGHTS = "yolov8s-worldv2.pt"
# Windows only from YOLO-World: its `door` prompt returns nothing on these
# strips, tested on ground-floor crops upscaled to 960 px as well as whole
# strips. Doors come from the grid instead.
WORLD_PROMPTS = ["window"]
WORLD_IMGSZ = 960          # 640 finds almost nothing on a tall narrow strip
WORLD_CONF = 0.03

MIN_W_M, MIN_H_M = 0.4, 0.5
DOOR_MAX_SILL_M = 0.8      # a door stands on the pavement
DOOR_MIN_H_M = 1.8
# One storey at the median of the measured grammar, used only to place the
# ground-floor band that the window profile cannot produce.
GROUND_STOREY_M = 3.0
# Above this, the ground storey is too hidden to say anything about.
MAX_GROUND_OCCLUSION = 0.4
# How far the photograph and the height model may disagree about the ground
# before neither is trusted to place a doorway.
MAX_GROUND_RESIDUAL_M = 1.5
# Bay pitch measured across 1,375 façades earlier in this project, and the
# widest a single opening gets before it is a shopfront.
BAY_PITCH_M = 2.6
MAX_OPENING_W_M = 2.2


def iou(a, b) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix = max(0, min(ax1, bx1) - max(ax0, bx0))
    iy = max(0, min(ay1, by1) - max(ay0, by0))
    inter = ix * iy
    if inter <= 0:
        return 0.0
    return inter / ((ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter)


def runs(profile: np.ndarray, min_run: int, floor: float):
    if profile.size == 0:
        return []
    threshold = max(floor, profile.max() * 0.25)
    on = profile > threshold
    out, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_run:
                out.append((start, i))
            start = None
    if start is not None and len(on) - start >= min_run:
        out.append((start, len(on)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strips", required=True)
    ap.add_argument("--meta", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--overlays", default="")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--ids", default="")
    ap.add_argument("--base", type=float, default=1.8)
    args = ap.parse_args()

    if not os.environ.get("ROBOFLOW_API_KEY"):
        print("ROBOFLOW_API_KEY not set (needed once, for the weights)", file=sys.stderr)
        return 2

    from inference import get_model
    from ultralytics import YOLOWorld
    seg_model = get_model(model_id=FACADE_MODEL)
    world = YOLOWorld(WORLD_WEIGHTS)
    world.set_classes(WORLD_PROMPTS)

    meta = json.loads(Path(args.meta).read_text())
    by_id = {f["pandId"]: f for f in meta["facades"]}
    strips = Path(args.strips)
    overlays = Path(args.overlays) if args.overlays else None
    if overlays:
        overlays.mkdir(parents=True, exist_ok=True)

    wanted = [i for i in args.ids.split(",") if i]
    ids = wanted or sorted(p.stem for p in strips.glob("*.jpg"))
    if args.limit:
        ids = ids[:: max(1, len(ids) // args.limit)][: args.limit]

    out, done = {}, 0
    for pid in ids:
        path = strips / f"{pid}.jpg"
        if not path.exists() or pid not in by_id:
            continue
        try:
            r = seg_model.infer(str(path))
            r = r[0] if isinstance(r, list) else r
            preds = r.model_dump()["predictions"]
        except Exception:
            continue
        cmap = {int(k): v for k, v in preds["class_map"].items()}
        mask = np.array(Image.open(io.BytesIO(base64.b64decode(preds["segmentation_mask"]))))
        if mask.ndim == 3:
            mask = mask[:, :, 0]
        h, w = mask.shape
        ids_by_name = {v: k for k, v in cmap.items()}
        share = {n: round(100 * float((mask == c).sum()) / mask.size, 1) for c, n in cmap.items()}
        ppm = w / max(by_id[pid]["wallWidthM"], 0.1)

        window_mask = mask == ids_by_name.get("window", -1)
        wall_mask = np.isin(mask, [ids_by_name.get("building", -1), ids_by_name.get("window", -1),
                                   ids_by_name.get("door", -1)])

        # YOLO-World's boxes, scaled into mask pixels.
        world_boxes = []
        try:
            wr = world.predict(str(path), conf=WORLD_CONF, imgsz=WORLD_IMGSZ, verbose=False)[0]
            if wr.boxes is not None and len(wr.boxes):
                iw, ih = Image.open(path).size
                sx, sy = w / iw, h / ih
                for b in wr.boxes.xyxy.cpu().numpy():
                    world_boxes.append((b[0] * sx, b[1] * sy, b[2] * sx, b[3] * sy))
        except Exception:
            pass

        # A vote image: segmentation glazing, plus YOLO-World's boxes.
        votes = window_mask.astype(np.float32)
        for x0, y0, x1, y1 in world_boxes:
            votes[int(max(0, y0)):int(min(h, y1)), int(max(0, x0)):int(min(w, x1))] += 0.6

        # The grid is proposed by geometry and tested by the models — not
        # derived from the detections.
        #
        # Deriving it from detections was the mistake. Bay runs were taken where
        # the column profile exceeded a quarter of its own maximum, so a
        # strongly-detected left half suppressed a weaker right half below the
        # bar and the right half of a five-bay Herengracht frontage produced no
        # cells at all. Every window in it was missed, and so were two plainly
        # visible front doors, because there was nowhere for them to be found.
        #
        # A façade is a regular grid whether or not a model saw all of it, so
        # the grid is laid across the whole observed wall at the measured bay
        # pitch and the measured storey height, and each cell is then asked
        # whether anything is there. Regions the models are weak on still get
        # examined; they simply come back empty rather than unexamined.
        columns = wall_mask.sum(axis=0).astype(np.float32)
        wall_cols = np.nonzero(columns > h * 0.15)[0]
        if wall_cols.size < 4:
            wall_cols = np.arange(w)
        left, right = int(wall_cols.min()), int(wall_cols.max()) + 1
        span_m = (right - left) / ppm

        bays = []
        n_bays = max(1, min(8, round(span_m / BAY_PITCH_M)))
        step = (right - left) / n_bays
        for i in range(n_bays):
            cx = left + step * (i + 0.5)
            half = min(step * 0.42, MAX_OPENING_W_M * ppm / 2)
            bays.append((int(max(left, cx - half)), int(min(right, cx + half))))

        # Storeys: use the rows the votes actually show, and fall back to a
        # regular ladder from the ground where they are too few to be a ladder.
        storeys = runs(votes.sum(axis=1), max(3, int(MIN_H_M * ppm * 0.7)), w * 0.02)
        ground_line = h - args.base * ppm
        if len(storeys) < 2:
            storeys = []
            z = ground_line
            while z - GROUND_STOREY_M * ppm > 0 and len(storeys) < 7:
                top = z - GROUND_STOREY_M * ppm
                storeys.append((int(max(0, top + 0.18 * GROUND_STOREY_M * ppm)),
                                int(z - 0.12 * GROUND_STOREY_M * ppm)))
                z = top

        windows, doors, found = [], [], []

        def tighten(y0, y1, x0, x1):
            """
            Shrink a grid cell to the opening inside it.

            A cell is a bay wide and a storey tall — 2.2 m by 3 m — and emitting
            it whole says every window in Amsterdam is 2.2 m across, which is
            twice what the grammar measured. The cell says *where to look*; the
            pixels inside it say how big the opening is. Preference order is
            evidence order: the segmentation mask if it painted glazing here,
            else whatever YOLO-World boxed here, else nothing and the caller
            falls back to this façade's own typical opening.
            """
            cell = window_mask[y0:y1, x0:x1]
            if cell.any():
                ys, xs = np.nonzero(cell)
                return (x0 + int(xs.min()), y0 + int(ys.min()),
                        x0 + int(xs.max()) + 1, y0 + int(ys.max()) + 1)
            best, best_iou = None, 0.0
            for b in world_boxes:
                v = iou((x0, y0, x1, y1), b)
                if v > best_iou:
                    best, best_iou = b, v
            if best and best_iou > 0.12:
                return (int(max(x0, best[0])), int(max(y0, best[1])),
                        int(min(x1, best[2])), int(min(y1, best[3])))
            return None

        cells = []
        for x0, x1 in bays:
            for y0, y1 in storeys:
                cell_glass = window_mask[y0:y1, x0:x1]
                cell_wall = wall_mask[y0:y1, x0:x1]
                if cell_glass.size == 0:
                    continue
                glazed = float(cell_glass.mean())
                seen_by_world = any(iou((x0, y0, x1, y1), b) > 0.15 for b in world_boxes)
                sources = ["segmentation"] * (glazed >= 0.12) + ["yolo-world"] * seen_by_world
                cells.append({"cell": (x0, y0, x1, y1), "glazed": glazed,
                              "sources": sources, "wall": float(cell_wall.mean()),
                              "box": tighten(y0, y1, x0, x1)})

        # This façade's own typical opening, from the cells something actually
        # saw. Used to size the ones only the grid proposes, because a terrace
        # repeats its own window far more reliably than it matches a citywide
        # average.
        observed = [c["box"] for c in cells if c["sources"] and c["box"]]
        if observed:
            typical_w = float(np.median([b[2] - b[0] for b in observed]))
            typical_h = float(np.median([b[3] - b[1] for b in observed]))
        else:
            typical_w, typical_h = 1.15 * ppm, 1.9 * ppm

        for c in cells:
            x0, y0, x1, y1 = c["cell"]
            box = c["box"]
            inferred = False
            if not c["sources"]:
                # Nothing saw it. The grid says a window belongs here, which is
                # a claim about regularity rather than an observation, so it is
                # kept only where the cell is solidly this building's wall — and
                # it is sized like this façade's other windows and says plainly
                # that it was inferred.
                if c["wall"] < 0.75:
                    continue
                inferred = True
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                box = (cx - typical_w / 2, cy - typical_h / 2,
                       cx + typical_w / 2, cy + typical_h / 2)
            if box is None:
                continue
            bx0, by0, bx1, by1 = box
            w_m, h_m = (bx1 - bx0) / ppm, (by1 - by0) / ppm
            if w_m < MIN_W_M or h_m < MIN_H_M or w_m > MAX_OPENING_W_M:
                continue
            # Nothing can sit below the bottom edge of the strip it was found
            # in: the picture stops there, so a reading below it is the box
            # running off the image rather than an opening under the pavement.
            if (h - by1) / ppm - args.base < -args.base - 0.05:
                continue
            found.append({
                "xM": round(bx0 / ppm, 2),
                "yM": round((h - by1) / ppm - args.base, 2),
                "widthM": round(w_m, 2), "heightM": round(h_m, 2),
                "glazed": round(c["glazed"], 2),
                "sources": c["sources"] or ["grid"],
                "_sillPx": by1,
                **({"inferred": True} if inferred else {}),
            })

        # Where the façade actually starts, as opposed to where we think it does.
        #
        # The ground storey was anchored to `ground - STRIP_BASE`, taken from
        # 3DBAG. On one checked building that put the doorway on the quay wall,
        # below the parked cars, because the strip reads bottom-up as: solid
        # masonry (the quay), a gap (cars on the pavement), then the façade
        # proper 3.6 m above where the model said the ground was.
        #
        # The picture knows better than the height model here. Scanning down the
        # wall column, the façade is the lowest run of rows that is
        # substantially building and does not break; below its foot is street,
        # vehicles or quay. That foot is the pavement.
        #
        # The gap between the two is a vertical registration residual, and it is
        # reported per building rather than silently absorbed — it is the same
        # class of error as the yaw bug and deserves to be visible.
        wall_rows = wall_mask.mean(axis=1)
        solid = wall_rows > 0.55
        facade_foot_px = None
        run_end = None
        for y in range(h - 1, -1, -1):
            if solid[y]:
                if run_end is None:
                    run_end = y
            else:
                if run_end is not None and (run_end - y) >= GROUND_STOREY_M * ppm * 0.6:
                    facade_foot_px = run_end
                    break
                run_end = None
        if facade_foot_px is None:
            facade_foot_px = int(h - args.base * ppm)
        geometric_ground_px = h - args.base * ppm
        ground_residual_m = round((geometric_ground_px - facade_foot_px) / ppm, 2)

        # Openings standing on the pavement are doors, not windows.
        #
        # The grid finds openings; it does not say what they are, so a front
        # door falling inside a storey row the window grid happened to find was
        # emitted as a window. The distinction is not subtle and does not need a
        # model: a door stands *on* the pavement and is tall, where a window sits
        # on a sill above it. Measured against the façade foot found from the
        # picture rather than the height model, since the two disagree by more
        # than a storey on a quarter of these buildings.
        for box in found:
            sill_above_pavement = (facade_foot_px - box.pop("_sillPx")) / ppm
            is_door = (abs(sill_above_pavement) <= DOOR_MAX_SILL_M
                       and box["heightM"] >= DOOR_MIN_H_M
                       and box["widthM"] <= 2.2
                       and box["glazed"] < 0.6)
            (doors if is_door else windows).append(box)

        # Doors get their own pass, over the ground storey.
        #
        # They cannot come out of the window grid, and trying to make them was
        # why this returned zero doors on every strip. Storey rows are found
        # from the *window* vote profile, so a row exists only where something
        # window-like was seen — and a front door is by definition not
        # window-like, being a solid painted leaf. The part of the wall where
        # the door is was never being looked at.
        #
        # So the ground storey is asserted from geometry rather than found. Its
        # position is the one thing here not in doubt: the pavement is where the
        # pavement is, and the door stands on it. Within that band, a bay whose
        # cell is wall rather than glazing is the way in.
        ground_y = int(min(h, facade_foot_px))
        ground_top = int(max(0, ground_y - GROUND_STOREY_M * ppm))
        door_bays = bays
        # How much of the ground storey is hidden behind parked things? A door
        # not found under a van is unobserved, not absent, and the difference
        # matters more here than anywhere else on the wall.
        occluded = 0.0
        if ground_y > ground_top:
            strip_band = wall_mask[ground_top:ground_y]
            occluded = round(1.0 - float(strip_band.mean()), 2)
        # If most of the ground storey is behind parked cars and bicycles, the
        # door is unobserved, not absent, and guessing where it is puts a
        # doorway on a car — which is exactly what a 0.45 wall threshold did.
        # Saying "blocked" is worth more than a confident wrong rectangle.
        # A residual this large means the height model and the photograph
        # disagree about where the ground is by more than a storey. Placing a
        # door on either answer would be a guess, so none is placed.
        can_place_door = occluded <= MAX_GROUND_OCCLUSION and abs(ground_residual_m) <= MAX_GROUND_RESIDUAL_M
        for x0, x1 in (door_bays if can_place_door and not doors else []):
            cell_glass = window_mask[ground_top:ground_y, x0:x1]
            cell_wall = wall_mask[ground_top:ground_y, x0:x1]
            # The bay has to be nearly all wall for the opening in it to be
            # this building's doorway rather than the side of a van.
            if cell_glass.size == 0 or float(cell_wall.mean()) < 0.72:
                continue
            glazed = float(cell_glass.mean())
            w_m = (x1 - x0) / ppm
            h_m = (ground_y - ground_top) / ppm
            if w_m < 0.7 or w_m > 2.6 or h_m < DOOR_MIN_H_M:
                continue
            # Mostly glazed at street level is a shopfront, and this fabric has
            # plenty; it is not the front door.
            if glazed >= 0.5:
                continue
            # A door is about as wide as a window and taller. Sizing it to the
            # whole bay put a 2.2 m doorway on a canal house.
            door_w = min(w_m, max(0.95, typical_w / ppm * 1.05))
            doors.append({"xM": round((x0 + (x1 - x0 - door_w * ppm) / 2) / ppm, 2), "yM": 0.0,
                          "widthM": round(door_w, 2), "heightM": round(min(h_m, 2.6), 2),
                          "glazed": round(glazed, 2), "sources": ["grid-ground-storey"],
                          "inferred": True})
        # At most one front door per plot. The narrowest candidate is the door;
        # anything wider beside it is a passage or a shop.
        if len(doors) > 1:
            doors = [min(doors, key=lambda d: d["widthM"])]

        out[pid] = {"pandId": pid, "share": share, "pixelsPerMetre": round(ppm, 1),
                    "windows": windows, "doors": doors,
                    "groundStoreyOccluded": occluded,
                    "groundResidualM": ground_residual_m,
                    "worldBoxes": len(world_boxes)}
        if overlays:
            base = Image.open(path).convert("RGB")
            if base.size != (w, h):
                base = base.resize((w, h))
            draw = ImageDraw.Draw(base)
            for boxes, colour in ((windows, (40, 235, 130)), (doors, (255, 180, 0))):
                for b in boxes:
                    bx = b["xM"] * ppm
                    by1 = h - (b["yM"] + args.base) * ppm
                    dash = b.get("inferred", False)
                    draw.rectangle([bx, by1 - b["heightM"] * ppm, bx + b["widthM"] * ppm, by1],
                                   outline=colour, width=2 if dash else 4)
            bar = Image.new("RGB", (w, 24), (16, 20, 22))
            ImageDraw.Draw(bar).text(
                (5, 6),
                f"{pid[-6:]} bld {share.get('building',0):.0f}%  win {len(windows)}"
                f"  door {len(doors)}  world {len(world_boxes)}  occl {occluded:.0%}",
                fill=(150, 235, 190))
            sheet = Image.new("RGB", (w, h + 24))
            sheet.paste(bar, (0, 0)); sheet.paste(base, (0, 24))
            sheet.save(overlays / f"{pid}.jpg", quality=84)
        done += 1
        sys.stdout.write("#" if windows else "-")
        sys.stdout.flush()
        if done % 50 == 0:
            sys.stdout.write(f" {done}\n")
    print()

    Path(args.out).write_text(json.dumps({
        "metadata": {"generator": "scripts/facade-twin/vision/ensemble.py",
                     "models": [FACADE_MODEL, WORLD_WEIGHTS],
                     "note": "Union of two detectors, disciplined by a bay-and-storey grid. "
                             "`sources` says what saw each opening; `inferred` means the grid "
                             "proposed it and neither model did.",
                     "judged": done, "stripBaseBelowGroundM": args.base},
        "facades": out}, indent=1))

    if out:
        nw = sum(len(v["windows"]) for v in out.values())
        nd = sum(len(v["doors"]) for v in out.values())
        inf = sum(1 for v in out.values() for b in v["windows"] + v["doors"] if b.get("inferred"))
        both = sum(1 for v in out.values() for b in v["windows"] if len(b["sources"]) > 1)
        withdoor = sum(1 for v in out.values() if v["doors"])
        blocked = sum(1 for v in out.values() if not v["doors"] and v.get("groundStoreyOccluded", 0) > 0.5)
        res = sorted(abs(v.get("groundResidualM", 0)) for v in out.values())
        if res:
            print(f"  ground residual |m|: median {res[len(res)//2]:.2f}  p90 {res[9*len(res)//10]:.2f}"
                  f"  over 1.5 m: {sum(1 for x in res if x > 1.5)}")
        print(f"{done} strips | {nw} windows, {nd} doors")
        print(f"  no door, ground floor blocked: {blocked}")
        print(f"  seen by both models : {both}")
        print(f"  inferred by grid    : {inf}")
        print(f"  façades with a door : {withdoor} ({100*withdoor//max(done,1)}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
