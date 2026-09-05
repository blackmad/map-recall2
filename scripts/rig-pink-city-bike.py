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
  bpy.ops.object.empty_add(type='PLAIN_AXES', location=(loc.x, loc.y, loc.z))
  obj = bpy.context.view_layer.objects.active
  obj.name = name
  return obj


def wheel_axle_direction(wheel: bpy.types.Object) -> Vector:
  """Unit axle = direction of least vertex variance (thin disc normal)."""
  points = [vertex.co.copy() for vertex in wheel.data.vertices]
  center = sum(points, Vector()) / max(len(points), 1)

  def variance_along(axis: Vector) -> float:
    axis = axis.normalized()
    return sum((point - center).dot(axis) ** 2 for point in points) / max(len(points), 1)

  best_axis = Vector((0.0, 1.0, 0.0))
  best_var = variance_along(best_axis)
  # Coarse spherical search is enough for authored bike discs.
  for polar_deg in range(0, 180, 2):
    for azim_deg in range(0, 360, 4):
      polar = math.radians(polar_deg)
      azim = math.radians(azim_deg)
      axis = Vector(
        (
          math.sin(polar) * math.cos(azim),
          math.cos(polar),
          math.sin(polar) * math.sin(azim),
        )
      )
      variance = variance_along(axis)
      if variance < best_var:
        best_var = variance
        best_axis = axis
  if best_axis.y < 0.0:
    best_axis = -best_axis
  return best_axis.normalized()


def bake_wheel_to_pivot(wheel: bpy.types.Object, pivot: bpy.types.Object) -> None:
  """Parent wheel under pivot with identity transform and axle on local +Y.

  Use min-variance (true disc normal), not AABB thin-axis — after handle
  straighten the front tyre can be ~10° tilted while AABB still says thin=Y,
  which makes game spin about +Z look wobbly.
  """
  bpy.context.view_layer.update()
  bpy.ops.object.select_all(action='DESELECT')
  wheel.select_set(True)
  bpy.context.view_layer.objects.active = wheel
  bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)

  if wheel.parent is not None:
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  axle = wheel_axle_direction(wheel)
  target = Vector((0.0, 1.0, 0.0))
  angle = axle.angle(target)
  if angle > math.radians(0.25):
    wheel.data.transform(axle.rotation_difference(target).to_matrix().to_4x4())
    wheel.data.update()

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
  aligned = wheel_axle_direction(wheel)
  aligned_deg = math.degrees(aligned.angle(target))
  print(
    f'{wheel.name} axle→Y rotated={math.degrees(angle):.1f}° '
    f'residual={aligned_deg:.2f}° '
    f'AABB thin={"XYZ"[thin]} ext={tuple(round(value, 3) for value in ext)}'
  )
  if thin != 1 or aligned_deg > 1.0:
    raise RuntimeError(
      f'{wheel.name} expected axle on +Y after bake '
      f'(thin={"XYZ"[thin]}, residual={aligned_deg:.2f}°)'
    )


def mesh_thin_axis_world(obj: bpy.types.Object) -> Vector:
  """Unit normal of a thin mesh (min variance axis) in world space."""
  points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
  center = sum(points, Vector()) / max(len(points), 1)

  def variance_along(axis: Vector) -> float:
    axis = axis.normalized()
    return sum((point - center).dot(axis) ** 2 for point in points) / max(len(points), 1)

  best_axis = Vector((0.0, 1.0, 0.0))
  best_var = variance_along(best_axis)
  for polar_deg in range(0, 180, 2):
    for azim_deg in range(0, 360, 4):
      polar = math.radians(polar_deg)
      azim = math.radians(azim_deg)
      axis = Vector(
        (
          math.sin(polar) * math.cos(azim),
          math.cos(polar),
          math.sin(polar) * math.sin(azim),
        )
      )
      variance = variance_along(axis)
      if variance < best_var:
        best_var = variance
        best_axis = axis
  if best_axis.y < 0.0:
    best_axis = -best_axis
  return best_axis.normalized()


