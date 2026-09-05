#!/usr/bin/env python3
"""Author a chase-readable low-poly Dutch omafiets.

  blender --background --python scripts/build-omafiets-bike.py -- \\
    --out=public/canal-drive/omafiets-runtime.glb

Every mesh is baked into its pivot's local space with an identity local
transform. That way Three.js / MapLibre can steer and spin without the
parts flying apart. Named pivots:

  Lenker / RadVorn / RadHinten
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


WHEEL_R = 0.35
TIRE_T = 0.05
HUB_R = 0.045
AXLE_HALF = 0.09  # fork/stay dropout spacing (outside the tyre sidewalls)
TUBE_R = 0.036
DROPOUT_R = 0.022

FRAME = (0.62, 0.14, 0.12, 1.0)
DARK = (0.10, 0.10, 0.11, 1.0)
BLUE = (0.12, 0.42, 0.88, 1.0)
BLACK = (0.07, 0.07, 0.08, 1.0)
RIM = (0.78, 0.78, 0.80, 1.0)
SEAT = (0.04, 0.04, 0.04, 1.0)

REAR_HUB = Vector((-0.55, 0.0, WHEEL_R))
FRONT_HUB = Vector((0.62, 0.0, WHEEL_R))
BB = Vector((0.06, 0.0, WHEEL_R * 0.52))
SEAT_J = Vector((-0.20, 0.0, 0.80))
HEAD = Vector((0.44, 0.0, 0.84))
BARS = Vector((0.40, 0.0, 1.08))


def side(hub: Vector, sign: float) -> Vector:
  """Dropout point on the left (−) or right (+) of a hub."""
  return hub + Vector((0.0, sign * AXLE_HALF, 0.0))


def parse_args(argv: list[str]) -> argparse.Namespace:
  if '--' in argv:
    argv = argv[argv.index('--') + 1 :]
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--out', required=True)
  return parser.parse_args(argv)


def clear_scene() -> None:
  bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
  material = bpy.data.materials.new(name=name)
  material.use_nodes = True
  material.use_backface_culling = False
  if hasattr(material, 'blend_method'):
    material.blend_method = 'OPAQUE'
  node = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
  node.inputs['Base Color'].default_value = color
  node.inputs['Roughness'].default_value = 0.75
  if 'Metallic' in node.inputs:
    node.inputs['Metallic'].default_value = 0.04
  return material


def paint(obj: bpy.types.Object, material: bpy.types.Material) -> bpy.types.Object:
  if obj.data.materials:
    obj.data.materials[0] = material
  else:
    obj.data.materials.append(material)
  return obj


def empty(name: str, location: Vector) -> bpy.types.Object:
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=location)
  obj = bpy.context.view_layer.objects.active
  obj.name = name
  obj.empty_display_size = 0.05
  return obj


def update() -> None:
  bpy.context.view_layer.update()


def bind_mesh(obj: bpy.types.Object, parent_obj: bpy.types.Object) -> None:
  """Bake mesh into parent-local space; object local xform becomes identity."""
  update()
  world = obj.matrix_world.copy()
  obj.data.transform(world)
  obj.matrix_world = Matrix.Identity(4)
  update()
  obj.data.transform(parent_obj.matrix_world.inverted())
  obj.data.update()
  obj.parent = parent_obj
  obj.matrix_parent_inverse = Matrix.Identity(4)
  obj.location = (0.0, 0.0, 0.0)
  obj.rotation_euler = (0.0, 0.0, 0.0)
  obj.scale = (1.0, 1.0, 1.0)
  update()


def bind_empty(obj: bpy.types.Object, parent_obj: bpy.types.Object) -> None:
  update()
  world = obj.matrix_world.copy()
  obj.parent = parent_obj
  obj.matrix_parent_inverse = Matrix.Identity(4)
  obj.matrix_world = world
  update()


def cylinder(p0: Vector, p1: Vector, radius: float, segments: int = 12) -> bpy.types.Object:
  direction = p1 - p0
  length = max(direction.length, 1e-5)
  mid = (p0 + p1) * 0.5
  bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius, depth=length, location=mid)
  obj = bpy.context.view_layer.objects.active
  obj.rotation_mode = 'QUATERNION'
  obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
  bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
  return obj


def torus(center: Vector, major: float, minor: float, major_seg: int = 32, minor_seg: int = 12) -> bpy.types.Object:
  bpy.ops.mesh.primitive_torus_add(
    major_segments=major_seg,
    minor_segments=minor_seg,
    major_radius=major,
    minor_radius=minor,
    location=center,
    rotation=(math.radians(90), 0, 0),
  )
  obj = bpy.context.view_layer.objects.active
  bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
  return obj


def box(center: Vector, size: Vector) -> bpy.types.Object:
  bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
  obj = bpy.context.view_layer.objects.active
  obj.scale = size
  bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
  return obj


def join(name: str, objects: list[bpy.types.Object], material: bpy.types.Material) -> bpy.types.Object:
  bpy.ops.object.select_all(action='DESELECT')
  for obj in objects:
    obj.select_set(True)
  bpy.context.view_layer.objects.active = objects[0]
  bpy.ops.object.join()
  obj = bpy.context.view_layer.objects.active
  obj.name = name
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  return paint(obj, material)


def build_wheel(hub: Vector, tire_mat, rim_mat, prefix: str) -> tuple[bpy.types.Object, bpy.types.Object]:
  tire = paint(torus(hub, WHEEL_R - TIRE_T * 0.35, TIRE_T, 36, 12), tire_mat)
  tire.name = f'{prefix}Tire'
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  # Solid hub + rim + spokes that meet the hub drum.
  parts = [
    paint(torus(hub, WHEEL_R - TIRE_T * 1.25, TIRE_T * 0.38, 32, 10), rim_mat),
    paint(cylinder(hub + Vector((0, -0.03, 0)), hub + Vector((0, 0.03, 0)), HUB_R, 14), rim_mat),
  ]
  for angle in (0, math.pi / 3, 2 * math.pi / 3, math.pi, 4 * math.pi / 3, 5 * math.pi / 3):
    radial = Vector((math.cos(angle), 0, math.sin(angle)))
    parts.append(
      paint(
        cylinder(hub + radial * (HUB_R * 0.4), hub + radial * (WHEEL_R - TIRE_T * 1.35), 0.011, 8),
        rim_mat,
      )
    )
  rim = join(f'{prefix}Rim', parts, rim_mat)
  return tire, rim


def build_bike() -> bpy.types.Object:
  mats = {
    'frame': mat('OmaFrame', FRAME),
    'dark': mat('OmaDark', DARK),
    'blue': mat('OmaBlue', BLUE),
    'black': mat('OmaBlack', BLACK),
    'rim': mat('OmaRim', RIM),
    'seat': mat('OmaSeat', SEAT),
  }

  root = empty('Omafiets', Vector((0, 0, 0)))
  steer = empty('Lenker', HEAD)
  front = empty('RadVorn', FRONT_HUB)
  rear = empty('RadHinten', REAR_HUB)

  ft, fr = build_wheel(FRONT_HUB, mats['blue'], mats['rim'], 'Front')
  rt, rr = build_wheel(REAR_HUB, mats['black'], mats['rim'], 'Rear')
  for part in (ft, fr):
    bind_mesh(part, front)
  for part in (rt, rr):
    bind_mesh(part, rear)

  # Omafiets = step-through: no diamond top tube. A deep dropped rail (and a
  # twin mixte rail) leave a clear gap under the rider to swing a leg through.
  rear_l, rear_r = side(REAR_HUB, -1), side(REAR_HUB, 1)
  bb_l, bb_r = BB + Vector((0, -0.03, 0)), BB + Vector((0, 0.03, 0))
  seat_mid = SEAT_J + Vector((0.02, 0.0, -0.32))          # ~mid seat tube
  step_low = Vector((0.14, 0.0, 0.34))                     # lowest point of step-through
  head_low = HEAD + Vector((-0.02, 0.0, -0.30))            # joins head below the stem
  frame = join(
    'Frame',
    [
      paint(cylinder(rear_l, bb_l, TUBE_R), mats['frame']),
      paint(cylinder(rear_r, bb_r, TUBE_R), mats['frame']),
      paint(cylinder(rear_l, SEAT_J + Vector((0, -0.02, 0)), TUBE_R * 0.95), mats['frame']),
      paint(cylinder(rear_r, SEAT_J + Vector((0, 0.02, 0)), TUBE_R * 0.95), mats['frame']),
      paint(cylinder(BB, SEAT_J, TUBE_R * 1.05), mats['frame']),
      paint(cylinder(BB, HEAD, TUBE_R * 1.1), mats['frame']),
      # Step-through rails (left + right) instead of a high top tube.
      paint(cylinder(seat_mid + Vector((0, -0.025, 0)), step_low + Vector((0, -0.03, 0)), TUBE_R * 0.9), mats['frame']),
      paint(cylinder(step_low + Vector((0, -0.03, 0)), head_low + Vector((0, -0.02, 0)), TUBE_R * 0.9), mats['frame']),
      paint(cylinder(seat_mid + Vector((0, 0.025, 0)), step_low + Vector((0, 0.03, 0)), TUBE_R * 0.9), mats['frame']),
      paint(cylinder(step_low + Vector((0, 0.03, 0)), head_low + Vector((0, 0.02, 0)), TUBE_R * 0.9), mats['frame']),
      paint(cylinder(HEAD + Vector((0, 0, -0.14)), HEAD + Vector((0, 0, 0.06)), TUBE_R * 1.15), mats['frame']),
      paint(cylinder(rear_l, rear_r, DROPOUT_R, 10), mats['frame']),
    ],
    mats['frame'],
  )
  bind_mesh(frame, root)

  seat = join(
    'Seat',
    [
      paint(cylinder(SEAT_J, SEAT_J + Vector((-0.02, 0, 0.08)), TUBE_R * 0.7, 10), mats['dark']),
      paint(box(SEAT_J + Vector((-0.02, 0, 0.11)), Vector((0.24, 0.16, 0.05))), mats['seat']),
    ],
    mats['seat'],
  )
  bind_mesh(seat, root)

  crank = join(
    'Crank',
    [
      paint(cylinder(BB + Vector((0, -0.14, 0)), BB + Vector((0, 0.14, 0)), 0.028, 12), mats['dark']),
      paint(cylinder(BB, BB + Vector((0.14, -0.14, -0.04)), 0.016, 8), mats['dark']),
      paint(cylinder(BB, BB + Vector((-0.14, 0.14, -0.04)), 0.016, 8), mats['dark']),
      paint(box(BB + Vector((0.14, -0.18, -0.04)), Vector((0.1, 0.045, 0.025))), mats['dark']),
      paint(box(BB + Vector((-0.14, 0.18, -0.04)), Vector((0.1, 0.045, 0.025))), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(crank, root)

  front_l, front_r = side(FRONT_HUB, -1), side(FRONT_HUB, 1)
  fork = join(
    'Fork',
    [
      # Blades run past the hub centre so the dropout read as seated in the wheel.
      paint(cylinder(HEAD, front_l + Vector((0.01, 0, -0.02)), TUBE_R * 0.95), mats['frame']),
      paint(cylinder(HEAD, front_r + Vector((0.01, 0, -0.02)), TUBE_R * 0.95), mats['frame']),
      paint(cylinder(front_l, front_r, DROPOUT_R * 1.15, 12), mats['frame']),
      paint(cylinder(HEAD + Vector((0, -0.045, -0.02)), HEAD + Vector((0, 0.045, -0.02)), TUBE_R * 1.1, 10), mats['frame']),
    ],
    mats['frame'],
  )
  bind_mesh(fork, steer)

  bars = join(
    'LenkerBars',
    [
      paint(cylinder(HEAD, BARS, TUBE_R * 0.8, 10), mats['dark']),
      paint(cylinder(BARS + Vector((0.02, -0.32, 0.02)), BARS + Vector((0.02, 0.32, 0.02)), TUBE_R * 0.85, 10), mats['dark']),
      paint(cylinder(BARS + Vector((0.02, -0.32, 0.02)), BARS + Vector((0.08, -0.38, 0.08)), TUBE_R, 10), mats['dark']),
      paint(cylinder(BARS + Vector((0.02, 0.32, 0.02)), BARS + Vector((0.08, 0.38, 0.08)), TUBE_R, 10), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(bars, steer)

  rack_top = HEAD + Vector((0.16, 0, 0.02))
  rack = join(
    'FrontRack',
    [
      paint(cylinder(HEAD + Vector((0.02, 0, -0.02)), rack_top, 0.012, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0, -0.12, 0)), rack_top + Vector((0, 0.12, 0)), 0.012, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0.1, -0.12, 0)), rack_top + Vector((0.1, 0.12, 0)), 0.012, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0, -0.12, 0)), rack_top + Vector((0.1, -0.12, 0)), 0.012, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0, 0.12, 0)), rack_top + Vector((0.1, 0.12, 0)), 0.012, 8), mats['dark']),
      # Stays land on the dropouts, not floating above the tyre.
      paint(cylinder(front_l, rack_top + Vector((0, -0.12, 0)), 0.011, 6), mats['dark']),
      paint(cylinder(front_r, rack_top + Vector((0, 0.12, 0)), 0.011, 6), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(rack, steer)

  bind_empty(front, steer)
  bind_empty(rear, root)
  bind_empty(steer, root)
  return root


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
    export_texcoords=False,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
  )


def report(root: bpy.types.Object) -> None:
  def walk(obj: bpy.types.Object, depth: int = 0) -> None:
    tag = f' mesh={len(obj.data.polygons)}f' if obj.type == 'MESH' else ''
    print('  ' * depth + obj.name + tag)
    for child in obj.children:
      walk(child, depth + 1)

  print('hierarchy:')
  walk(root)


def main() -> None:
  args = parse_args(sys.argv)
  out = Path(args.out).expanduser().resolve()
  clear_scene()
  root = build_bike()
  report(root)
  export_glb(root, out)
  print(f'wrote {out}')


if __name__ == '__main__':
  main()
