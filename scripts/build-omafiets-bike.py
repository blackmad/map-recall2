#!/usr/bin/env python3
"""Author a chase-readable low-poly Dutch omafiets / Swapfiets-alike.

  blender --background --python scripts/build-omafiets-bike.py -- \\
    --out=public/canal-drive/omafiets-runtime.glb

Named pivots (mesh baked into parent-local space):

  Lenker / RadVorn / RadHinten
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


WHEEL_R = 0.355
TIRE_T = 0.042
HUB_R = 0.048
AXLE_HALF = 0.095
TUBE_R = 0.042
DROPOUT_R = 0.024

# Classic dark-green Dutch roadster — red+blue is reserved for the Swapfiets skin.
FRAME = (0.12, 0.28, 0.20, 1.0)
DARK = (0.09, 0.09, 0.10, 1.0)
BLACK = (0.06, 0.06, 0.07, 1.0)
RIM = (0.82, 0.82, 0.84, 1.0)
SEAT = (0.05, 0.05, 0.05, 1.0)
CHROME = (0.7, 0.72, 0.75, 1.0)

REAR_HUB = Vector((-0.58, 0.0, WHEEL_R))
FRONT_HUB = Vector((0.64, 0.0, WHEEL_R))
BB = Vector((0.04, 0.0, WHEEL_R * 0.50))
SEAT_J = Vector((-0.22, 0.0, 0.82))
HEAD = Vector((0.46, 0.0, 0.86))
BARS = Vector((0.40, 0.0, 1.12))


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
  node.inputs['Roughness'].default_value = 0.7
  if 'Metallic' in node.inputs:
    node.inputs['Metallic'].default_value = 0.06
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


def side(hub: Vector, sign: float) -> Vector:
  return hub + Vector((0.0, sign * AXLE_HALF, 0.0))


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


def torus(center: Vector, major: float, minor: float, major_seg: int = 36, minor_seg: int = 12) -> bpy.types.Object:
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


def arc_tubes(
  center: Vector,
  radius: float,
  tube_r: float,
  start_deg: float,
  end_deg: float,
  steps: int,
  material: bpy.types.Material,
) -> list[bpy.types.Object]:
  """Polyline of cylinders along a circle in the XZ plane (bike side view)."""
  parts: list[bpy.types.Object] = []
  for i in range(steps):
    t0 = math.radians(start_deg + (end_deg - start_deg) * i / steps)
    t1 = math.radians(start_deg + (end_deg - start_deg) * (i + 1) / steps)
    p0 = center + Vector((math.cos(t0) * radius, 0.0, math.sin(t0) * radius))
    p1 = center + Vector((math.cos(t1) * radius, 0.0, math.sin(t1) * radius))
    parts.append(paint(cylinder(p0, p1, tube_r, 8), material))
  return parts


def build_wheel(hub: Vector, tire_mat, rim_mat, prefix: str) -> tuple[bpy.types.Object, bpy.types.Object]:
  tire = paint(torus(hub, WHEEL_R - TIRE_T * 0.3, TIRE_T, 40, 12), tire_mat)
  tire.name = f'{prefix}Tire'
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  parts = [
    paint(torus(hub, WHEEL_R - TIRE_T * 1.2, TIRE_T * 0.36, 36, 10), rim_mat),
    paint(cylinder(hub + Vector((0, -0.035, 0)), hub + Vector((0, 0.035, 0)), HUB_R, 14), rim_mat),
  ]
  for i in range(8):
    angle = i * math.pi / 4
    radial = Vector((math.cos(angle), 0, math.sin(angle)))
    parts.append(
      paint(
        cylinder(hub + radial * (HUB_R * 0.35), hub + radial * (WHEEL_R - TIRE_T * 1.35), 0.01, 6),
        rim_mat,
      )
    )
  rim = join(f'{prefix}Rim', parts, rim_mat)
  return tire, rim


def build_bike() -> bpy.types.Object:
  mats = {
    'frame': mat('OmaFrame', FRAME),
    'dark': mat('OmaDark', DARK),
    'black': mat('OmaBlack', BLACK),
    'rim': mat('OmaRim', RIM),
    'seat': mat('OmaSeat', SEAT),
    'chrome': mat('OmaChrome', CHROME),
  }

  root = empty('Omafiets', Vector((0, 0, 0)))
  steer = empty('Lenker', HEAD)
  front = empty('RadVorn', FRONT_HUB)
  rear = empty('RadHinten', REAR_HUB)

  ft, fr = build_wheel(FRONT_HUB, mats['black'], mats['rim'], 'Front')
  rt, rr = build_wheel(REAR_HUB, mats['black'], mats['rim'], 'Rear')
  for part in (ft, fr):
    bind_mesh(part, front)
  for part in (rt, rr):
    bind_mesh(part, rear)

  rear_l, rear_r = side(REAR_HUB, -1), side(REAR_HUB, 1)
  bb_l, bb_r = BB + Vector((0, -0.035, 0)), BB + Vector((0, 0.035, 0))
  front_l, front_r = side(FRONT_HUB, -1), side(FRONT_HUB, 1)

  # Deep open U — classic oma step-through (clear leg gap).
  u = [
    SEAT_J + Vector((0.05, 0.0, -0.52)),
    Vector((-0.06, 0.0, 0.30)),
    Vector((0.10, 0.0, 0.24)),
    Vector((0.26, 0.0, 0.26)),
    Vector((0.38, 0.0, 0.36)),
    HEAD + Vector((-0.05, 0.0, -0.46)),
  ]
  frame_parts = [
    paint(cylinder(rear_l, bb_l, TUBE_R), mats['frame']),
    paint(cylinder(rear_r, bb_r, TUBE_R), mats['frame']),
    paint(cylinder(rear_l, SEAT_J + Vector((0, -0.025, 0)), TUBE_R * 0.95), mats['frame']),
    paint(cylinder(rear_r, SEAT_J + Vector((0, 0.025, 0)), TUBE_R * 0.95), mats['frame']),
    paint(cylinder(BB, SEAT_J, TUBE_R * 1.1), mats['frame']),
    paint(cylinder(BB, HEAD + Vector((0, 0, -0.1)), TUBE_R * 1.15), mats['frame']),
    paint(cylinder(HEAD + Vector((0, 0, -0.2)), HEAD + Vector((0, 0, 0.07)), TUBE_R * 1.25), mats['frame']),
    paint(cylinder(rear_l, rear_r, DROPOUT_R, 12), mats['frame']),
  ]
  for a, b in zip(u, u[1:]):
    frame_parts.append(paint(cylinder(a, b, TUBE_R * 0.98), mats['frame']))
  frame = join('Frame', frame_parts, mats['frame'])
  bind_mesh(frame, root)

  # Fenders.
  rear_fender = join(
    'RearFender',
    arc_tubes(REAR_HUB, WHEEL_R + 0.04, 0.016, 25, 155, 10, mats['dark']),
    mats['dark'],
  )
  bind_mesh(rear_fender, root)
  front_fender = join(
    'FrontFender',
    arc_tubes(FRONT_HUB, WHEEL_R + 0.04, 0.015, 40, 140, 8, mats['dark']),
    mats['dark'],
  )
  bind_mesh(front_fender, steer)

  # Spring saddle — tapered nose reads better than a floating black tablet.
  seat = join(
    'Seat',
    [
      paint(cylinder(SEAT_J, SEAT_J + Vector((-0.02, 0, 0.06)), TUBE_R * 0.55, 10), mats['dark']),
      paint(cylinder(SEAT_J + Vector((-0.05, -0.025, 0.07)), SEAT_J + Vector((-0.05, -0.025, 0.11)), 0.009, 8), mats['dark']),
      paint(cylinder(SEAT_J + Vector((-0.05, 0.025, 0.07)), SEAT_J + Vector((-0.05, 0.025, 0.11)), 0.009, 8), mats['dark']),
      paint(box(SEAT_J + Vector((-0.02, 0, 0.135)), Vector((0.22, 0.13, 0.038))), mats['seat']),
      paint(box(SEAT_J + Vector((0.08, 0, 0.132)), Vector((0.10, 0.08, 0.032))), mats['seat']),
    ],
    mats['seat'],
  )
  bind_mesh(seat, root)

  crank = join(
    'Crank',
    [
      paint(cylinder(BB + Vector((0, -0.15, 0)), BB + Vector((0, 0.15, 0)), 0.03, 12), mats['dark']),
      paint(cylinder(BB, BB + Vector((0.15, -0.15, -0.03)), 0.015, 8), mats['dark']),
      paint(cylinder(BB, BB + Vector((-0.15, 0.15, -0.03)), 0.015, 8), mats['dark']),
      paint(box(BB + Vector((0.15, -0.19, -0.03)), Vector((0.11, 0.05, 0.028))), mats['dark']),
      paint(box(BB + Vector((-0.15, 0.19, -0.03)), Vector((0.11, 0.05, 0.028))), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(crank, root)

  # Chain case — thin city-bike cue (fat slab read as a moped from chase).
  case = join(
    'ChainCase',
    [
      paint(cylinder(REAR_HUB + Vector((0.05, -0.08, 0.0)), BB + Vector((0.0, -0.08, 0.02)), 0.028, 14), mats['dark']),
      paint(cylinder(REAR_HUB + Vector((0.10, -0.08, 0.14)), REAR_HUB + Vector((-0.06, -0.08, 0.18)), 0.02, 10), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(case, root)

  # Kickstand.
  stand = paint(
    cylinder(BB + Vector((-0.08, 0.06, -0.02)), Vector((-0.05, 0.18, 0.02)), 0.012, 8),
    mats['dark'],
  )
  stand.name = 'Kickstand'
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  bind_mesh(stand, root)

  # Rear rack with side rails + stays to the dropouts (no floating plank).
  rack_deck_z = WHEEL_R + 0.14
  rack_front = REAR_HUB + Vector((0.08, 0.0, rack_deck_z))
  rack_back = REAR_HUB + Vector((-0.18, 0.0, rack_deck_z))
  rack_y = 0.11
  rear_rack = join(
    'RearRack',
    [
      paint(cylinder(SEAT_J + Vector((-0.02, -0.03, 0.02)), rack_front + Vector((0, -rack_y, 0)), 0.011, 8), mats['dark']),
      paint(cylinder(SEAT_J + Vector((-0.02, 0.03, 0.02)), rack_front + Vector((0, rack_y, 0)), 0.011, 8), mats['dark']),
      paint(cylinder(rack_front + Vector((0, -rack_y, 0)), rack_front + Vector((0, rack_y, 0)), 0.011, 8), mats['dark']),
      paint(cylinder(rack_back + Vector((0, -rack_y, 0)), rack_back + Vector((0, rack_y, 0)), 0.011, 8), mats['dark']),
      paint(cylinder(rack_front + Vector((0, -rack_y, 0)), rack_back + Vector((0, -rack_y, 0)), 0.011, 8), mats['dark']),
      paint(cylinder(rack_front + Vector((0, rack_y, 0)), rack_back + Vector((0, rack_y, 0)), 0.011, 8), mats['dark']),
      paint(cylinder(rack_back + Vector((0, -rack_y, 0)), rear_l + Vector((0, 0, 0.02)), 0.01, 6), mats['dark']),
      paint(cylinder(rack_back + Vector((0, rack_y, 0)), rear_r + Vector((0, 0, 0.02)), 0.01, 6), mats['dark']),
      paint(cylinder(rack_front + Vector((0, -rack_y, 0)), rear_l + Vector((0.05, 0, 0.02)), 0.01, 6), mats['dark']),
      paint(cylinder(rack_front + Vector((0, rack_y, 0)), rear_r + Vector((0.05, 0, 0.02)), 0.01, 6), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(rear_rack, root)

  # Optional rear child seat (prefs `bikeBabySeat`). Named BabySeat so runtime
  # can hide it without a second GLB; mama-chari will reuse the same node name.
  baby_deck = REAR_HUB + Vector((-0.05, 0.0, rack_deck_z + 0.02))
  baby_seat = join(
    'BabySeat',
    [
      paint(cylinder(baby_deck, baby_deck + Vector((0.0, 0.0, 0.12)), 0.018, 10), mats['dark']),
      paint(box(baby_deck + Vector((0.02, 0.0, 0.18)), Vector((0.22, 0.20, 0.04))), mats['dark']),
      paint(box(baby_deck + Vector((-0.06, 0.0, 0.28)), Vector((0.05, 0.20, 0.22))), mats['dark']),
      paint(box(baby_deck + Vector((0.02, -0.11, 0.26)), Vector((0.18, 0.03, 0.16))), mats['dark']),
      paint(box(baby_deck + Vector((0.02, 0.11, 0.26)), Vector((0.18, 0.03, 0.16))), mats['dark']),
      paint(cylinder(baby_deck + Vector((0.10, -0.08, 0.02)), rear_l + Vector((0.02, 0.0, 0.04)), 0.01, 6), mats['dark']),
      paint(cylinder(baby_deck + Vector((0.10, 0.08, 0.02)), rear_r + Vector((0.02, 0.0, 0.04)), 0.01, 6), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(baby_seat, root)

  fork = join(
    'Fork',
    [
      paint(cylinder(HEAD, front_l + Vector((0.01, 0, -0.015)), TUBE_R * 0.95), mats['frame']),
      paint(cylinder(HEAD, front_r + Vector((0.01, 0, -0.015)), TUBE_R * 0.95), mats['frame']),
      paint(cylinder(front_l, front_r, DROPOUT_R * 1.2, 12), mats['frame']),
      paint(cylinder(HEAD + Vector((0, -0.05, -0.02)), HEAD + Vector((0, 0.05, -0.02)), TUBE_R * 1.15, 10), mats['frame']),
    ],
    mats['frame'],
  )
  bind_mesh(fork, steer)

  # Swept upright city bars + bell.
  bars = join(
    'LenkerBars',
    [
      paint(cylinder(HEAD, BARS, TUBE_R * 0.85, 10), mats['dark']),
      paint(cylinder(BARS + Vector((-0.04, -0.2, 0.05)), BARS + Vector((-0.04, 0.2, 0.05)), TUBE_R * 0.9, 10), mats['dark']),
      paint(cylinder(BARS + Vector((-0.04, -0.2, 0.05)), BARS + Vector((0.06, -0.34, 0.16)), TUBE_R, 10), mats['dark']),
      paint(cylinder(BARS + Vector((-0.04, 0.2, 0.05)), BARS + Vector((0.06, 0.34, 0.16)), TUBE_R, 10), mats['dark']),
      paint(cylinder(BARS + Vector((0.06, -0.34, 0.16)), BARS + Vector((0.12, -0.36, 0.18)), TUBE_R * 1.1, 10), mats['dark']),
      paint(cylinder(BARS + Vector((0.06, 0.34, 0.16)), BARS + Vector((0.12, 0.36, 0.18)), TUBE_R * 1.1, 10), mats['dark']),
      paint(torus(BARS + Vector((0.02, 0.12, 0.08)), 0.025, 0.008, 12, 6), mats['chrome']),
    ],
    mats['dark'],
  )
  bind_mesh(bars, steer)

  # Front rack tied to dropouts.
  rack_top = HEAD + Vector((0.18, 0, 0.0))
  rack = join(
    'FrontRack',
    [
      paint(cylinder(HEAD + Vector((0.02, 0, -0.02)), rack_top, 0.013, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0, -0.13, 0)), rack_top + Vector((0, 0.13, 0)), 0.013, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0.1, -0.13, 0)), rack_top + Vector((0.1, 0.13, 0)), 0.013, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0, -0.13, 0)), rack_top + Vector((0.1, -0.13, 0)), 0.013, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0, 0.13, 0)), rack_top + Vector((0.1, 0.13, 0)), 0.013, 8), mats['dark']),
      paint(cylinder(front_l, rack_top + Vector((0, -0.13, 0)), 0.012, 6), mats['dark']),
      paint(cylinder(front_r, rack_top + Vector((0, 0.13, 0)), 0.012, 6), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(rack, steer)

  # Tiny headlamp.
  lamp = paint(torus(HEAD + Vector((0.08, 0, 0.02)), 0.035, 0.012, 12, 6), mats['chrome'])
  lamp.name = 'Headlamp'
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  bind_mesh(lamp, steer)

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