def align_mudguard_to_hub(mud: bpy.types.Object, hub: Vector) -> None:
  """Put the front fender in the wheel plane, concentric on the hub.

  Source mudguard stays ~10° cocked vs the tyre after handle straighten (its
  authored axes aren't the wheel midplane), which reads as an uneven gap and
  a sideways lean in chase/side views.
  """
  bpy.context.view_layer.update()
  parent = mud.parent
  bpy.ops.object.select_all(action='DESELECT')
  mud.select_set(True)
  bpy.context.view_layer.objects.active = mud
  bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)
  if parent is not None:
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

  thin = mesh_thin_axis_world(mud)
  target = Vector((0.0, 1.0, 0.0))
  plane_angle = thin.angle(target)
  if plane_angle > math.radians(0.25):
    rotate = thin.rotation_difference(target)
    # Rotate mesh about the hub so the fender plane matches the tyre disc.
    world_to_hub = Matrix.Translation(-hub)
    hub_to_world = Matrix.Translation(hub)
    mud.data.transform((hub_to_world @ rotate.to_matrix().to_4x4() @ world_to_hub))
    mud.data.update()
    bpy.context.view_layer.update()

  # Pitch about +Y so the arc is concentric (front tip gap ≈ rear tip gap).
  rest = [vertex.co.copy() for vertex in mud.data.vertices]

  def apply_pitch(pitch: float) -> None:
    xform = (
      Matrix.Translation(hub)
      @ Matrix.Rotation(pitch, 4, 'Y')
      @ Matrix.Translation(-hub)
    )
    for vertex, point in zip(mud.data.vertices, rest):
      vertex.co = xform @ point
    mud.data.update()
    bpy.context.view_layer.update()

  def radius_spread() -> float:
    radii = [
      math.hypot(point.x - hub.x, point.z - hub.z)
      for point in (mud.matrix_world @ vertex.co for vertex in mud.data.vertices)
    ]
    return max(radii) - min(radii)

  best_pitch = 0.0
  best_spread = float('inf')
  for step in range(-100, 101):
    pitch = math.radians(step * 0.25)
    apply_pitch(pitch)
    spread = radius_spread()
    if spread < best_spread:
      best_spread = spread
      best_pitch = pitch
  apply_pitch(best_pitch)

  # Lateral snap onto the hub track.
  center = mesh_center_world(mud)
  dy = hub.y - center.y
  if abs(dy) > 1e-4:
    mud.data.transform(Matrix.Translation((0.0, dy, 0.0)))
    mud.data.update()
    bpy.context.view_layer.update()

  mud.location = (0.0, 0.0, 0.0)
  mud.rotation_euler = (0.0, 0.0, 0.0)
  mud.scale = (1.0, 1.0, 1.0)
  if parent is not None:
    reparent_keep(mud, parent)

  thin_after = mesh_thin_axis_world(mud)
  thin_deg = math.degrees(thin_after.angle(target))
  mid_dy = abs(mesh_center_world(mud).y - hub.y)
  print(
    f'front_mudguard align plane={math.degrees(plane_angle):.1f}°→{thin_deg:.2f}° '
    f'pitch={math.degrees(best_pitch):.1f}° spread={best_spread:.3f}m '
    f'midΔY={mid_dy:.3f}m'
  )
  if thin_deg > 2.0:
    raise RuntimeError(f'front mudguard still cocked ({thin_deg:.2f}° off +Y)')
  if mid_dy > 0.025:
    raise RuntimeError(f'front mudguard off hub midplane ({mid_dy:.3f}m)')


def bake_world_rotation(obj: bpy.types.Object) -> None:
  """Zero object rotation while keeping visual orientation (mesh bake)."""
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True)
  bpy.context.view_layer.objects.active = obj
  if obj.type == 'MESH':
    bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
  else:
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
  bpy.context.view_layer.update()


def mesh_center_world(obj: bpy.types.Object) -> Vector:
  bpy.context.view_layer.update()
  points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
  return sum(points, Vector()) / max(len(points), 1)


def mesh_axis_span(obj: bpy.types.Object, axis: int) -> float:
  points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
  values = [point[axis] for point in points]
  return max(values) - min(values)


