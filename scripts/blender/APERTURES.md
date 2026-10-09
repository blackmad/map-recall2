# Apertures and recessed shopfronts

This opt-in geometry stage cuts real holes through the facade wall, ground finish
and plinth. Aperture dimensions remain recipe-authored; ambiguous rectified
photographs do not become measured openings because they now generate holes.

## Shared profiles and wall ownership

`building_lib.apertures.from_spec()` supplies the same outline to cutters and
joinery. Rectangular, circular segmental and rounded/elliptical heads are
supported. Curves use an explicit bounded tessellation count. The compiler
rejects openings outside the frontage, crossing a concave gable, or intersecting
another aperture owner. A connected shopfront must have one owner rather than
several overlapping cutter rectangles.

The wall and finish slabs promise closed, manifold solids. Exact boolean cutters
extend past both depth faces; street-zero door cutters also extend below the
slab, avoiding coincident bottom caps. New reveal faces receive the same physical
metre UV projection as the original wall. `walls.shell()` omits every explicitly
authored frontage edge, including rotated corner returns, so an uncut side-wall
plane cannot block a return facade's openings.

Run the wall compiler before assigning the frontage parent transform:

```python
apertures = front['openings']
wall = walls.facade_with_apertures(width, profile, wall_material, apertures)
finish = walls.finish_with_apertures(width, ground_height, finish_material, apertures)
plinth = walls.cut_apertures(plinth, [o for o in apertures if o['storey'] == 'ground'])
for spec in apertures:
    recessed_opening(spec, frame_material, opaque_glass, brass,
                     glass_depth=spec.get('glazingDepth', .12))
```

`recessed_opening()` keeps outer trim at the named frontage trim plane and puts
sash divisions, door panels and hardware inside the aperture. A 14 mm closed
opaque pane is the mobile glass fallback, preventing empty interiors and
single-sided pane backfaces. Its front face lies at `glass_depth`, and the whole
pane must fit inside the wall slab. Sill and threshold tops equal the recipe's
opening bottom datum; doorway classification comes from `kind`.

## Recessed storefront owner

The angled shopfront component represents three connected glazing facets. One
explicit spec defines its aperture, floor, soffit and frames:

```python
spec = {
    'id': 'Synthetic angled shop',
    'x': 3.0, 'width': 4.0,
    'sill': .12, 'head': 2.8,
    'recess': .55, 'sideReturn': .5,
    'provenance': {'status': 'synthetic'},
}
aperture = ground_floors.assembly_aperture(spec)
# Include aperture in the shared wall/finish/plinth cutter list.
ground_floors.recessed_storefront_from_spec(spec, frame, opaque_glass, lining)
```

`x` is the facade-local center. `recess` is the distance from the explicit front
plane (default `shell_front`) into the building. `sideReturn` is the horizontal
run of each angled return. Frames use depth normal to each glazing facet rather
than an arbitrary world-axis rotation. The threshold floor faces upward and the
soffit faces downward. Glazing and frames promise closed solids; the floor and
soffit are intentionally single visible surfaces.

This fixture is a display assembly. A photo-specific recessed entrance still
requires explicitly authored door position, opaque panels, side-window sill
heights and independently supported recess dimensions. Do not replace an entire
real shopfront with generic glazing or assign inferred depths as measured data.
An assembly may replace only opening IDs explicitly named by its recipe. Sign
and canopy positions should remain owned by the storefront anchor.

`entrance_steps()` accepts explicit width, rise, run and maximum step height.
It produces no steps at a zero threshold; it never derives a raised entrance
from pavement pixels. Raised/basement examples need their own supported recipe.

## Validation and review artifacts

```sh
python3 scripts/blender/test-building-apertures.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/test-building-apertures.py
```

The Python run covers six profile/ownership/datum cases. The Blender run adds
six architecture checks: shared wall/finish aperture clearance and volume,
street-zero door clearance through all three layers, true glazing recess,
rotated-frontage shell ownership, angled-return frame/pane manifoldness and
outward normals, and preservation of exact source rear-wall heights.

Successful Blender cases save editable review components under
`artifacts/building-library/apertures/`. `checks.json` records actual unittest
counts, skips, failures and errors. A saved component blend is a review artifact,
not acceptance of a real building's resemblance or runtime budget.
