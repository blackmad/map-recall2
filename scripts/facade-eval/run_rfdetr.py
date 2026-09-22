#!/usr/bin/env python3
"""Lane A adapter: run the cached Roboflow façade RF-DETR on rectified strips.

`FACADE_MODEL_EVALUATION_PLAN.md` §5 task 6. The model is
`building-facade-segmentation-instance/4` (RF-DETR instance segmentation,
768x768 ONNX, CC BY 4.0 uploader-asserted). It finds openings on rectified
façade crops; this adapter turns its crop-pixel masks into axis-aligned opening
boxes in WALL METRES, in the same frame the shared TypeScript crop helper uses
(`src/canalRecall/facade/evalCrop.ts`):

    along  metres from `plane.start` towards `plane.end`
    up     metres above `plane.baseZ`

Two settings, from §6:

  R0  the cached 45 px/m `full` strip, whole crop, no tiling.
  R1  re-rendered from the source panorama at `min(150, 0.9 x native)` px/m
      (4 MP cap), then cut into 768 px tiles with 15% overlap, run per tile,
      mapped into wall metres and merged with class-aware NMS at IoU 0.5.

Until lane C lands `scripts/facade-eval/prepare-crops.ts`, R1 is rendered here
from the manifest's `images.full` pose/plane and the locally cached panorama, as
a faithful port of `rectify.ts` / `evalCrop.ts`. Point `--crops-index` at lane
C's prepared crops to consume those pixels instead (identical frame schema).

Class mapping (this model has NO door/entrance class):

    window   -> window
    shop     -> other          (nearest semantic class; recorded, not a door)
    all else -> other          (facade, balcony-fence, fence, car, street,
                                vegetation, non-building-infrastructure,
                                traffic-infrastructure)

Each emitted box also carries `modelClass` so the scorer can re-filter.

Usage
-----
    MODEL_CACHE_DIR=<cache> <venv>/bin/python scripts/facade-eval/run_rfdetr.py \
        --manifest <area>/panorama-audit/<hash>/evidence/manifest.json \
        --setting R0 --limit 5 --out /tmp/rfdetr-r0.json

The Roboflow key is read from `ROBOFLOW_API_KEY` or the default key file. It is
never printed, logged, or written to the output.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Iterable, Optional, Sequence

# --------------------------------------------------------------------------- #
# Constants shared with src/canalRecall/facade/evalCrop.ts                    #
# --------------------------------------------------------------------------- #

SCHEMA_VERSION = 1
LANE = "rfdetr"
MODEL_ID = "building-facade-segmentation-instance/4"

FULL_TIER_PPM = 45.0
CACHED_FULL_MAX_PIXELS = 1_400_000
R1_MAX_PPM = 150.0
R1_NATIVE_UTILISATION = 0.9
R1_MAX_PIXELS = 4_000_000
EQUIRECTANGULAR_WIDTH_PX = 8000
EQUIRECTANGULAR_HEIGHT_PX = 4000
EQUIRECTANGULAR_PIXELS_PER_RADIAN = EQUIRECTANGULAR_WIDTH_PX / (2 * math.pi)

DEFAULT_TILE_SIZE_PX = 768
DEFAULT_TILE_OVERLAP = 0.15
DEFAULT_NMS_IOU = 0.5
DEFAULT_CONFIDENCE = 0.4

DEGREES_TO_RADIANS = math.pi / 180.0

#: The model's ten classes (background_class83422 is stripped at load).
MODEL_CLASSES = (
    "balcony-fence",
    "car",
    "facade",
    "fence",
    "non-building-infrastructure",
    "shop",
    "street",
    "traffic-infrastructure",
    "vegetation",
    "window",
)

#: Class mapping required by the task. No model class maps to `door`.
CLASS_MAPPING: dict[str, str] = {"window": "window", "shop": "other"}
DEFAULT_CLASS_KIND = "other"
HAS_DOOR_CLASS = False

DEFAULT_KEY_FILE = (
    "/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.env.local"
)


def kind_for(model_class: str) -> str:
    """Map a model class name to the output `kind`. Never returns `door`."""
    return CLASS_MAPPING.get(model_class, DEFAULT_CLASS_KIND)


# --------------------------------------------------------------------------- #
# Geometry: frame, tile grid, pixel <-> wall metre (ports of evalCrop.ts)     #
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CropFrame:
    width: int
    height: int
    pixels_per_metre: float
    wall_width_m: float
    wall_height_m: float
    base_z: float
    top_z: float

    def to_json(self) -> dict[str, Any]:
        return {
            "width": self.width,
            "height": self.height,
            "pixelsPerMetre": round(self.pixels_per_metre, 6),
            "wallWidthM": round(self.wall_width_m, 6),
            "wallHeightM": round(self.wall_height_m, 6),
            "baseZ": round(self.base_z, 6),
            "topZ": round(self.top_z, 6),
        }


def plane_width_m(plane: dict[str, Any]) -> float:
    return math.hypot(
        plane["end"]["x"] - plane["start"]["x"],
        plane["end"]["y"] - plane["start"]["y"],
    )


def crop_frame(
    plane: dict[str, Any],
    width: int,
    height: int,
    pixels_per_metre: Optional[float] = None,
) -> CropFrame:
    wall_width_m = plane_width_m(plane)
    wall_height_m = plane["topZ"] - plane["baseZ"]
    if not wall_width_m > 0:
        raise ValueError("crop_frame: wall has zero length")
    if not wall_height_m > 0:
        raise ValueError("crop_frame: wall has zero height")
    if not (width > 0 and height > 0):
        raise ValueError("crop_frame: raster has non-positive size")
    ppm = pixels_per_metre if pixels_per_metre is not None else width / wall_width_m
    return CropFrame(width, height, ppm, wall_width_m, wall_height_m, plane["baseZ"], plane["topZ"])


def crop_pixel_to_wall_metre(frame: CropFrame, x: float, y: float) -> tuple[float, float]:
    """Crop pixel index -> (along, up) wall metres. Matches evalCrop.ts."""
    return (
        ((x + 0.5) / frame.width) * frame.wall_width_m,
        frame.wall_height_m * (1.0 - (y + 0.5) / frame.height),
    )


def wall_metre_to_crop_pixel(frame: CropFrame, along: float, up: float) -> tuple[float, float]:
    return (
        (along / frame.wall_width_m) * frame.width - 0.5,
        (1.0 - up / frame.wall_height_m) * frame.height - 0.5,
    )


def plan_tiles(
    raster: dict[str, int],
    tile_size: int = DEFAULT_TILE_SIZE_PX,
    overlap: float = DEFAULT_TILE_OVERLAP,
) -> list[dict[str, int]]:
    """Cover a raster with overlapping square tiles, row-major (evalCrop.ts)."""
    width, height = raster["width"], raster["height"]
    if not (width > 0 and height > 0):
        raise ValueError("plan_tiles: raster has non-positive size")
    if not tile_size >= 1:
        raise ValueError(f"plan_tiles: tileSize {tile_size} must be at least 1")
    if not (0.0 <= overlap < 1.0):
        raise ValueError(f"plan_tiles: overlap {overlap} must be in [0, 1)")

    stride = max(1, int(math.floor(tile_size * (1.0 - overlap))))

    def count(length: int) -> int:
        return 1 if length <= tile_size else 1 + math.ceil((length - tile_size) / stride)

    columns, rows = count(width), count(height)
    tiles: list[dict[str, int]] = []
    for row in range(rows):
        y = row * stride
        tile_h = min(tile_size, height - y)
        for column in range(columns):
            x = column * stride
            tiles.append(
                {
                    "index": row * columns + column,
                    "column": column,
                    "row": row,
                    "columns": columns,
                    "rows": rows,
                    "x": x,
                    "y": y,
                    "width": min(tile_size, width - x),
                    "height": tile_h,
                }
            )
    return tiles


# --------------------------------------------------------------------------- #
# Panorama re-render (port of rectify.ts, vectorised with numpy)              #
# --------------------------------------------------------------------------- #


def to_camera_frame(
    dx: Any, dy: Any, dz: Any, pose: dict[str, float]
) -> tuple[Any, Any, Any]:
    import numpy as np

    yaw = pose["headingDeg"] * DEGREES_TO_RADIANS
    pitch = pose["pitchDeg"] * DEGREES_TO_RADIANS
    roll = pose["rollDeg"] * DEGREES_TO_RADIANS

    x = dx * math.cos(yaw) - dy * math.sin(yaw)
    y = dx * math.sin(yaw) + dy * math.cos(yaw)
    z = dz

    y1 = y * math.cos(pitch) + z * math.sin(pitch)
    z1 = -y * math.sin(pitch) + z * math.cos(pitch)
    y, z = y1, z1

    x2 = x * math.cos(roll) - z * math.sin(roll)
    z2 = x * math.sin(roll) + z * math.cos(roll)
    return x2, y, z2


def world_to_equirect_pixel(
    x: Any,
    y: Any,
    z: Any,
    pose: dict[str, float],
    image_w: int,
    image_h: int,
    uses_orientation: bool,
    yaw_convention: str,
) -> tuple[Any, Any]:
    import numpy as np

    dx, dy, dz = x - pose["x"], y - pose["y"], z - pose["z"]
    if uses_orientation:
        dx, dy, dz = to_camera_frame(dx, dy, dz, pose)
    length = np.sqrt(dx * dx + dy * dy + dz * dz)
    length = np.where(length == 0, 1.0, length)
    azimuth = np.arctan2(dx, dy)
    elevation = np.arcsin(np.clip(dz / length, -1.0, 1.0))
    turns = azimuth / (2.0 * math.pi)
    if yaw_convention == "centre":
        u = ((turns + 0.5) % 1.0 + 1.0) % 1.0
    else:
        u = (turns % 1.0 + 1.0) % 1.0
    v = 0.5 - elevation / math.pi
    return u * image_w, v * image_h


def bilinear_sample(pano, u, v):  # type: ignore[no-untyped-def]
    """Bilinear sample an (H, W, 3) uint8 image, wrapping horizontally."""
    import numpy as np

    h, w = pano.shape[0], pano.shape[1]
    x0 = np.floor(u).astype(np.int64)
    y0 = np.floor(v).astype(np.int64)
    fx = (u - x0)[..., None]
    fy = (v - y0)[..., None]
    xa = x0 % w
    xb = (x0 + 1) % w
    ya = np.clip(y0, 0, h - 1)
    yb = np.clip(y0 + 1, 0, h - 1)
    p00 = pano[ya, xa].astype(np.float32)
    p10 = pano[ya, xb].astype(np.float32)
    p01 = pano[yb, xa].astype(np.float32)
    p11 = pano[yb, xb].astype(np.float32)
    return p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy


def rectify_facade(
    pano,  # type: ignore[no-untyped-def]
    pose: dict[str, float],
    plane: dict[str, Any],
    pixels_per_metre: float,
    max_pixels: int,
    uses_orientation: bool = False,
    yaw_convention: str = "centre",
):  # type: ignore[no-untyped-def]
    """Port of `rectifyFacade`. Returns an (H, W, 3) uint8 RGB array."""
    import numpy as np

    wall_width_m = plane_width_m(plane)
    wall_height_m = plane["topZ"] - plane["baseZ"]
    scale = pixels_per_metre
    if wall_width_m * scale * wall_height_m * scale > max_pixels:
        scale = math.sqrt(max_pixels / (wall_width_m * wall_height_m))

    width = max(1, round(wall_width_m * scale))
    height = max(1, round(wall_height_m * scale))

    px = (np.arange(width, dtype=np.float64) + 0.5) / width
    py = (np.arange(height, dtype=np.float64) + 0.5) / height
    along = px * wall_width_m
    ux = (plane["end"]["x"] - plane["start"]["x"]) / wall_width_m
    uy = (plane["end"]["y"] - plane["start"]["y"]) / wall_width_m
    world_x = (plane["start"]["x"] + ux * along)[None, :]
    world_y = (plane["start"]["y"] + uy * along)[None, :]
    world_z = (plane["topZ"] - py * wall_height_m)[:, None]

    su, sv = world_to_equirect_pixel(
        world_x,
        world_y,
        world_z,
        pose,
        pano.shape[1],
        pano.shape[0],
        uses_orientation,
        yaw_convention,
    )
    valid = np.isfinite(su) & np.isfinite(sv) & (sv >= 0) & (sv < pano.shape[0])
    u_safe = np.where(valid, su, 0.0)
    v_safe = np.where(valid, np.clip(sv, 0, pano.shape[0] - 1), 0.0)
    rgb = bilinear_sample(pano, u_safe, v_safe)
    rgb[~valid] = 0.0
    return np.clip(rgb, 0, 255).astype(np.uint8), scale


def native_ceiling_ppm(standoff: float, obliquity_deg: float) -> float:
    return (
        EQUIRECTANGULAR_PIXELS_PER_RADIAN
        * math.cos(obliquity_deg * DEGREES_TO_RADIANS)
        / standoff
    )


def r1_pixels_per_metre(standoff: float, obliquity_deg: float) -> float:
    requested = min(R1_MAX_PPM, R1_NATIVE_UTILISATION * native_ceiling_ppm(standoff, obliquity_deg))
    return max(FULL_TIER_PPM, requested)


# --------------------------------------------------------------------------- #
# Detection -> wall-metre boxes and merging                                   #
# --------------------------------------------------------------------------- #


def prediction_pixel_box(pred: Any, crop_w: int, crop_h: int) -> Optional[tuple[float, float, float, float]]:
    """Axis-aligned pixel box for a prediction, preferring the instance mask.

    Points are the mask polygon in original (crop/tile) pixel coordinates. The
    polygon bounding box is tighter than the network's regression box; fall back
    to the box when the mask is degenerate. Clipped to the raster.
    """
    xs: list[float] = []
    ys: list[float] = []
    points = getattr(pred, "points", None)
    if points:
        for p in points:
            xs.append(float(p.x))
            ys.append(float(p.y))
    if len(xs) >= 3:
        x1, x2 = min(xs), max(xs)
        y1, y2 = min(ys), max(ys)
    else:
        cx, cy = float(pred.x), float(pred.y)
        w, h = float(pred.width), float(pred.height)
        x1, x2 = cx - w / 2.0, cx + w / 2.0
        y1, y2 = cy - h / 2.0, cy + h / 2.0
    x1 = max(0.0, min(x1, crop_w))
    x2 = max(0.0, min(x2, crop_w))
    y1 = max(0.0, min(y1, crop_h))
    y2 = max(0.0, min(y2, crop_h))
    if x2 <= x1 or y2 <= y1:
        return None
    return x1, y1, x2, y2


def tile_box_to_wall_box(
    frame: CropFrame,
    tile_x: int,
    tile_y: int,
    px_box: tuple[float, float, float, float],
) -> dict[str, float]:
    """Tile-local pixel box -> wall-metre box anchored at its min corner."""
    x1, y1, x2, y2 = px_box
    along_min, up_min = crop_pixel_to_wall_metre(frame, tile_x + x1, tile_y + y2)
    along_max, up_max = crop_pixel_to_wall_metre(frame, tile_x + x2, tile_y + y1)
    return {
        "along": along_min,
        "up": up_min,
        "widthM": max(0.0, along_max - along_min),
        "heightM": max(0.0, up_max - up_min),
    }


def iou_metre(a: dict[str, float], b: dict[str, float]) -> float:
    ax1, ay1 = a["along"], a["up"]
    ax2, ay2 = ax1 + a["widthM"], ay1 + a["heightM"]
    bx1, by1 = b["along"], b["up"]
    bx2, by2 = bx1 + b["widthM"], by1 + b["heightM"]
    ix = max(0.0, min(ax2, bx2) - max(ax1, bx1))
    iy = max(0.0, min(ay2, by2) - max(ay1, by1))
    inter = ix * iy
    union = a["widthM"] * a["heightM"] + b["widthM"] * b["heightM"] - inter
    return inter / union if union > 0 else 0.0


def nms_class_aware(boxes: list[dict[str, Any]], iou_threshold: float) -> list[dict[str, Any]]:
    """Greedy NMS within each `modelClass`, highest score first. Deterministic."""
    kept: list[dict[str, Any]] = []
    by_class: dict[str, list[dict[str, Any]]] = {}
    for box in boxes:
        by_class.setdefault(box["modelClass"], []).append(box)
    for model_class in sorted(by_class):
        group = sorted(
            by_class[model_class],
            key=lambda b: (-b["score"], b["along"], b["up"], b["sourceTile"]),
        )
        taken: list[dict[str, Any]] = []
        for candidate in group:
            if all(iou_metre(candidate, t) <= iou_threshold for t in taken):
                taken.append(candidate)
        kept.extend(taken)
    kept.sort(key=lambda b: (b["along"], b["up"], -b["score"], b["modelClass"]))
    return kept


# --------------------------------------------------------------------------- #
# Model wrapper                                                               #
# --------------------------------------------------------------------------- #


class RfDetrModel:
    def __init__(self, api_key: str, model_id: str = MODEL_ID):
        from inference import get_model  # imported lazily so --help is fast

        self.model_id = model_id
        self.model = get_model(model_id=model_id, api_key=api_key)
        self.class_names = list(getattr(self.model, "class_names", MODEL_CLASSES))

    def infer(self, pil_image, confidence: float) -> list[Any]:
        result = self.model.infer(pil_image, confidence=confidence)
        response = result[0] if isinstance(result, list) else result
        return list(getattr(response, "predictions", []) or [])


# --------------------------------------------------------------------------- #
# Crop sources                                                                #
# --------------------------------------------------------------------------- #


@dataclass
class CropJob:
    record: dict[str, Any]
    area: str
    manifest: str
    frame: CropFrame
    image_path: str
    tiles: Optional[list[dict[str, int]]]  # None => whole crop, no tiling


def load_key(path: str) -> str:
    env = os.environ.get("ROBOFLOW_API_KEY")
    if env:
        return env.strip()
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line.startswith("ROBOFLOW_API_KEY="):
                    value = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if value:
                        return value
    except FileNotFoundError:
        pass
    raise SystemExit(
        "ROBOFLOW_API_KEY not set and no key found in the default key file "
        "(value not printed)."
    )


def derive_panorama_dir(manifest_path: str) -> Optional[str]:
    marker = f"{os.sep}city-appearance{os.sep}"
    if marker in manifest_path:
        root = manifest_path.split(marker, 1)[0] + marker
        candidate = os.path.join(root, "shared-panoramas")
        if os.path.isdir(candidate):
            return candidate
    return None


def area_name(manifest_path: str) -> str:
    parts = manifest_path.split(os.sep)
    if "areas" in parts:
        index = parts.index("areas")
        if index + 1 < len(parts):
            return parts[index + 1]
    return os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(manifest_path))))


def load_manifest_jobs(
    manifest_path: str,
    setting: str,
    panorama_dir: Optional[str],
    r1_cache_dir: Optional[str],
    tile_size: int,
    overlap: float,
) -> list[CropJob]:
    with open(manifest_path, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)
    evidence_dir = os.path.dirname(os.path.abspath(manifest_path))
    images_dir = os.path.join(evidence_dir, "images")
    area = area_name(manifest_path)
    jobs: list[CropJob] = []
    for record in manifest.get("records", []):
        full = (record.get("images") or {}).get("full")
        if not full:
            continue
        plane = full["plane"]
        if setting == "R0":
            path = os.path.join(images_dir, full["file"])
            frame = crop_frame(plane, int(full["width"]), int(full["height"]))
            jobs.append(CropJob(record, area, manifest_path, frame, path, None))
        else:
            if not panorama_dir:
                raise SystemExit("R1 requires --panorama-dir (or a manifest under city-appearance/)")
            pano_id = full.get("panoramaId")
            pano_path = os.path.join(panorama_dir, f"{pano_id}.jpg") if pano_id else None
            if not pano_path or not os.path.exists(pano_path):
                missing = dict(record)
                missing["_error"] = f"source panorama not cached: {pano_id or 'unknown'}"
                jobs.append(
                    CropJob(
                        missing,
                        area,
                        manifest_path,
                        crop_frame(plane, int(full["width"]), int(full["height"])),
                        os.path.join(images_dir, full["file"]),
                        [],
                    )
                )
                continue
            requested = r1_pixels_per_metre(float(full["standoff"]), float(full["obliquity"]))
            # Render lazily in the runner; stash the request on the record copy.
            job_record = dict(record)
            job_record["_r1"] = {
                "pano_path": pano_path,
                "requested_ppm": requested,
                "pose": full["pose"],
                "camera": manifest.get("camera") or {},
            }
            jobs.append(CropJob(job_record, area, manifest_path, crop_frame(plane, 1, 1), pano_path, None))
    return jobs


def load_crops_index_jobs(index_path: str, setting: str, tile_size: int, overlap: float) -> list[CropJob]:
    """Consume lane C's prepared crops (a JSON list of frame descriptors).

    A descriptor is `{buildingId, elevationId, surfaceId, cropFile, frame:{...},
    tiles?:bool}`. `frame` follows the shared `CropFrame` shape.
    """
    with open(index_path, "r", encoding="utf-8") as handle:
        entries = json.load(handle)
    if isinstance(entries, dict):
        entries = entries.get("crops") or entries.get("records") or []
    jobs: list[CropJob] = []
    for entry in entries:
        frame_data = entry["frame"]
        frame = CropFrame(
            int(frame_data["width"]),
            int(frame_data["height"]),
            float(frame_data.get("pixelsPerMetre", frame_data["width"] / frame_data["wallWidthM"])),
            float(frame_data["wallWidthM"]),
            float(frame_data["wallHeightM"]),
            float(frame_data["baseZ"]),
            float(frame_data["topZ"]),
        )
        record = {
            "buildingId": entry.get("buildingId"),
            "elevationId": entry.get("elevationId"),
            "surfaceId": entry.get("surfaceId") or entry.get("elevationId"),
        }
        tiles = None
        if setting == "R1" and entry.get("tiles", True):
            tiles = plan_tiles({"width": frame.width, "height": frame.height}, tile_size, overlap)
        jobs.append(CropJob(record, entry.get("area", "unknown"), index_path, frame, entry["cropFile"], tiles))
    return jobs


# --------------------------------------------------------------------------- #
# Selection                                                                   #
# --------------------------------------------------------------------------- #


def load_selection(path: Optional[str]) -> Optional[set[str]]:
    if not path:
        return None
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    keys: set[str] = set()

    def add(item: Any) -> None:
        if isinstance(item, str):
            keys.add(item)
        elif isinstance(item, dict):
            for field in ("elevationId", "id", "buildingId"):
                value = item.get(field)
                if value:
                    keys.add(str(value))

    if isinstance(data, dict):
        for field in ("buildings", "records", "selection", "buildingIds", "elevationIds"):
            value = data.get(field)
            if isinstance(value, list):
                for item in value:
                    add(item)
    elif isinstance(data, list):
        for item in data:
            add(item)
    return keys or None


def job_selected(job: CropJob, selection: Optional[set[str]]) -> bool:
    if selection is None:
        return True
    building_id = str(job.record.get("buildingId"))
    elevation_id = str(job.record.get("elevationId"))
    return building_id in selection or elevation_id in selection


# --------------------------------------------------------------------------- #
# Output                                                                      #
# --------------------------------------------------------------------------- #


def record_key(job: CropJob, setting: str) -> str:
    return "|".join(
        [
            str(job.record.get("buildingId")),
            str(job.record.get("elevationId")),
            str(job.record.get("surfaceId") or job.record.get("elevationId")),
            setting,
        ]
    )


def write_output(path: str, payload: dict[str, Any]) -> None:
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=False)
        handle.write("\n")
    os.replace(tmp, path)


def box_json(box: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": box["kind"],
        "score": round(box["score"], 4),
        "along": round(box["along"], 4),
        "up": round(box["up"], 4),
        "widthM": round(box["widthM"], 4),
        "heightM": round(box["heightM"], 4),
        "modelClass": box["modelClass"],
    }


def tiles_to_record(job: CropJob, tiles: int, boxes: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "buildingId": job.record.get("buildingId"),
        "elevationId": job.record.get("elevationId"),
        "surfaceId": job.record.get("surfaceId") or job.record.get("elevationId"),
        "area": job.area,
        "wallWidthM": round(job.frame.wall_width_m, 4),
        "wallHeightM": round(job.frame.wall_height_m, 4),
        "cropFile": job.image_path,
        "cropWidthPx": job.frame.width,
        "cropHeightPx": job.frame.height,
        "pixelsPerMetre": round(job.frame.pixels_per_metre, 3),
        "tiles": tiles,
        "boxes": [box_json(b) for b in boxes],
    }


# --------------------------------------------------------------------------- #
# Runner                                                                      #
# --------------------------------------------------------------------------- #


def whole_tile(width: int, height: int) -> dict[str, int]:
    return {
        "index": 0,
        "column": 0,
        "row": 0,
        "columns": 1,
        "rows": 1,
        "x": 0,
        "y": 0,
        "width": width,
        "height": height,
    }


def run_crop(
    model: RfDetrModel,
    job: CropJob,
    setting: str,
    confidence: float,
    tile_size: int,
    overlap: float,
    nms_iou: float,
    r1_cache_dir: Optional[str],
) -> tuple[dict[str, Any], int, int]:
    """Return (record, tiles_run, detections_before_nms).

    Three sources feed the same tile loop:
      * R1 from a manifest  -> render the strip here, then tile;
      * a prepared crop     -> `job.tiles` is the tile grid (or a single tile);
      * R0 from a manifest  -> the cached strip as one untiled raster.
    """
    from PIL import Image

    if job.record.get("_error"):
        raise RuntimeError(job.record["_error"])

    tiles: list[dict[str, int]]
    if job.record.get("_r1"):  # R1: render from the source panorama
        import numpy as np

        r1 = job.record["_r1"]
        plane = job.record["images"]["full"]["plane"]
        pano = np.asarray(Image.open(r1["pano_path"]).convert("RGB"))
        rgb, scale = rectify_facade(
            pano,
            r1["pose"],
            plane,
            r1["requested_ppm"],
            R1_MAX_PIXELS,
            uses_orientation=bool((r1.get("camera") or {}).get("usesOrientation", False)),
            yaw_convention=(r1.get("camera") or {}).get("yaw", "centre"),
        )
        height, width = rgb.shape[0], rgb.shape[1]
        frame = crop_frame(plane, width, height, scale)
        crop_image = Image.fromarray(rgb)
        if r1_cache_dir:
            os.makedirs(r1_cache_dir, exist_ok=True)
            name = f"{job.record.get('elevationId', 'crop').replace(':', '_')}.png"
            crop_file = os.path.join(r1_cache_dir, name)
            crop_image.save(crop_file)
        else:
            crop_file = f"<rendered {width}x{height}>"
        tiles = plan_tiles({"width": width, "height": height}, tile_size, overlap)
    else:
        if not job.image_path or not os.path.exists(job.image_path):
            raise FileNotFoundError(f"crop missing: {job.image_path}")
        crop_image = Image.open(job.image_path).convert("RGB")
        frame = job.frame
        if job.record.get("images", {}).get("full"):
            # Manifest R0: derive the metric frame from the stored plane/raster.
            plane = job.record["images"]["full"]["plane"]
            frame = crop_frame(plane, crop_image.width, crop_image.height)
        crop_file = job.image_path
        tiles = list(job.tiles) if job.tiles else [whole_tile(frame.width, frame.height)]

    boxes: list[dict[str, Any]] = []
    for tile in tiles:
        if (
            tile["x"] == 0
            and tile["y"] == 0
            and tile["width"] == crop_image.width
            and tile["height"] == crop_image.height
            and len(tiles) == 1
        ):
            tile_image = crop_image
        else:
            tile_image = crop_image.crop(
                (tile["x"], tile["y"], tile["x"] + tile["width"], tile["y"] + tile["height"])
            )
        preds = model.infer(tile_image, confidence)
        boxes.extend(
            collect_boxes(
                preds, frame, tile["x"], tile["y"], tile["width"], tile["height"], tile["index"]
            )
        )
    merged = nms_class_aware(boxes, nms_iou)
    recorded = CropJob(job.record, job.area, job.manifest, frame, crop_file, tiles)
    return tiles_to_record(recorded, len(tiles), merged), len(tiles), len(boxes)


def collect_boxes(
    preds: Iterable[Any],
    frame: CropFrame,
    tile_x: int,
    tile_y: int,
    local_w: int,
    local_h: int,
    tile_index: int = 0,
) -> list[dict[str, Any]]:
    # Predictions are in the local raster's pixel space (whole crop for R0, the
    # tile for R1), so clip against the raster actually passed to the model.
    out: list[dict[str, Any]] = []
    for pred in preds:
        model_class = getattr(pred, "class_name", None) or getattr(pred, "class", None) or "unknown"
        pixel_box = prediction_pixel_box(pred, local_w, local_h)
        if pixel_box is None:
            continue
        wall_box = tile_box_to_wall_box(frame, tile_x, tile_y, pixel_box)
        if wall_box["widthM"] <= 0.0 or wall_box["heightM"] <= 0.0:
            continue
        out.append(
            {
                "kind": kind_for(model_class),
                "modelClass": model_class,
                "score": float(getattr(pred, "confidence", 0.0)),
                "sourceTile": tile_index,
                **wall_box,
            }
        )
    return out


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the cached RF-DETR façade model on rectified crops (lane A).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--manifest", action="append", default=[], help="evidence manifest.json (repeatable)")
    parser.add_argument("--crops-index", help="lane C prepared crops JSON (frame descriptors)")
    parser.add_argument("--setting", choices=["R0", "R1"], default="R0")
    parser.add_argument("--out", required=True, help="output JSON path")
    parser.add_argument("--limit", type=int, default=0, help="max records to run (0 = all)")
    parser.add_argument("--selection", help="selection.json or JSON list of building/elevation ids")
    parser.add_argument("--confidence", type=float, default=DEFAULT_CONFIDENCE)
    parser.add_argument("--tile-size", type=int, default=DEFAULT_TILE_SIZE_PX)
    parser.add_argument("--overlap", type=float, default=DEFAULT_TILE_OVERLAP)
    parser.add_argument("--nms-iou", type=float, default=DEFAULT_NMS_IOU)
    parser.add_argument("--panorama-dir", help="dir of <panoramaId>.jpg source panoramas (R1)")
    parser.add_argument("--r1-cache-dir", help="write rendered R1 strips here")
    parser.add_argument("--key-file", default=DEFAULT_KEY_FILE)
    parser.add_argument("--resume", action="store_true", help="skip records already in --out")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="set OFFLINE_MODE=true (requires a cache warmed with OFFLINE_MODE_WARM_UP)",
    )
    parser.add_argument("--quiet", action="store_true")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.manifest and not args.crops_index:
        raise SystemExit("pass --manifest or --crops-index")

    if args.offline:
        os.environ.setdefault("OFFLINE_MODE", "true")

    api_key = load_key(args.key_file)

    # Build the job list deterministically.
    jobs: list[CropJob] = []
    if args.crops_index:
        jobs.extend(load_crops_index_jobs(args.crops_index, args.setting, args.tile_size, args.overlap))
    for manifest_path in args.manifest:
        panorama_dir = args.panorama_dir or derive_panorama_dir(os.path.abspath(manifest_path))
        jobs.extend(
            load_manifest_jobs(
                manifest_path,
                args.setting,
                panorama_dir,
                args.r1_cache_dir,
                args.tile_size,
                args.overlap,
            )
        )
    jobs.sort(key=lambda j: (j.area, str(j.record.get("buildingId")), str(j.record.get("elevationId"))))

    # Dedupe by (buildingId, elevationId).
    seen: set[tuple[str, str]] = set()
    deduped: list[CropJob] = []
    for job in jobs:
        key = (str(job.record.get("buildingId")), str(job.record.get("elevationId")))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(job)
    jobs = deduped

    selection = load_selection(args.selection)
    if selection is not None:
        jobs = [j for j in jobs if job_selected(j, selection)]

    # Resume: keep prior good records, skip their crops.
    prior_records: list[dict[str, Any]] = []
    done: set[str] = set()
    if args.resume and os.path.exists(args.out):
        try:
            with open(args.out, "r", encoding="utf-8") as handle:
                existing = json.load(handle)
            prior_records = list(existing.get("records", []))
            done = {
                record_key_from_dict(r, args.setting)
                for r in prior_records
                if not r.get("error")
            }
        except (json.JSONDecodeError, OSError):
            prior_records = []
    remaining = [j for j in jobs if record_key(j, args.setting) not in done]
    if args.limit and args.limit > 0:
        remaining = remaining[: args.limit]

    if not remaining:
        if not args.quiet:
            print("nothing to do: every selected record is already present", file=sys.stderr)
        write_output(
            args.out,
            assemble_payload(args, [], prior_records, [], 0, 0, 0, 0.0),
        )
        return 0

    model = RfDetrModel(api_key)

    records: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    crops_run = 0
    tiles_run = 0
    detections = 0
    started = time.perf_counter()

    for index, job in enumerate(remaining, start=1):
        label = f"{job.record.get('buildingId')} {job.record.get('elevationId')}"
        try:
            record, n_tiles, n_det = run_crop(
                model,
                job,
                args.setting,
                args.confidence,
                args.tile_size,
                args.overlap,
                args.nms_iou,
                args.r1_cache_dir,
            )
            records.append(record)
            crops_run += 1
            tiles_run += n_tiles
            detections += n_det
            if not args.quiet:
                print(
                    f"[{index}/{len(remaining)}] {label} tiles={n_tiles} "
                    f"boxes={len(record['boxes'])}",
                    file=sys.stderr,
                )
        except Exception as exc:  # noqa: BLE001 - one bad crop must not kill the run
            message = f"{type(exc).__name__}: {exc}"
            errors.append({"buildingId": job.record.get("buildingId"), "elevationId": job.record.get("elevationId"), "error": message})
            records.append(
                {
                    **tiles_to_record(job, 0, []),
                    "error": message,
                }
            )
            if not args.quiet:
                print(f"[{index}/{len(remaining)}] {label} ERROR {message}", file=sys.stderr)

        elapsed = time.perf_counter() - started
        payload = assemble_payload(args, records, prior_records, errors, crops_run, tiles_run, detections, elapsed)
        write_output(args.out, payload)

    total_elapsed = time.perf_counter() - started
    final_payload = assemble_payload(args, records, prior_records, errors, crops_run, tiles_run, detections, total_elapsed)
    write_output(args.out, final_payload)

    if not args.quiet:
        per_crop = total_elapsed / crops_run if crops_run else 0.0
        per_tile = total_elapsed / tiles_run if tiles_run else 0.0
        print(
            f"done: crops={crops_run} tiles={tiles_run} errors={len(errors)} "
            f"{total_elapsed:.1f}s total, {per_crop:.2f}s/crop, {per_tile:.2f}s/tile -> {args.out}",
            file=sys.stderr,
        )
    return 0


def record_key_from_dict(record: dict[str, Any], setting: str) -> str:
    return "|".join(
        [
            str(record.get("buildingId")),
            str(record.get("elevationId")),
            str(record.get("surfaceId")),
            setting,
        ]
    )


def assemble_payload(
    args: argparse.Namespace,
    records: list[dict[str, Any]],
    prior_records: list[dict[str, Any]],
    errors: list[dict[str, Any]],
    crops_run: int,
    tiles_run: int,
    detections: int,
    elapsed: float,
) -> dict[str, Any]:
    merged = prior_records + records
    merged.sort(key=lambda r: (str(r.get("area", "")), str(r.get("buildingId")), str(r.get("elevationId"))))
    per_crop = elapsed / crops_run if crops_run else None
    per_tile = elapsed / tiles_run if tiles_run else None
    return {
        "schemaVersion": SCHEMA_VERSION,
        "lane": LANE,
        "model": MODEL_ID,
        "setting": args.setting,
        "confidence": args.confidence,
        "tileSizePx": args.tile_size,
        "tileOverlap": args.overlap,
        "nmsIou": args.nms_iou,
        "boxConvention": (
            "axis-aligned wall-metre box: `along` is the min edge measured in metres from "
            "plane.start; `up` is the min edge in metres above plane.baseZ. The box spans "
            "[along, along+widthM] x [up, up+heightM]. Class-aware NMS at nmsIou."
        ),
        "classMapping": CLASS_MAPPING,
        "hasDoorClass": HAS_DOOR_CLASS,
        "classMappingNote": (
            "This model has no door/entrance class. `shop` is mapped to `other`; every "
            "class except `window` maps to `other`."
        ),
        "throughput": {
            "cropsRun": crops_run,
            "tilesRun": tiles_run,
            "detectionsBeforeNms": detections,
            "secondsTotal": round(elapsed, 3),
            "secondsPerCrop": round(per_crop, 4) if per_crop is not None else None,
            "secondsPerTile": round(per_tile, 4) if per_tile is not None else None,
        },
        "errors": errors,
        "records": merged,
    }


if __name__ == "__main__":
    raise SystemExit(main())