def straighten_handle(handle: bpy.types.Object, pivot: Vector) -> None:
  """Rotate handle/fork/fender/front-wheel onto the bike midplane, then bake.

  Minimize the front wheel's lateral Y span so the tyre disc lies in the XZ
  plane. Mudguard AABB is a bad proxy — its local authoring axes are skewed
  and optimizing it yaws the hub off the midplane.
  """
  bpy.context.view_layer.update()
  wheel = bpy.data.objects.get('front_wheelset')
  if wheel is None:
    raise RuntimeError('front_wheelset missing — cannot straighten handle')

  subtree: list[bpy.types.Object] = []

  def collect(obj: bpy.types.Object) -> None:
    for child in obj.children:
      collect(child)
      subtree.append(child)

  collect(handle)
  subtree.append(handle)
  if wheel not in subtree:
    raise RuntimeError('front_wheelset is not under handle — unexpected hierarchy')
  parent_names = {
    obj.name: (obj.parent.name if obj.parent else None) for obj in subtree
  }
  rest_world = {obj.name: obj.matrix_world.copy() for obj in subtree}

  for obj in subtree:
    if obj.parent is not None:
      bpy.ops.object.select_all(action='DESELECT')
      obj.select_set(True)
      bpy.context.view_layer.objects.active = obj
      bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

  def apply_yaw(radians: float) -> None:
    rotate = (
      Matrix.Translation(pivot)
      @ Matrix.Rotation(radians, 4, 'Z')
      @ Matrix.Translation(-pivot)
    )
    for obj in subtree:
      obj.matrix_world = rotate @ rest_world[obj.name]
    bpy.context.view_layer.update()

  best_deg = 0
  best_span = mesh_axis_span(wheel, 1)
  for deg in range(-90, 91):
    apply_yaw(math.radians(deg))
    span = mesh_axis_span(wheel, 1)
    if span < best_span:
      best_span = span
      best_deg = deg
  refine_best = best_deg
  for step in range(-4, 5):
    deg = best_deg + step * 0.25
    apply_yaw(math.radians(deg))
    span = mesh_axis_span(wheel, 1)
    if span < best_span:
      best_span = span
      refine_best = deg
  best_deg = refine_best
  apply_yaw(math.radians(best_deg))
  print(
    f'handle straighten yaw={best_deg:.2f}° '
    f'(front wheel Y span {best_span:.3f}m)'
  )

  for obj in subtree:
    bake_world_rotation(obj)

  by_name = {obj.name: obj for obj in bpy.context.scene.objects}
  for obj in subtree:
    parent_name = parent_names[obj.name]
    if parent_name and parent_name in by_name:
      reparent_keep(obj, by_name[parent_name])

  hub = mesh_center_world(wheel)
  print(
    'after straighten wheel hub',
    tuple(round(c, 3) for c in hub),
    'Y span',
    round(mesh_axis_span(wheel, 1), 3),
  )
  print(
    'handle straightened; fork world euler',
    tuple(
      round(math.degrees(angle), 1)
      for angle in bpy.data.objects['Fork'].matrix_world.to_euler()
    )
    if 'Fork' in bpy.data.objects
    else None,
  )


