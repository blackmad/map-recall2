"""Build one source-assisted illustrative facade from a compact JSON recipe.

Usage: blender --background --python scripts/review/build-facade-recipe-blender.py --
  --recipe review-data/facade-assessment/blender-facade-recipe-v1.json
  --out public/data/facade-review-galleries/head-on-3d-v1

This is a deterministic geometry experiment. Its metres and depths are inferred,
not recovered by an image-to-3D model or registered to a BAG owner.
"""
import argparse
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

import bpy


def digest(data):
    return hashlib.sha256(data).hexdigest()


def rgb(hex_colour):
    raw = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in raw)


class MeshGroup:
    def __init__(self, name, kind, colour):
        self.name, self.kind, self.colour = name, kind, colour
        self.vertices, self.triangles = [], []

    def box(self, x0, x1, y0, y1, z0, z1):
        if x1 <= x0 or y1 <= y0 or z1 <= z0:
            raise ValueError(f"Invalid box for {self.name}")
        start = len(self.vertices)
        self.vertices.extend([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                              (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)])
        for tri in [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7),
                    (0, 1, 5), (0, 5, 4), (3, 7, 6), (3, 6, 2),
                    (0, 4, 7), (0, 7, 3), (1, 2, 6), (1, 6, 5)]:
            self.triangles.append(tuple(start + i for i in tri))

    def prism(self, front, back, footprint):
        # footprint is an x/z polygon, wound counter-clockwise viewed from front.
        n = len(footprint)
        if n < 3:
            raise ValueError("Prism requires a polygon")
        start = len(self.vertices)
        self.vertices.extend((x, front, z) for x, z in footprint)
        self.vertices.extend((x, back, z) for x, z in footprint)
        for i in range(1, n - 1):
            self.triangles.extend([(start, start + i, start + i + 1),
                                   (start + n, start + n + i + 1, start + n + i)])
        for i in range(n):
            j = (i + 1) % n
            a, b, c, d = start + i, start + j, start + n + j, start + n + i
            self.triangles.extend([(a, b, c), (a, c, d)])


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--recipe', required=True)
    parser.add_argument('--out', required=True)
    options = parser.parse_args(args)
    recipe_file = Path(options.recipe).resolve()
    recipe_bytes = recipe_file.read_bytes()
    recipe = json.loads(recipe_bytes)
    if recipe.get('version') != 1 or recipe.get('status') != 'source-assisted-inferred-prototype':
        raise ValueError('Unsupported or unlabelled facade recipe')
    for name, key in [('photoPath', 'photoSha256'), ('generatedPath', 'generatedSha256')]:
        value = Path(recipe['source'][name]).resolve().read_bytes()
        if digest(value) != recipe['source'][key]:
            raise ValueError(f"{name} hash mismatch")
    output = Path(options.out).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    width = float(recipe['inference']['assumedFacadeWidthM'])
    height = float(recipe['inference']['assumedFacadeHeightM'])
    thickness = float(recipe['inference']['assumedWallThicknessM'])
    if not 3 <= width <= 20 or not 6 <= height <= 25 or not 0.1 <= thickness <= 1:
        raise ValueError('Unbounded inferred geometry')
    colours = recipe['materialColours']
    groups = {name: MeshGroup(name, kind, colours[name]) for name, kind in [
        ('wall', 'wall'), ('plinth', 'wall'), ('trim', 'detail'), ('glass', 'detail'),
        ('glassFrame', 'detail'), ('metal', 'detail'), ('shopRed', 'detail'), ('roof', 'roof')]}
    wall, trim, glass, frame, metal = (groups[n] for n in ('wall', 'trim', 'glass', 'glassFrame', 'metal'))
    xshift = width / 2
    def box(group, x0, x1, y0, y1, z0, z1):
        group.box(x0 - xshift, x1 - xshift, y0, y1, z0, z1)

    openings = recipe['openings']
    for opening in openings:
        x0, z0, w, h = (float(opening[k]) for k in ('x0', 'z0', 'width', 'height'))
        if x0 < 0 or z0 < 0 or x0 + w > width or z0 + h > height or w < 0.3 or h < 0.5:
            raise ValueError(f"Invalid opening: {opening['id']}")
    # Partition wall at every opening boundary. The skipped cells are actual holes,
    # backed by inset glass/door panels rather than painted-on window rectangles.
    xs = sorted({0.0, width, *(float(o['x0']) for o in openings),
                 *(float(o['x0'] + o['width']) for o in openings)})
    zs = sorted({0.0, height, *(float(o['z0']) for o in openings),
                 *(float(o['z0'] + o['height']) for o in openings)})
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            cx, cz = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if any(o['x0'] < cx < o['x0'] + o['width'] and o['z0'] < cz < o['z0'] + o['height'] for o in openings):
                continue
            box(wall, xs[i], xs[i + 1], -thickness / 2, thickness / 2, zs[j], zs[j + 1])
    box(groups['plinth'], 0, width, -0.19, 0.19, 0, 0.27)
    box(trim, 0, width, -0.23, -0.11, 3.55, 3.72)
    box(trim, 0, width, -0.29, 0.16, height - 0.22, height)

    for opening in openings:
        x0, z0, w, h = (float(opening[k]) for k in ('x0', 'z0', 'width', 'height'))
        x1, z1 = x0 + w, z0 + h
        kind = opening['kind']
        bar = 0.075 if kind in ('window', 'balcony-door') else 0.09
        surround = trim if kind != 'door' else frame
        # Surround sits proud of the front wall; glass is recessed into the void.
        for a, b, c, d in [(x0 - bar, x0, z0 - bar, z1 + bar), (x1, x1 + bar, z0 - bar, z1 + bar),
                           (x0, x1, z0 - bar, z0), (x0, x1, z1, z1 + bar)]:
            box(surround, a, b, -0.25, -0.14, c, d)
        box(glass if kind != 'door' else frame, x0 + 0.025, x1 - 0.025, 0.055, 0.085, z0 + 0.025, z1 - 0.025)
        box(frame, (x0 + x1) / 2 - 0.025, (x0 + x1) / 2 + 0.025, -0.19, 0.065, z0, z1)
        if kind in ('window', 'shop-window'):
            crossbar = z0 + (h * (0.63 if kind == 'window' else 0.68))
            box(frame, x0, x1, -0.19, 0.065, crossbar - 0.027, crossbar + 0.027)
        if kind == 'shop-window':
            box(groups['shopRed'], x0 + 0.08, x1 - 0.08, -0.20, -0.15, z0 + 0.06, z0 + 0.30)
            # Five shallow trim segments suggest the visible arch without closing
            # the rectangular structural aperture or claiming an exact arch curve.
            for k in range(5):
                ax0 = x0 + k * w / 5
                rise = 0.13 * (1 - abs(k - 2) / 2)
                box(trim, ax0, ax0 + w / 5, -0.27, -0.15, z1 + rise, z1 + rise + 0.07)
        if kind in ('window', 'balcony-door'):
            box(trim, x0 - 0.13, x1 + 0.13, -0.27, -0.13, z0 - 0.11, z0 - 0.04)

    for balcony in recipe['balconies']:
        opening = next((o for o in openings if o['id'] == balcony['atOpening']), None)
        if opening is None or opening['kind'] != 'balcony-door':
            raise ValueError('Balcony must attach to a balcony-door opening')
        center = opening['x0'] + opening['width'] / 2
        half = float(balcony['width']) / 2
        z = float(balcony['slabZ'])
        projection = float(balcony['projection'])
        rail_h = float(balcony['railHeight'])
        if not 0.4 <= projection <= 1.5 or not 0.5 <= rail_h <= 1.5:
            raise ValueError('Unbounded balcony projection')
        box(groups['plinth'], center - half, center + half, -projection - 0.19, -0.11, z - 0.14, z + 0.06)
        box(metal, center - half - 0.02, center + half + 0.02,
            -projection - 0.24, -projection - 0.15, z + rail_h, z + rail_h + 0.07)
        for k in range(10):
            x = center - half + 0.05 + k * (2 * half - 0.10) / 9
            box(metal, x - 0.022, x + 0.022, -projection - 0.23, -projection - 0.16,
                z + 0.08, z + rail_h)
        for x in (center - half, center + half):
            box(metal, x - 0.025, x + 0.025, -projection - 0.2, -0.16, z + rail_h - 0.02, z + rail_h + 0.05)

    dormer = recipe['roofDetail']
    dx0, dw, dh = (float(dormer[k]) for k in ('dormerX0', 'dormerWidth', 'dormerHeight'))
    box(groups['roof'], dx0, dx0 + dw, -0.06, 0.52, height, height + dh)
    box(glass, dx0 + 0.21, dx0 + dw - 0.21, -0.18, -0.13, height + 0.25, height + dh - 0.30)
    box(trim, dx0 + 0.15, dx0 + 0.21, -0.23, -0.10, height + 0.20, height + dh - 0.24)
    box(trim, dx0 + dw - 0.21, dx0 + dw - 0.15, -0.23, -0.10, height + 0.20, height + dh - 0.24)
    groups['roof'].prism(-0.19, 0.60, [(dx0 - xshift - 0.10, height + dh),
                                       (dx0 - xshift + dw + 0.10, height + dh),
                                       (dx0 - xshift + dw / 2, height + dh + 0.34)])

    scene_meshes = []
    for group in groups.values():
        if not group.vertices:
            continue
        mesh = bpy.data.meshes.new(group.name)
        mesh.from_pydata(group.vertices, [], group.triangles)
        mesh.update()
        obj = bpy.data.objects.new(group.name, mesh)
        bpy.context.collection.objects.link(obj)
        material = bpy.data.materials.new(group.name)
        material.diffuse_color = (*rgb(group.colour), 1)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*rgb(group.colour), 1)
        bsdf.inputs['Roughness'].default_value = 0.72 if group.name != 'glass' else 0.20
        mesh.materials.append(material)
        scene_meshes.append({'id': group.name, 'kind': group.kind, 'textured': False,
                             'colour': group.colour,
                             'positions': [n for x, y, z in group.vertices for n in (x, z, -y)],
                             'indices': [n for tri in group.triangles for n in tri]})
    glb = output / 'blender-facade.glb'
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True)
    shutil.copyfile(recipe_file, output / 'recipe.json')
    scene = {'version': 1, 'id': 'recipe', 'label': 'Blender recipe · one facade',
             'policy': recipe['policy'], 'sourceImage': recipe['source']['sourceImageUrl'],
             'generatedImage': recipe['source']['generatedImageUrl'],
             'recipeSha256': digest(recipe_bytes), 'glbSha256': digest(glb.read_bytes()),
             'meshes': scene_meshes,
             'camera': {'position': [0, 8, 25], 'target': [0, 8, 0]},
             'focusBounds': {'min': [-width / 2 - 0.2, 0, -0.7],
                             'max': [width / 2 + 0.2, height + dh + 0.5, 1.1]}}
    (output / 'blender-recipe-scene.json').write_text(json.dumps(scene, separators=(',', ':')) + '\n')
    print(json.dumps({'glb': str(glb), 'glbSha256': scene['glbSha256'],
                      'meshes': len(scene_meshes), 'triangles': sum(len(g.triangles) for g in groups.values()),
                      'recipeSha256': scene['recipeSha256']}))


if __name__ == '__main__':
    main()
