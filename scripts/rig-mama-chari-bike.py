#!/usr/bin/env python3
"""Rig pokoponmaru's Sketchfab mama-chari for Canal Recall.

  blender --background --python scripts/rig-mama-chari-bike.py -- \\
    --source=~/Downloads/city-bikemama-chari.zip \\
    --out=public/canal-drive/mama-chari-runtime.glb

Prefer the zip's FBX (`source/MamBike.fbx`); a raw `.glb` also works. Loose
parts are split so the rear child seat becomes a toggleable `BabySeat`, the
handle becomes `Lenker`, and the wheel discs become `RadVorn` / `RadHinten`.
"""

from __future__ import annotations

import argparse
import math
import sys
import tempfile
import zipfile
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def parse_args(argv: list[str]) -> argparse.Namespace:
  if '--' in argv:
    argv = argv[argv.index('--') + 1 :]
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--source', required=True, help='.zip / .fbx / .glb path')
  parser.add_argument('--out', required=True)
  return parser.parse_args(argv)


def clear_scene() -> None:
  bpy.ops.wm.read_factory_settings(use_empty=True)


def world_loc(obj: bpy.types.Object) -> Vector:
  bpy.context.view_layer.update()
  return obj.matrix_world.translation.copy()


def reparent_keep(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
  bpy.context.view_layer.update()
  world = obj.matrix_world.copy()
  obj.parent = parent
  obj.matrix_parent_inverse = Matrix.Identity(4)
  obj.matrix_world = world
  bpy.context.view_layer.update()


def mesh_centroid_world(obj: bpy.types.Object) -> Vector:
  bpy.context.view_layer.update()
  points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
  return sum(points, Vector()) / max(len(points), 1)


def empty_at(name: str, loc: Vector) -> bpy.types.Object:
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(loc.x, loc.y, loc.z))
  obj = bpy.context.view_layer.objects.active
  obj.name = name
  return obj


def apply_world(obj: bpy.types.Object) -> None:
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  bpy.context.view_layer.objects.active = obj
  if obj.parent is not None:
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def centroid(obj: bpy.types.Object) -> Vector:
  points = [vertex.co for vertex in obj.data.vertices]
  return sum(points, Vector()) / max(len(points), 1)


def extents(obj: bpy.types.Object) -> tuple[float, float, float]:
  points = [vertex.co for vertex in obj.data.vertices]
  xs = [point.x for point in points]
  ys = [point.y for point in points]
  zs = [point.z for point in points]
  return (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))


def join_named(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
  bpy.ops.object.select_all(action='DESELECT')
  for obj in objects:
    obj.select_set(True)
  bpy.context.view_layer.objects.active = objects[0]
  if len(objects) > 1:
    bpy.ops.object.join()
  obj = bpy.context.view_layer.objects.active
  obj.name = name
  return obj


def bake_wheel_to_pivot(wheel: bpy.types.Object, pivot: bpy.types.Object) -> None:
  """Mama-chari wheels are thin on local +X; map axle to Blender +Y for glTF Y-up."""
  bpy.context.view_layer.update()
  bpy.ops.object.select_all(action='DESELECT')
  wheel.select_set(True)
  bpy.context.view_layer.objects.active = wheel
  bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)

  axle_world = (wheel.matrix_world.to_3x3() @ Vector((1.0, 0.0, 0.0))).normalized()
  if wheel.parent is not None:
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  target = Vector((0.0, 1.0, 0.0))
  if axle_world.dot(target) < 0.0:
    axle_world = -axle_world
  if axle_world.angle(target) > math.radians(0.5):
    wheel.data.transform(axle_world.rotation_difference(target).to_matrix().to_4x4())
  center = sum((vertex.co for vertex in wheel.data.vertices), Vector()) / max(
    len(wheel.data.vertices), 1
  )
  wheel.data.transform(Matrix.Translation(-center))
  wheel.data.update()
  wheel.location = (0.0, 0.0, 0.0)
  wheel.rotation_euler = (0.0, 0.0, 0.0)
  wheel.scale = (1.0, 1.0, 1.0)
  wheel.parent = pivot
  wheel.matrix_parent_inverse = Matrix.Identity(4)
  bpy.context.view_layer.update()

  xs = [vertex.co.x for vertex in wheel.data.vertices]
  ys = [vertex.co.y for vertex in wheel.data.vertices]
  zs = [vertex.co.z for vertex in wheel.data.vertices]
  ext = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
  thin = min(range(3), key=lambda index: ext[index])
  print(f'{wheel.name} axle AABB thin={"XYZ"[thin]} ext={tuple(round(value, 3) for value in ext)}')
  if thin != 1:
    raise RuntimeError(f'{wheel.name} expected thin Y after bake, got {"XYZ"[thin]}')


