#!/usr/bin/env python3
"""Swapfiets preview rig: intact Sketchfab body + steer/spin empties (no tyre overlays).

  blender --background --python scripts/rig-swapfiets-overlays.py -- \\
    --source=~/Downloads/swapfiets.glb \\
    --out=public/canal-drive/swapfiets-sketchfab-preview.glb

Earlier overlay toruses were oversized and sat on top of the painted wheels,
which looked broken in the chase preview. Cutting verts from the Sketchfab
mesh also failed (holes / floating parts). This export keeps the reference
mesh whole, bakes ~1.7× lateral width for chase parity with the authored
omafiets, and only adds Lenker / RadVorn / RadHinten empties so the preview
page can share the same pivot names.

Spin of the painted tyres still needs a game-ready split mesh; the default
game bike remains omafiets-runtime.glb. Swapfiets is a look-only skin.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def parse_args(argv: list[str]) -> argparse.Namespace:
  if '--' in argv:
    argv = argv[argv.index('--') + 1 :]
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--source', required=True)
  parser.add_argument('--out', required=True)
  return parser.parse_args(argv)


def clear_scene() -> None:
  bpy.ops.wm.read_factory_settings(use_empty=True)


def import_bake_body(source: Path) -> bpy.types.Object:
  bpy.ops.import_scene.gltf(filepath=str(source))
  meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
  if not meshes:
    raise RuntimeError(f'no meshes in {source}')

  for obj in meshes:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  bpy.ops.object.select_all(action='DESELECT')
  for obj in meshes:
    obj.select_set(True)
  bpy.context.view_layer.objects.active = meshes[0]
  bpy.ops.object.join()
  body = bpy.context.view_layer.objects.active
  body.name = 'SwapfietsBody'

  for slot in body.material_slots:
    material = slot.material
    if not material:
      continue
    material.use_backface_culling = False
    if hasattr(material, 'blend_method'):
      material.blend_method = 'OPAQUE'

  bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
  coords = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
  min_z = min(point.z for point in coords)
  cx = (min(point.x for point in coords) + max(point.x for point in coords)) * 0.5
  cy = (min(point.y for point in coords) + max(point.y for point in coords)) * 0.5
  body.location -= Vector((cx, cy, min_z))
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  # Bake chase readability fattening into lateral Y (becomes Three.js Z after
  # export_yup). Runtime non-uniform scale broke the Sketchfab hierarchy.
  body.scale = (1.0, 1.7, 1.0)
  bpy.ops.object.select_all(action='DESELECT')
  body.select_set(True)
  bpy.context.view_layer.objects.active = body
  bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
  bpy.ops.object.shade_smooth()
  return body


def wheel_hubs(body: bpy.types.Object) -> tuple[Vector, Vector, float]:
  points = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
  z_min = min(point.z for point in points)
  height = max(point.z for point in points) - z_min
  band = [
    point
    for point in points
    if z_min + height * 0.12 < point.z < z_min + height * 0.55
  ]
  xs = [point.x for point in band] or [point.x for point in points]
  x_min, x_max = min(xs), max(xs)
  front_pts = [point for point in band if point.x > (x_min + x_max) * 0.55]
  rear_pts = [point for point in band if point.x < (x_min + x_max) * 0.45]
  if len(front_pts) < 10:
    front_pts = sorted(points, key=lambda point: point.x)[-len(points) // 5 :]
  if len(rear_pts) < 10:
    rear_pts = sorted(points, key=lambda point: point.x)[: len(points) // 5]
  front = sum(front_pts, Vector()) / len(front_pts)
  rear = sum(rear_pts, Vector()) / len(rear_pts)
  radius = max(height * 0.28, ((front.z + rear.z) * 0.5 - z_min))
  front = Vector((front.x, 0.0, z_min + radius))
  rear = Vector((rear.x, 0.0, z_min + radius))
  return front, rear, radius


def export_glb(root: bpy.types.Object, out: Path) -> None:
  out.parent.mkdir(parents=True, exist_ok=True)
  bpy.ops.object.select_all(action='DESELECT')

  def select_tree(obj: bpy.types.Object) -> None:
    obj.select_set(True)
    for child in obj.children:
      select_tree(child)

  select_tree(root)
  bpy.context.view_layer.objects.active = root
  bpy.ops.export_scene.gltf(
    filepath=str(out),
    export_format='GLB',
    use_selection=True,
    export_apply=False,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
  )


def main() -> None:
  args = parse_args(sys.argv)
  source = Path(args.source).expanduser().resolve()
  out = Path(args.out).expanduser().resolve()
  if not source.exists():
    raise SystemExit(f'source not found: {source}')

  clear_scene()
  body = import_bake_body(source)
  front, rear, radius = wheel_hubs(body)
  print(f'hubs front={tuple(round(c, 2) for c in front)} rear={tuple(round(c, 2) for c in rear)} r={radius:.1f}')

  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
  root = bpy.context.view_layer.objects.active
  root.name = 'Swapfiets'

  head = Vector((front.x - radius * 0.2, 0.0, front.z + radius * 0.85))
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=head)
  steer = bpy.context.view_layer.objects.active
  steer.name = 'Lenker'

  bpy.ops.object.empty_add(type='PLAIN_AXES', location=front)
  rad_v = bpy.context.view_layer.objects.active
  rad_v.name = 'RadVorn'

  bpy.ops.object.empty_add(type='PLAIN_AXES', location=rear)
  rad_h = bpy.context.view_layer.objects.active
  rad_h.name = 'RadHinten'

  body.parent = root
  body.matrix_parent_inverse = root.matrix_world.inverted()
  rad_h.parent = root
  rad_h.matrix_parent_inverse = root.matrix_world.inverted()
  steer.parent = root
  steer.matrix_parent_inverse = root.matrix_world.inverted()
  rad_v.parent = steer
  rad_v.matrix_parent_inverse = steer.matrix_world.inverted()

  export_glb(root, out)
  print(f'wrote {out} (body only, no tyre overlays)')


if __name__ == '__main__':
  main()