def delete_stray_cables() -> None:
  """Drop brake wires and other chase-invisible cable spaghetti."""
  removed: list[str] = []
  for obj in list(bpy.context.scene.objects):
    name = obj.name
    if (
      '剎車線' in name
      or '煞車線' in name
      or 'brake_cable' in name.lower()
      or name.endswith('線lse')  # source typo on 前/後剎車線lse
      # Cable stubs / housings hanging off lever assemblies.
      or name.startswith('剎車TL2')
      or name.startswith('煞車TL2')
      or name.startswith('剎車TL')
      or name.startswith('煞車TL')
    ):
      removed.append(name)
      bpy.data.objects.remove(obj, do_unlink=True)
  print(f'removed cable-like objects: {removed}')


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

  delete_stray_cables()

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

  # Straighten bars/fork/fender/front-wheel onto the midplane BEFORE placing
  # hub pivots — otherwise RadVorn stays at the pre-yaw hub and the tyre
  # ends up beside the fork after bake.
  steer_loc = world_loc(handle)
  straighten_handle(handle, steer_loc)

  # Straighten leaves the front assembly a few cm beside the rear midplane;
  # top-down that reads as an off-centre / wobbly front wheel.
  front_hub = mesh_center_world(front_wheel)
  rear_hub = mesh_center_world(rear_wheel)
  lateral = rear_hub.y - front_hub.y
  if abs(lateral) > 1e-4:
    shift = Matrix.Translation((0.0, lateral, 0.0))
    subtree: list[bpy.types.Object] = []

    def collect(obj: bpy.types.Object) -> None:
      for child in obj.children:
        collect(child)
        subtree.append(child)

    collect(handle)
    subtree.append(handle)
    parent_names = {
      obj.name: (obj.parent.name if obj.parent else None) for obj in subtree
    }
    for obj in subtree:
      if obj.parent is not None:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for obj in subtree:
      obj.matrix_world = shift @ obj.matrix_world
    bpy.context.view_layer.update()
    by_name = {obj.name: obj for obj in bpy.context.scene.objects}
    for obj in subtree:
      parent_name = parent_names[obj.name]
      if parent_name and parent_name in by_name:
        reparent_keep(obj, by_name[parent_name])
    print(f'front assembly midplane snap ΔY={lateral:.3f}m')

  front_hub = mesh_center_world(front_wheel)
  rear_hub = mesh_center_world(rear_wheel)
  handle_loc = world_loc(handle)
  # Lenker must share the hub's lateral axis or steering orbits the tyre sideways.
  # Handle object origin is not on that midplane after straighten.
  steer_loc = Vector((handle_loc.x, front_hub.y, handle_loc.z))
  print(
    'hubs',
    tuple(round(c, 3) for c in front_hub),
    tuple(round(c, 3) for c in rear_hub),
    'Lenker',
    tuple(round(c, 3) for c in steer_loc),
  )
  if abs(front_hub.y - rear_hub.y) > 0.02:
    raise RuntimeError(
      f'front/rear hubs still laterally split '
      f'({front_hub.y:.3f} vs {rear_hub.y:.3f})'
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

  # Basket is authored off to one side; nudge it onto the hub track so top-down
  # doesn't look like a cocked front end.
  basket = bpy.data.objects.get('basket')
  if basket is not None:
    basket_c = mesh_center_world(basket)
    basket_dy = world_loc(rad_v).y - basket_c.y
    if abs(basket_dy) > 0.01:
      parent = basket.parent
      if parent is not None:
        bpy.ops.object.select_all(action='DESELECT')
        basket.select_set(True)
        bpy.context.view_layer.objects.active = basket
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
      basket.location.y += basket_dy
      bpy.context.view_layer.update()
      if parent is not None:
        reparent_keep(basket, parent)
      print(f'basket midplane snap ΔY={basket_dy:.3f}m')

  mud = bpy.data.objects.get('front_mudguard')
  if mud is not None:
    align_mudguard_to_hub(mud, world_loc(rad_v))

  # Sanity before decimate/export — fail closed so we never ship a cocked GLB.
  fork = bpy.data.objects.get('Fork')
  mud = bpy.data.objects.get('front_mudguard')
  if fork:
    print('fork world euler', tuple(round(math.degrees(a), 1) for a in fork.matrix_world.to_euler()))
  if mud:
    print('front_mudguard world euler', tuple(round(math.degrees(a), 1) for a in mud.matrix_world.to_euler()))
  wheel_y = mesh_axis_span(front_wheel, 1)
  print(f'front wheel Y span={wheel_y:.3f}m')
  if wheel_y > 0.2:
    raise RuntimeError(f'front wheel still cocked (Y span {wheel_y:.3f}m)')
  hub_delta = abs(world_loc(rad_v).y - world_loc(lenker).y)
  print(f'hub vs Lenker lateral={hub_delta:.3f}m')
  if hub_delta > 0.04:
    raise RuntimeError(f'front hub off steer midplane ({hub_delta:.3f}m)')
  track_delta = abs(world_loc(rad_v).y - world_loc(rad_h).y)
  print(f'front/rear hub track ΔY={track_delta:.3f}m')
  if track_delta > 0.02:
    raise RuntimeError(f'front/rear hubs off track ({track_delta:.3f}m)')
  if mud:
    mud_delta = abs(mesh_center_world(mud).y - world_loc(rad_v).y)
    mud_thin = math.degrees(mesh_thin_axis_world(mud).angle(Vector((0.0, 1.0, 0.0))))
    print(f'mudguard midY vs hub={mud_delta:.3f}m thin↔Y={mud_thin:.2f}°')
    if mud_delta > 0.03:
      raise RuntimeError(f'front mudguard/hub midplane mismatch ({mud_delta:.3f}m)')
    if mud_thin > 2.0:
      raise RuntimeError(f'front mudguard plane cocked ({mud_thin:.2f}°)')

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
  # Sit both hubs on Y=0 so top-down chase framing is centred on the track.
  hub_y = world_loc(rad_v).y
  if abs(hub_y) > 1e-4:
    root.location.y -= hub_y
    bpy.context.view_layer.update()
    print(f'hub track → Y=0 (was {hub_y:.3f})')

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