def resolve_source(path: Path) -> Path:
  if path.suffix.lower() == '.zip':
    tmp = Path(tempfile.mkdtemp(prefix='mama-chari-'))
    with zipfile.ZipFile(path) as archive:
      archive.extractall(tmp)
    fbx = next(tmp.rglob('*.fbx'), None)
    glb = next(tmp.rglob('*.glb'), None)
    if fbx:
      return fbx
    if glb:
      return glb
    raise SystemExit(f'no .fbx/.glb inside {path}')
  return path


def import_model(path: Path) -> None:
  suffix = path.suffix.lower()
  if suffix == '.fbx':
    bpy.ops.import_scene.fbx(filepath=str(path))
  elif suffix in {'.glb', '.gltf'}:
    bpy.ops.import_scene.gltf(filepath=str(path))
  else:
    raise SystemExit(f'unsupported source type: {path}')


def yz_circle_stats(obj: bpy.types.Object) -> tuple[float, float, Vector]:
  points = [vertex.co for vertex in obj.data.vertices]
  center = sum(points, Vector()) / max(len(points), 1)
  radii = [((point.y - center.y) ** 2 + (point.z - center.z) ** 2) ** 0.5 for point in points]
  mean = sum(radii) / max(len(radii), 1)
  variance = sum((radius - mean) ** 2 for radius in radii) / max(len(radii), 1)
  return mean, (variance ** 0.5) / max(mean, 1e-6), center


def is_wheel_disc(obj: bpy.types.Object) -> bool:
  """True only for flat circular discs in the YZ plane (axle along X)."""
  dx, dy, dz = extents(obj)
  mean, coeff, _center = yz_circle_stats(obj)
  thin_x = dx < min(dy, dz) * 0.35
  return (
    thin_x
    and mean > 0.02
    and coeff < 0.15
    and len(obj.data.vertices) >= 80
  )


