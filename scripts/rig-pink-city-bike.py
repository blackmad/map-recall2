#!/usr/bin/env python3
"""Rig Kin Chen's CC0 pink city bicycle for Canal Recall pivots.

  blender --background --python scripts/rig-pink-city-bike.py -- \\
    --source=~/Downloads/free-bikes/pink-city-bicycle.glb \\
    --out=public/canal-drive/pink-city-bicycle-runtime.glb

Source: MorfVision / BlenderKit “Pink city bicycle” (CC0). Already has separate
handle / front_wheelset / back_wheelset — face +X and add Lenker / RadVorn /
RadHinten empties matching the authored omafiets.
"""

from __future__ import annotations

import argparse
import math
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


def empty_at(name: str, loc: Vector) -> bpy.types.Object:
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(loc.x, 0.0, loc.z))
  obj = bpy.context.view_layer.objects.active
  obj.name = name
  return obj


def bake_wheel_to_pivot(wheel: bpy.types.Object, pivot: bpy.types.Object) -> None:
  """Parent wheel under pivot with identity transform and axle on local +Y.

  Kin Chen's wheels are authored with the axle on local +X. Game spin is about
  +Z after glTF Y-up export; Blender lateral +Y becomes that.
  """
  bpy.context.view_layer.update()
  bpy.ops.object.select_all(action='DESELECT')
  wheel.select_set(True)
  bpy.context.view_layer.objects.active = wheel
  bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)

  # Source mesh axle is local +X — carry that into world before baking transforms.
  axle_world = (wheel.matrix_world.to_3x3() @ Vector((1.0, 0.0, 0.0))).normalized()
  if wheel.parent is not None:
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  target = Vector((0.0, 1.0, 0.0))
  if axle_world.dot(target) < 0.0:
    axle_world = -axle_world
  angle = axle_world.angle(target)
  if angle > math.radians(0.5):
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

  # Confirm via AABB (authored discs are clean enough once +X is mapped to +Y).
  xs = [vertex.co.x for vertex in wheel.data.vertices]
  ys = [vertex.co.y for vertex in wheel.data.vertices]
  zs = [vertex.co.z for vertex in wheel.data.vertices]
  ext = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
  thin = min(range(3), key=lambda index: ext[index])
  print(
    f'{wheel.name} axle→Y rotated={math.degrees(angle):.1f}° '
    f'AABB thin={"XYZ"[thin]} ext={tuple(round(value, 3) for value in ext)}'
  )
  if thin != 1:
    raise RuntimeError(f'{wheel.name} expected thin Y after bake, got {"XYZ"[thin]}')


def main() -> None:
  args = parse_args(sys.argv)
  source = Path(args.source).expanduser().resolve()
  out = Path(args.out).expanduser().resolve()
  if not source.exists():
    raise SystemExit(f'source not found: {source}')

  clear_scene()
  bpy.ops.import_scene.gltf(filepath=str(source))

  for obj in list(bpy.context.scene.objects):
    if obj.type in {'LIGHT', 'CAMERA'} or obj.name == 'Icosphere':
      bpy.data.objects.remove(obj, do_unlink=True)

  handle = bpy.data.objects['handle']
  front_wheel = bpy.data.objects['front_wheelset']
  rear_wheel = bpy.data.objects['back_wheelset']

  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
  root = bpy.context.view_layer.objects.active
  root.name = 'PinkCityBike'
  tops = [obj for obj in bpy.context.scene.objects if obj.parent is None and obj != root]
  for obj in tops:
    reparent_keep(obj, root)

  # Source faces −Y; rotate so forward is +X like omafiets.
  root.rotation_euler[2] = math.radians(90)
  bpy.context.view_layer.update()
  bpy.ops.object.select_all(action='DESELECT')
  root.select_set(True)
  bpy.context.view_layer.objects.active = root
  bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

  front_hub = world_loc(front_wheel)
  rear_hub = world_loc(rear_wheel)
  steer_loc = world_loc(handle)
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
  bake_wheel_to_pivot(front_wheel, rad_v)
  bake_wheel_to_pivot(rear_wheel, rad_h)

  # Chase altitude does not need chain links / armature density.
  for mesh in [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']:
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    if len(mesh.data.polygons) < 400:
      continue
    bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)
    mod = mesh.modifiers.new(name='ChaseDecimate', type='DECIMATE')
    ratio = min(1.0, max(0.04, 9000 / max(len(mesh.data.polygons), 1)))
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)

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


if __name__ == '__main__':
  main()
