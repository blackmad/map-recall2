"""Blender roof assembly; facade owns the street silhouette and front closure."""
from .roof_surfaces import compile_roof, boundary_infill, roof_height, silhouette_height


def build_roof(recipe, roof, wall):
    from .geometry import mesh

    surface = compile_roof(recipe)
    covering = mesh('Roof / continuous triangulated covering', surface.vertices,
                    surface.triangles, roof)
    covering['roofKind'] = recipe['roof']['kind']
    covering['roofJoin'] = {
        'pitched': 'planar front ramp capped by main pitch',
        'gambrel': 'planar front ramp capped by explicit broken pitches',
        'hip': 'four authored hip planes over the rectangular owner footprint',
        'flat': 'constant height behind facade',
        'shed': 'shed planes with end closure behind facade',
        'mansard': 'authored nested rectangular broken pitches with upper deck',
    }[recipe['roof']['kind']]
    if recipe['roof'].get('frontJoin')=='hip':covering['roofJoin']='one transverse front hip plane capped by main longitudinal pitches'
    covering['roofEvidenceStatus'] = recipe['roof'].get('status', 'unknown')
    vertices, triangles = boundary_infill(surface, close_front=recipe['roof']['kind'] == 'shed')
    if triangles:
        mesh('Roof / rear-side infill', vertices, triangles, wall)
    return surface.height


def build_details(recipe, height, wall, roof, frame, glass, iron, stone):
    """Compose optional finishes against the exact covering returned above."""
    from . import roof_details
    surface = height.__self__
    spec, details = recipe['roof'], recipe.get('details', {})
    if details.get('coveringThickness'):
        import bpy
        for obj in bpy.context.scene.objects:
            if obj.name.startswith('Roof / continuous triangulated covering'):
                roof_details.thicken_covering(obj, details['coveringThickness'])
    if details.get('gutters'):
        roof_details.surface_gutters(surface, iron, details['gutters'])
    chimney = details.get('chimney')
    if chimney:
        roof_details.chimney(surface, chimney['x'], chimney['y'], wall, stone,
                             chimney.get('size', .42), chimney.get('height', .85))
    for item in details.get('dormers', []):
        roof_details.dormer(surface,item['x'],item['y'],item['width'],item['height'],wall,roof,frame,glass)
    if details.get('ridgeCap'):
        from .attachment_contracts import ridge_support
        x,front,back,z=ridge_support(recipe,surface)
        roof_details.ridge_cap(x,front,back,z,roof)
