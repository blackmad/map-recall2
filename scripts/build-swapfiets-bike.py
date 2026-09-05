#!/usr/bin/env python3
"""Author a chase-readable low-poly Swapfiets (Original silhouette).

Matches PatrickGoud / real Original cues without cutting the Sketchfab mesh:
double step-through, chrome upright bars, front carrier only, ring lock,
iconic blue front tyre. Real Lenker / RadVorn / RadHinten pivots.

  blender --background --python scripts/build-swapfiets-bike.py -- \\
    --out=public/canal-drive/swapfiets-runtime.glb

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
TIRE_T = 0.048  # ~42 mm Original tyre
HUB_R = 0.048
AXLE_HALF = 0.12
TUBE_R = 0.040
DROPOUT_R = 0.024

# Swapfiets Original: vivid red frame, iconic blue front tyre.
FRAME = (0.86, 0.05, 0.08, 1.0)
BLUE_TIRE = (0.08, 0.38, 0.95, 1.0)
DARK = (0.09, 0.09, 0.10, 1.0)
BLACK = (0.05, 0.05, 0.06, 1.0)
RIM = (0.78, 0.78, 0.80, 1.0)
SEAT = (0.07, 0.07, 0.07, 1.0)
CHROME = (0.78, 0.80, 0.84, 1.0)

# Slightly longer wheelbase so the double step-through clears the front tyre.
REAR_HUB = Vector((-0.58, 0.0, WHEEL_R))
FRONT_HUB = Vector((0.70, 0.0, WHEEL_R))
BB = Vector((0.04, 0.0, WHEEL_R * 0.50))
SEAT_J = Vector((-0.20, 0.0, 0.80))
HEAD = Vector((0.50, 0.0, 0.88))
BARS = Vector((0.44, 0.0, 1.18))


def parse_args(argv: list[str]) -> argparse.Namespace:
  if '--' in argv:
    argv = argv[argv.index('--') + 1 :]
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--out', required=True)
  return parser.parse_args(argv)


def clear_scene() -> None:
  bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name: str, color: tuple[float, float, float, float], *, metallic: float = 0.06, roughness: float = 0.7) -> bpy.types.Material:
  material = bpy.data.materials.new(name=name)
  material.use_nodes = True
  material.use_backface_culling = False
  if hasattr(material, 'blend_method'):
    material.blend_method = 'OPAQUE'
  node = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
  node.inputs['Base Color'].default_value = color
  node.inputs['Roughness'].default_value = roughness
  if 'Metallic' in node.inputs:
    node.inputs['Metallic'].default_value = metallic
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


def catmull_rom(points: list[Vector], samples_per_span: int = 6) -> list[Vector]:
  """Resample a control polyline into a smoother open Catmull-Rom curve."""
  if len(points) < 2:
    return list(points)
  if len(points) == 2:
    return [points[0].copy(), points[1].copy()]
  # Pad ends so the curve passes through the first/last controls.
  padded = [points[0] + (points[0] - points[1]), *points, points[-1] + (points[-1] - points[-2])]
  out: list[Vector] = []
  for i in range(1, len(padded) - 2):
    p0, p1, p2, p3 = padded[i - 1], padded[i], padded[i + 1], padded[i + 2]
    steps = samples_per_span if i < len(padded) - 3 else samples_per_span + 1
    for step in range(steps):
      t = step / samples_per_span
      t2 = t * t
      t3 = t2 * t
      out.append(
        0.5
        * (
          (2.0 * p1)
          + (-p0 + p2) * t
          + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
          + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
        )
      )
  return out


def tube_along(
  points: list[Vector],
  radius: float,
  material: bpy.types.Material,
  segments: int = 10,
) -> list[bpy.types.Object]:
  """One bevelled Bézier curve mesh (smooth continuous tube through controls)."""
  del segments  # kept for call-site compatibility; bevel_resolution sets smoothness
  if len(points) < 2:
    return []
  curve_data = bpy.data.curves.new('TubePath', type='CURVE')
  curve_data.dimensions = '3D'
  curve_data.resolution_u = 24
  curve_data.fill_mode = 'FULL'
  curve_data.bevel_depth = radius
  curve_data.bevel_resolution = 5
  spline = curve_data.splines.new('BEZIER')
  spline.bezier_points.add(len(points) - 1)
  for i, point in enumerate(points):
    bp = spline.bezier_points[i]
    bp.co = point
    bp.handle_left_type = 'AUTO'
    bp.handle_right_type = 'AUTO'
  obj = bpy.data.objects.new('Tube', curve_data)
  bpy.context.collection.objects.link(obj)
  bpy.ops.object.select_all(action='DESELECT')
  bpy.context.view_layer.objects.active = obj
  obj.select_set(True)
  bpy.ops.object.convert(target='MESH')
  mesh_obj = bpy.context.view_layer.objects.active
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  # Soft shade so chase/preview doesn't reintroduce fake cylinder kinks.
  bpy.ops.object.shade_smooth()
  return [paint(mesh_obj, material)]


def ellipsoid(
  center: Vector,
  radii: Vector,
  material: bpy.types.Material,
  segments: int = 16,
) -> bpy.types.Object:
  bpy.ops.mesh.primitive_uv_sphere_add(
    segments=segments,
    ring_count=max(8, segments // 2),
    radius=1.0,
    location=center,
  )
  obj = bpy.context.view_layer.objects.active
  obj.scale = radii
  bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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


def stay_clear_of_wheel(
  hub: Vector,
  dropout: Vector,
  seat: Vector,
  tube_r: float,
) -> list[Vector]:
  """Route a seat stay outside the rear tyre instead of chord-cutting through it."""
  mid = (dropout + seat) * 0.5
  radial = Vector((mid.x - hub.x, 0.0, mid.z - hub.z))
  if radial.length < 1e-6:
    radial = Vector((0.0, 0.0, 1.0))
  else:
    radial.normalize()
  clear = WHEEL_R + TIRE_T + tube_r + 0.035
  waypoint = hub + radial * clear
  waypoint.y = dropout.y * 1.08
  return [dropout, waypoint, seat]


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
    'frame': mat('SwapFrame', FRAME, metallic=0.08, roughness=0.55),
    'dark': mat('SwapDark', DARK, metallic=0.15, roughness=0.55),
    'black': mat('SwapBlack', BLACK, metallic=0.05, roughness=0.8),
    'blue': mat('SwapBlueTire', BLUE_TIRE, metallic=0.0, roughness=0.75),
    'rim': mat('SwapRim', RIM, metallic=0.55, roughness=0.35),
    'seat': mat('SwapSeat', SEAT, metallic=0.0, roughness=0.85),
    'chrome': mat('SwapChrome', CHROME, metallic=0.85, roughness=0.22),
  }

  root = empty('Swapfiets', Vector((0, 0, 0)))
  steer = empty('Lenker', HEAD)
  front = empty('RadVorn', FRONT_HUB)
  rear = empty('RadHinten', REAR_HUB)

  ft, fr = build_wheel(FRONT_HUB, mats['blue'], mats['rim'], 'Front')
  rt, rr = build_wheel(REAR_HUB, mats['black'], mats['rim'], 'Rear')
  for part in (ft, fr):
    bind_mesh(part, front)
  for part in (rt, rr):
    bind_mesh(part, rear)

  rear_l, rear_r = side(REAR_HUB, -1), side(REAR_HUB, 1)
  bb_l, bb_r = BB + Vector((0, -0.035, 0)), BB + Vector((0, 0.035, 0))
  front_l, front_r = side(FRONT_HUB, -1), side(FRONT_HUB, 1)

  # Double parallel step-through (Sketchfab / Original silhouette) — lower +
  # upper tubes from seat cluster to head, dipping ahead of the BB.
  def step_through(start: Vector, trough_z: float) -> list[Vector]:
    # Keep the climb behind the front tyre volume (clearance assert ~4cm+).
    trough = Vector((0.10, 0.0, trough_z))
    return [
      start,
      Vector((start.x * 0.4 + 0.01, 0.0, (start.z + trough_z) * 0.55)),
      trough,
      Vector((0.16, 0.0, trough_z + 0.14)),
      Vector((0.22, 0.0, 0.60)),
      Vector((0.32, 0.0, 0.82)),
      HEAD + Vector((-0.04, 0.0, -0.02)),
    ]

  u_lower_start = BB.lerp(SEAT_J, 0.32)
  u_upper_start = BB.lerp(SEAT_J, 0.58)
  u_lower = step_through(u_lower_start, 0.24)
  u_upper = step_through(u_upper_start, 0.38)
  u_trough = u_lower[2]
  seat_l = SEAT_J + Vector((0, -0.03, 0))
  seat_r = SEAT_J + Vector((0, 0.03, 0))
  frame_parts = [
    paint(cylinder(rear_l, bb_l, TUBE_R), mats['frame']),
    paint(cylinder(rear_r, bb_r, TUBE_R), mats['frame']),
    *tube_along(stay_clear_of_wheel(REAR_HUB, rear_l, seat_l, TUBE_R * 0.95), TUBE_R * 0.95, mats['frame']),
    *tube_along(stay_clear_of_wheel(REAR_HUB, rear_r, seat_r, TUBE_R * 0.95), TUBE_R * 0.95, mats['frame']),
    paint(cylinder(BB, SEAT_J, TUBE_R * 1.1), mats['frame']),
    # BB shell so chainstay / seat / join ends read as one hub.
    paint(cylinder(BB + Vector((0, -0.055, 0)), BB + Vector((0, 0.055, 0)), TUBE_R * 1.4, 14), mats['frame']),
    paint(cylinder(BB, u_trough, TUBE_R * 1.0), mats['frame']),
    paint(cylinder(HEAD + Vector((0, 0, -0.05)), HEAD + Vector((0, 0, 0.07)), TUBE_R * 1.25), mats['frame']),
    paint(cylinder(rear_l, rear_r, DROPOUT_R, 12), mats['frame']),
  ]
  frame_parts.extend(tube_along(u_lower, TUBE_R * 0.92, mats['frame']))
  frame_parts.extend(tube_along(u_upper, TUBE_R * 0.92, mats['frame']))
  frame = join('Frame', frame_parts, mats['frame'])
  bind_mesh(frame, root)

  # Fenders — Original ships a clear rear cover; front is light under the rack.
  rear_fender = join(
    'RearFender',
    arc_tubes(REAR_HUB, WHEEL_R + 0.045, 0.016, 20, 160, 11, mats['dark']),
    mats['dark'],
  )
  bind_mesh(rear_fender, root)
  front_fender = join(
    'FrontFender',
    arc_tubes(FRONT_HUB, WHEEL_R + 0.045, 0.014, 45, 135, 7, mats['dark']),
    mats['dark'],
  )
  bind_mesh(front_fender, steer)

  # Spring saddle — chunky rounded body + tapered nose, flush on the post.
  seat_post_top = SEAT_J + Vector((-0.02, 0, 0.08))
  seat = join(
    'Seat',
    [
      paint(cylinder(SEAT_J, seat_post_top + Vector((0, 0, 0.01)), TUBE_R * 0.55, 10), mats['dark']),
      paint(cylinder(SEAT_J + Vector((-0.04, -0.022, 0.05)), seat_post_top + Vector((-0.02, -0.018, -0.01)), 0.008, 8), mats['dark']),
      paint(cylinder(SEAT_J + Vector((-0.04, 0.022, 0.05)), seat_post_top + Vector((-0.02, 0.018, -0.01)), 0.008, 8), mats['dark']),
      # Visible coil springs (Sketchfab cue).
      paint(torus(seat_post_top + Vector((-0.04, -0.04, -0.01)), 0.022, 0.006, 10, 6), mats['chrome']),
      paint(torus(seat_post_top + Vector((-0.04, 0.04, -0.01)), 0.022, 0.006, 10, 6), mats['chrome']),
      ellipsoid(seat_post_top + Vector((-0.02, 0, 0.008)), Vector((0.14, 0.11, 0.055)), mats['seat'], segments=20),
      ellipsoid(seat_post_top + Vector((0.10, 0, 0.0)), Vector((0.07, 0.05, 0.038)), mats['seat'], segments=16),
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

  # Fuller enclosed chain case (Dutch city bike).
  case_mid = BB.lerp(REAR_HUB, 0.48) + Vector((0.0, -0.17, 0.01))
  case = join(
    'ChainCase',
    [
      paint(box(case_mid, Vector((0.38, 0.035, 0.13))), mats['dark']),
      paint(cylinder(REAR_HUB + Vector((0.0, -0.17, 0.02)), BB + Vector((0.0, -0.17, 0.0)), 0.055, 16), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(case, root)

  # Kickstand to the ground.
  stand = paint(
    cylinder(BB + Vector((-0.06, 0.05, -0.02)), Vector((-0.02, 0.16, 0.015)), 0.012, 8),
    mats['dark'],
  )
  stand.name = 'Kickstand'
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  bind_mesh(stand, root)

  # Ring lock on the seat tube (Original ships ring + chain lock).
  lock = join(
    'RingLock',
    [
      paint(torus(SEAT_J + Vector((0.02, 0.0, -0.12)), 0.07, 0.012, 18, 8), mats['dark']),
      paint(box(SEAT_J + Vector((0.02, 0.0, -0.05)), Vector((0.05, 0.04, 0.08))), mats['dark']),
    ],
    mats['dark'],
  )
  bind_mesh(lock, root)

  # Original has no rear luggage rack — front carrier only.
  fork = join(
    'Fork',
    [
      # Bow out early so side views don't read as tubes through the tyre.
      paint(cylinder(HEAD + Vector((0.02, -0.08, -0.04)), front_l + Vector((0.01, 0, -0.015)), TUBE_R * 0.85), mats['frame']),
      paint(cylinder(HEAD + Vector((0.02, 0.08, -0.04)), front_r + Vector((0.01, 0, -0.015)), TUBE_R * 0.85), mats['frame']),
      paint(cylinder(HEAD, HEAD + Vector((0.02, -0.08, -0.04)), TUBE_R * 0.9, 10), mats['frame']),
      paint(cylinder(HEAD, HEAD + Vector((0.02, 0.08, -0.04)), TUBE_R * 0.9, 10), mats['frame']),
      paint(cylinder(front_l, front_r, DROPOUT_R * 1.2, 12), mats['frame']),
      paint(cylinder(HEAD + Vector((0, -0.05, -0.02)), HEAD + Vector((0, 0.05, -0.02)), TUBE_R * 1.15, 10), mats['frame']),
    ],
    mats['frame'],
  )
  bind_mesh(fork, steer)

  # Chrome high-rise bars + black grips + bell (Sketchfab / Original cue).
  bar_ctrl = [
    BARS + Vector((0.10, -0.36, 0.16)),
    BARS + Vector((0.02, -0.24, 0.08)),
    BARS + Vector((-0.02, 0.0, 0.02)),
    BARS + Vector((0.02, 0.24, 0.08)),
    BARS + Vector((0.10, 0.36, 0.16)),
  ]
  stem_meet = bar_ctrl[2]
  grip_l0 = bar_ctrl[0]
  grip_l1 = bar_ctrl[0] + (bar_ctrl[0] - bar_ctrl[1]).normalized() * 0.07
  grip_r0 = bar_ctrl[-1]
  grip_r1 = bar_ctrl[-1] + (bar_ctrl[-1] - bar_ctrl[-2]).normalized() * 0.07
  bars = join(
    'LenkerBars',
    [
      paint(cylinder(HEAD, stem_meet, TUBE_R * 0.8, 10), mats['chrome']),
      *tube_along(bar_ctrl, TUBE_R * 0.88, mats['chrome']),
      paint(cylinder(grip_l0, grip_l1, TUBE_R * 1.15, 10), mats['black']),
      paint(cylinder(grip_r0, grip_r1, TUBE_R * 1.15, 10), mats['black']),
      # Bell on the left.
      paint(torus(bar_ctrl[1] + Vector((0.02, 0.0, 0.03)), 0.022, 0.007, 12, 6), mats['dark']),
    ],
    mats['chrome'],
  )
  bind_mesh(bars, steer)

  # Front carrier over the blue tyre — Original luggage is front-only.
  rack_top = HEAD + Vector((0.22, 0, -0.04))
  rack_y = 0.15
  rack_depth = 0.18
  rack = join(
    'FrontRack',
    [
      paint(cylinder(HEAD + Vector((0.02, 0, -0.02)), rack_top, 0.014, 8), mats['dark']),
      paint(cylinder(rack_top + Vector((0, -rack_y, 0)), rack_top + Vector((0, rack_y, 0)), 0.014, 8), mats['dark']),
      paint(
        cylinder(
          rack_top + Vector((rack_depth, -rack_y, 0)),
          rack_top + Vector((rack_depth, rack_y, 0)),
          0.014,
          8,
        ),
        mats['dark'],
      ),
      paint(
        cylinder(rack_top + Vector((0, -rack_y, 0)), rack_top + Vector((rack_depth, -rack_y, 0)), 0.014, 8),
        mats['dark'],
      ),
      paint(
        cylinder(rack_top + Vector((0, rack_y, 0)), rack_top + Vector((rack_depth, rack_y, 0)), 0.014, 8),
        mats['dark'],
      ),
      paint(
        cylinder(
          rack_top + Vector((rack_depth * 0.5, -rack_y, 0)),
          rack_top + Vector((rack_depth * 0.5, rack_y, 0)),
          0.011,
          8,
        ),
        mats['dark'],
      ),
      paint(cylinder(front_l, rack_top + Vector((0.02, -rack_y, 0)), 0.012, 6), mats['dark']),
      paint(cylinder(front_r, rack_top + Vector((0.02, rack_y, 0)), 0.012, 6), mats['dark']),
      paint(cylinder(front_l, rack_top + Vector((rack_depth, -rack_y, 0)), 0.011, 6), mats['dark']),
      paint(cylinder(front_r, rack_top + Vector((rack_depth, rack_y, 0)), 0.011, 6), mats['dark']),
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


def assert_front_clearance() -> None:
  """Fail closed if Frame/Fork still punch the front tyre."""
  frame = bpy.data.objects.get('Frame')
  fork = bpy.data.objects.get('Fork')
  tire = bpy.data.objects.get('FrontTire')
  if frame is None or fork is None or tire is None:
    raise RuntimeError('Frame/Fork/FrontTire missing after build')
  tire_points = [tire.matrix_world @ vertex.co for vertex in tire.data.vertices]

  def min_gap(mesh: bpy.types.Object) -> float:
    worst = 999.0
    for vertex in mesh.data.vertices:
      point = mesh.matrix_world @ vertex.co
      for tire_point in tire_points[::2]:
        worst = min(worst, (point - tire_point).length)
    return worst

  frame_gap = min_gap(frame)
  fork_gap = min_gap(fork)
  print(f'front tyre mesh gap Frame={frame_gap:.3f}m Fork={fork_gap:.3f}m')
  if frame_gap < 0.04:
    raise RuntimeError(f'Frame still clips front tyre (gap {frame_gap:.3f}m)')
  if fork_gap < 0.03:
    raise RuntimeError(f'Fork still clips front tyre (gap {fork_gap:.3f}m)')


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
  assert_front_clearance()
  export_glb(root, out)
  print(f'wrote {out}')


if __name__ == '__main__':
  main()