def main() -> None:
  args = parse_args(sys.argv)
  source = resolve_source(Path(args.source).expanduser().resolve())
  out = Path(args.out).expanduser().resolve()
  if not source.exists():
    raise SystemExit(f'source not found: {source}')

  clear_scene()
  import_model(source)

  for obj in list(bpy.context.scene.objects):
    if obj.type in {'LIGHT', 'CAMERA'}:
      bpy.data.objects.remove(obj, do_unlink=True)

  meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
  if len(meshes) < 2:
    raise SystemExit(f'expected body+handle meshes, found {len(meshes)}')

  handle = next((obj for obj in meshes if 'handle' in obj.name.lower()), None)
  body = next((obj for obj in meshes if obj != handle), None)
  if handle is None or body is None:
    raise SystemExit(f'could not find handle/body in {[obj.name for obj in meshes]}')

  apply_world(handle)
  apply_world(body)

  # This mesh only has one true circular disc (rear tyre). The front tyre is
  # welded into the frame; cutting "roundish" mid-frame tubes made them spin
  # and visually split the bike. Leave the front welded; only spin the rear.
  bpy.ops.object.select_all(action='DESELECT')
  body.select_set(True)
  bpy.context.view_layer.objects.active = body
  bpy.ops.mesh.separate(type='LOOSE')

  parts = [
    obj
    for obj in bpy.context.scene.objects
    if obj.type == 'MESH' and obj != handle
  ]

  baby_parts: list[bpy.types.Object] = []
  rear_wheel_parts: list[bpy.types.Object] = []
  body_parts: list[bpy.types.Object] = []

  for part in parts:
    center = centroid(part)
    zmax = max(vertex.co.z for vertex in part.data.vertices)
    if center.y < -0.055 and zmax > 0.08:
      baby_parts.append(part)
    elif is_wheel_disc(part) and center.y < 0.0:
      rear_wheel_parts.append(part)
    else:
      body_parts.append(part)

  print(
    'classified',
    f'baby={len(baby_parts)}',
    f'rear_wheel={len(rear_wheel_parts)}',
    f'body={len(body_parts)}',
  )
  if not baby_parts:
    raise SystemExit('no baby-seat loose parts found')
  if len(rear_wheel_parts) != 1:
    raise SystemExit(f'expected exactly one rear wheel disc, got {len(rear_wheel_parts)}')

  baby = join_named('BabySeat', baby_parts)
  rear_wheel = join_named('back_wheelset', rear_wheel_parts)
  frame = join_named('MamaChariBody', body_parts)
  handle.name = 'handle'

  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
  root = bpy.context.view_layer.objects.active
  root.name = 'MamaChari'
  for obj in (frame, handle, baby, rear_wheel):
    reparent_keep(obj, root)

  # Source faces +Y; rotate so forward is +X like omafiets.
  root.rotation_euler[2] = math.radians(-90)
  bpy.context.view_layer.update()
  bpy.ops.object.select_all(action='DESELECT')
  root.select_set(True)
  bpy.context.view_layer.objects.active = root
  bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

  # Recompute hubs after the +X facing bake.
  rear_hub = mesh_centroid_world(rear_wheel)
  steer_loc = mesh_centroid_world(handle)
  front_hub = mesh_centroid_world(frame)
  # Front hub: furthest +X low point cluster on the body.
  frame_pts = [frame.matrix_world @ vertex.co for vertex in frame.data.vertices]
  front_band = [
    point for point in frame_pts
    if point.x > max(p.x for p in frame_pts) - 0.04 and point.z < 0.05
  ]
  if front_band:
    front_hub = Vector((
      sum(p.x for p in front_band) / len(front_band),
      0.0,
      sum(p.z for p in front_band) / len(front_band),
    ))
  print(
    'hubs',
    tuple(round(c, 3) for c in front_hub),
    tuple(round(c, 3) for c in rear_hub),
    tuple(round(c, 3) for c in steer_loc),
  )

  lenker = empty_at('Lenker', steer_loc)
  rad_v = empty_at('RadVorn', front_hub)
  rad_h = empty_at('RadHinten', rear_hub)
  reparent_keep(lenker, root)
  reparent_keep(rad_h, root)
  reparent_keep(rad_v, lenker)
  reparent_keep(handle, lenker)
  reparent_keep(baby, root)
  # No mesh under RadVorn — front tyre stays welded on MamaChariBody.
  bake_wheel_to_pivot(rear_wheel, rad_h)

  points: list[Vector] = []
  for mesh in bpy.context.scene.objects:
    if mesh.type != 'MESH':
      continue
    points.extend(mesh.matrix_world @ vertex.co for vertex in mesh.data.vertices)
  lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
  hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
  root.location -= Vector(((lo.x + hi.x) * 0.5, (lo.y + hi.y) * 0.5, lo.z))
  bpy.context.view_layer.update()

  out.parent.mkdir(parents=True, exist_ok=True)
  bpy.ops.object.select_all(action='SELECT')
  bpy.ops.export_scene.gltf(
    filepath=str(out),
    export_format='GLB',
    use_selection=True,
    export_apply=False,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
    export_skins=False,
    export_animations=False,
  )
  print(f'wrote {out}')
  print(f'Lenker={tuple(round(c, 3) for c in world_loc(lenker))}')
  print(f'RadVorn={tuple(round(c, 3) for c in world_loc(rad_v))}')
  print(f'RadHinten={tuple(round(c, 3) for c in world_loc(rad_h))}')
  print(f'BabySeat={tuple(round(c, 3) for c in world_loc(baby))}')


if __name__ == '__main__':
  main()
