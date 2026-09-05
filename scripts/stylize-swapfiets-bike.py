#!/usr/bin/env python3
"""Build a game-ready Swapfiets GLB: level, grounded, with steer/wheel parts.

  blender --background --python scripts/stylize-swapfiets-bike.py -- \\
    --source=~/Downloads/swapfiets.glb \\
    --out=/tmp/swapfiets-stylized.glb

The chase layer expects a Y-up glTF whose length is +X (blue tyre forward),
wheels on the ground plane (min Y = 0), and named parts:

  Lenker     — steer assembly (fork + bars + front wheel), rotates about +Y
  RadVorn    — front wheel, rolls about +Z
  RadHinten  — rear wheel, rolls about +Z

Those German names match the previous carbon-bike binding in
`player-vehicles-source.js`.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bmesh
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


def import_and_join(source: Path) -> bpy.types.Object:
  bpy.ops.import_scene.gltf(filepath=str(source))
  meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
  if not meshes:
    raise RuntimeError(f'No meshes in {source}')

  # Bake the Sketchfab Y-up → Blender Z-up parent so later math is in world space.
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
  bike = bpy.context.view_layer.objects.active
  bike.name = 'SwapfietsBody'
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  return bike


def world_points(obj: bpy.types.Object) -> list[Vector]:
  matrix = obj.matrix_world
  return [matrix @ vertex.co for vertex in obj.data.vertices]


def align_level(obj: bpy.types.Object) -> None:
  """Rotate so length is +X, up is +Z, and both wheel contacts share the same Z."""
  points = world_points(obj)
  xs = [point.x for point in points]
  x_min, x_max = min(xs), max(xs)
  x_span = max(1e-6, x_max - x_min)

  # Ground band: lowest 3% by Z.
  points_by_z = sorted(points, key=lambda point: point.z)
  band = points_by_z[: max(20, len(points_by_z) // 30)]
  front = [point for point in band if point.x > (x_min + x_max) * 0.5]
  rear = [point for point in band if point.x <= (x_min + x_max) * 0.5]
  if len(front) < 5 or len(rear) < 5:
    # Fallback: extreme X ends in the low band.
    front = sorted(band, key=lambda point: point.x)[-max(5, len(band) // 4) :]
    rear = sorted(band, key=lambda point: point.x)[: max(5, len(band) // 4)]

  front_contact = sum(front, Vector()) / len(front)
  rear_contact = sum(rear, Vector()) / len(rear)

  # Blue tyre is the +X end of this asset; keep that as forward.
  forward = front_contact - rear_contact
  forward.z = 0.0
  if forward.length < 1e-4:
    forward = Vector((1.0, 0.0, 0.0))
  else:
    forward.normalize()

  # Yaw onto +X.
  yaw = math.atan2(forward.y, forward.x)
  obj.rotation_euler[2] -= yaw
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  bpy.context.view_layer.objects.active = obj
  bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

  # Pitch so front/rear contacts match in Z (kill nose-dive in the mesh).
  points = world_points(obj)
  xs = [point.x for point in points]
  x_min, x_max = min(xs), max(xs)
  points_by_z = sorted(points, key=lambda point: point.z)
  band = points_by_z[: max(20, len(points_by_z) // 30)]
  front = [point for point in band if point.x > (x_min + x_max) * 0.5]
  rear = [point for point in band if point.x <= (x_min + x_max) * 0.5]
  front_contact = sum(front, Vector()) / len(front)
  rear_contact = sum(rear, Vector()) / len(rear)
  run = front_contact.x - rear_contact.x
  rise = front_contact.z - rear_contact.z
  if abs(run) > 1e-4:
    pitch = math.atan2(rise, run)
    obj.rotation_euler[1] += pitch
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

  # Roll so the bike isn't leaning left/right: mean Y of ground band → 0.
  points = world_points(obj)
  points_by_z = sorted(points, key=lambda point: point.z)
  band = points_by_z[: max(20, len(points_by_z) // 30)]
  mean_y = sum(point.y for point in band) / len(band)
  # Small roll about X using the lean of the contact patch.
  left = [point for point in band if point.y < mean_y]
  right = [point for point in band if point.y >= mean_y]
  if left and right:
    left_z = sum(point.z for point in left) / len(left)
    right_z = sum(point.z for point in right) / len(right)
    width = (sum(point.y for point in right) / len(right)) - (
      sum(point.y for point in left) / len(left)
    )
    if abs(width) > 1e-4:
      roll = math.atan2(right_z - left_z, width)
      obj.rotation_euler[0] -= roll
      bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)


def ground_and_center(obj: bpy.types.Object) -> None:
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  bpy.context.view_layer.objects.active = obj
  bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

  points = world_points(obj)
  min_corner = Vector((
    min(point.x for point in points),
    min(point.y for point in points),
    min(point.z for point in points),
  ))
  max_corner = Vector((
    max(point.x for point in points),
    max(point.y for point in points),
    max(point.z for point in points),
  ))
  obj.location -= Vector((
    (min_corner.x + max_corner.x) * 0.5,
    (min_corner.y + max_corner.y) * 0.5,
    min_corner.z,
  ))
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def chalk_materials(obj: bpy.types.Object) -> None:
  for slot in obj.material_slots:
    material = slot.material
    if not material:
      continue
    # Sketchfab bike tubes are open shells; single-sided culling reads as holes.
    material.use_backface_culling = False
    if hasattr(material, 'show_transparent_back'):
      material.show_transparent_back = True
    if not material.use_nodes:
      continue
    principled = next(
      (node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'),
      None,
    )
    if not principled:
      continue
    if 'Roughness' in principled.inputs:
      principled.inputs['Roughness'].default_value = max(
        float(principled.inputs['Roughness'].default_value),
        0.68,
      )
    if 'Metallic' in principled.inputs:
      principled.inputs['Metallic'].default_value = min(
        float(principled.inputs['Metallic'].default_value),
        0.08,
      )
    material.blend_method = 'OPAQUE'


def wheel_centers(obj: bpy.types.Object) -> tuple[Vector, Vector, float]:
  points = world_points(obj)
  z_min = min(point.z for point in points)
  height = max(point.z for point in points) - z_min
  # Wheel axles sit near one wheel radius above the ground.
  axle_band = [
    point
    for point in points
    if z_min + height * 0.15 < point.z < z_min + height * 0.55
  ]
  xs = [point.x for point in axle_band] or [point.x for point in points]
  x_min, x_max = min(xs), max(xs)
  front_pts = [point for point in axle_band if point.x > (x_min + x_max) * 0.55]
  rear_pts = [point for point in axle_band if point.x < (x_min + x_max) * 0.45]
  if len(front_pts) < 10:
    front_pts = sorted(points, key=lambda point: point.x)[-len(points) // 5 :]
  if len(rear_pts) < 10:
    rear_pts = sorted(points, key=lambda point: point.x)[: len(points) // 5]
  front = sum(front_pts, Vector()) / len(front_pts)
  rear = sum(rear_pts, Vector()) / len(rear_pts)
  # Radius ≈ height of axle above ground.
  radius = max(8.0, (front.z + rear.z) * 0.5 - z_min)
  front = Vector((front.x, 0.0, z_min + radius))
  rear = Vector((rear.x, 0.0, z_min + radius))
  return front, rear, radius


def separate_by_predicate(
  obj: bpy.types.Object,
  name: str,
  predicate,
) -> bpy.types.Object | None:
  """Duplicate obj and delete verts that fail predicate; remove those verts from obj."""
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  bpy.context.view_layer.objects.active = obj

  # Work on a copy for the extracted part.
  part = obj.copy()
  part.data = obj.data.copy()
  part.name = name
  bpy.context.collection.objects.link(part)

  def delete_failing(target: bpy.types.Object, keep) -> int:
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.mode_set(mode='EDIT')
    mesh = bmesh.from_edit_mesh(target.data)
    matrix = target.matrix_world
    doomed = [vertex for vertex in mesh.verts if not keep(matrix @ vertex.co)]
    kept = len(mesh.verts) - len(doomed)
    if doomed:
      bmesh.ops.delete(mesh, geom=doomed, context='VERTS')
      bmesh.update_edit_mesh(target.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    return kept

  kept_part = delete_failing(part, predicate)
  kept_body = delete_failing(obj, lambda point: not predicate(point))
  if kept_part < 30:
    bpy.data.objects.remove(part, do_unlink=True)
    return None
  print(f'  separated {name}: {kept_part} verts (body now {kept_body})')
  return part


def set_origin_geometry(obj: bpy.types.Object) -> None:
  """Pivot at the extracted mesh bounds centre (hub), not the whole-bike origin."""
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  bpy.context.view_layer.objects.active = obj
  bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')


def make_hub_pivot(name: str, hub: Vector, mesh: bpy.types.Object) -> bpy.types.Object:
  """Named spin node at the hub; mesh is a child so rotation is about the axle centre.

  Bounds-origin on a partial tyre annulus is still biased, so the game must
  rotate an empty at the measured hub rather than the mesh node itself.
  """
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=hub)
  pivot = bpy.context.view_layer.objects.active
  pivot.name = name
  mesh.name = f'{name}Mesh'
  set_origin_geometry(mesh)
  mesh.parent = pivot
  mesh.matrix_parent_inverse = pivot.matrix_world.inverted()
  return pivot


def build_rig(body: bpy.types.Object) -> bpy.types.Object:
  front, rear, radius = wheel_centers(body)
  print(
    f'wheel centers front={tuple(round(c, 2) for c in front)} '
    f'rear={tuple(round(c, 2) for c in rear)} radius={radius:.1f}'
  )

  def in_tire(center: Vector, point: Vector) -> bool:
    """Tyre + rim annulus in the wheel plane (X/Z), thin along the axle (Y).

    Earlier builds sliced on X (bike length) by mistake — that kept a vertical
    strip of tyre whose spin looked like the bike exploding. Fork/fender sit
    near the hub radially, so the annulus also keeps them off the spinner.
    """
    if abs(point.y - center.y) > radius * 0.16:
      return False
    radial = math.hypot(point.x - center.x, point.z - center.z)
    return radius * 0.68 <= radial <= radius * 1.08

  front_mesh = separate_by_predicate(
    body, 'RadVornMesh', lambda point: in_tire(front, point)
  )
  rear_mesh = separate_by_predicate(
    body, 'RadHintenMesh', lambda point: in_tire(rear, point)
  )
  front_wheel = make_hub_pivot('RadVorn', front, front_mesh) if front_mesh else None
  rear_wheel = make_hub_pivot('RadHinten', rear, rear_mesh) if rear_mesh else None

  # Handlebars / stem: high and forward of the seat tube.
  z_min = min(point.z for point in world_points(body))
  z_max = max(point.z for point in world_points(body))
  head_x = front.x - radius * 0.15

  def is_bars(point: Vector) -> bool:
    return point.z > z_min + (z_max - z_min) * 0.62 and point.x > head_x - radius * 0.8

  bars = separate_by_predicate(body, 'LenkerBars', is_bars)

  # Steer empty at the head tube, vertical +Z in Blender (becomes +Y after yup export).
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(head_x, 0.0, front.z + radius * 0.6))
  steer = bpy.context.view_layer.objects.active
  steer.name = 'Lenker'

  for child in (front_wheel, bars):
    if child is None:
      continue
    child.parent = steer
    child.matrix_parent_inverse = steer.matrix_world.inverted()

  if rear_wheel is not None:
    rear_wheel.parent = None

  # Root empty keeps a stable export hierarchy.
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, 0.0))
  root = bpy.context.view_layer.objects.active
  root.name = 'Swapfiets'

  for child in (body, steer, rear_wheel):
    if child is None:
      continue
    child.parent = root
    child.matrix_parent_inverse = root.matrix_world.inverted()

  return root


def chalk_all() -> None:
  for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
      chalk_materials(obj)


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
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_yup=True,
  )


def report(root: bpy.types.Object) -> None:
  names = []

  def walk(obj: bpy.types.Object, depth: int = 0) -> None:
    names.append(('  ' * depth) + obj.name + (f' mesh={len(obj.data.polygons)}f' if obj.type == 'MESH' else ''))
    for child in obj.children:
      walk(child, depth + 1)

  walk(root)
  print('hierarchy:')
  for line in names:
    print(' ', line)


def main() -> None:
  args = parse_args(sys.argv)
  source = Path(args.source).expanduser().resolve()
  out = Path(args.out).expanduser().resolve()
  if not source.exists():
    raise SystemExit(f'source not found: {source}')

  clear_scene()
  body = import_and_join(source)
  align_level(body)
  ground_and_center(body)
  chalk_materials(body)
  root = build_rig(body)
  chalk_all()
  report(root)
  export_glb(root, out)
  print(f'wrote {out}')


if __name__ == '__main__':
  main()
