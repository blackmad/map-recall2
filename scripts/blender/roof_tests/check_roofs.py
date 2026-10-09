#!/usr/bin/env python3
"""Independent geometry invariants for authored roofs; no Blender dependency."""
import argparse
from collections import Counter
import copy
import json
import math
from pathlib import Path
import sys

BLENDER_SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BLENDER_SCRIPTS))
from building_lib.polygons import area, cross, triangulate
from building_lib.roof_surfaces import boundary_infill, compile_roof, silhouette_height
from building_lib.gables import profile as gable_profile
from building_lib.ir import resolve


def normal(a, b, c):
    u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    return (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])


def on_segment(point, a, b, tolerance=1e-6):
    if abs(cross(a, b, point)) > tolerance * max(1, math.dist(a[:2], b[:2])):
        return False
    return all(min(a[i], b[i]) - tolerance <= point[i] <= max(a[i], b[i]) + tolerance for i in (0, 1))


def clip_reference(polygon, a, b):
    """Independent convex clip, used for projected coverage and intersections."""
    output = []
    for p, q in zip(polygon, polygon[1:] + polygon[:1]):
        dp, dq = cross(a, b, p), cross(a, b, q)
        if dp >= -1e-10:
            output.append(p)
        if (dp > 1e-10 and dq < -1e-10) or (dp < -1e-10 and dq > 1e-10):
            t = dp / (dp - dq)
            output.append((p[0] + t*(q[0]-p[0]), p[1] + t*(q[1]-p[1])))
    return output


def overlap_area(first, second):
    intersection = first
    for a, b in zip(second, second[1:] + second[:1]):
        intersection = clip_reference(intersection, a, b)
        if len(intersection) < 3:
            return 0
    return abs(area(intersection))


def fixtures():
    def recipe(name, ring, profile, kind='pitched'):
        return {'id': name, 'synthetic': True, 'footprint': ring,
                'frontages': [{'width': 6}], 'gable': {'profile': profile},
                'roof': {'kind': kind, 'eaves': 8, 'top': 11 if kind != 'flat' else 8,
                         'setback': .24, 'status': 'synthetic'}}
    rectangle = [[0, 0], [6, 0], [6, 10], [0, 10]]
    concave = [[0, 0], [6, 0], [6, 10], [4, 10], [4, 5], [2, 5], [2, 10], [0, 10]]
    gable = [[0, 8], [3, 11], [6, 8]]
    narrow = recipe('explicit-narrow-pitched-volume', rectangle,
                    [[0,8],[2,8],[2.5,11.3],[3.5,11.3],[4,8],[6,8]])
    narrow['roof'].update(pitchSpan=[2,4],ridgeX=3)
    asymmetric = recipe('explicit-asymmetric-ridge', concave, gable)
    asymmetric['roof'].update(pitchSpan=[0,6],ridgeX=2.2)
    gambrel = recipe('gambrel-warehouse', rectangle,
                     [[0,8],[1,10],[3,11],[5,10],[6,8]], 'gambrel')
    gambrel['roof'].update(kneeSpan=[1,5],kneeHeight=10)
    concave_gambrel = copy.deepcopy(gambrel)
    concave_gambrel.update(id='gambrel-concave-footprint',footprint=concave)
    hip = recipe('hip-ordinary-house', rectangle, [[0,8],[6,8]], 'hip')
    hip['roof']['hipEndRun'] = 3
    asymmetric_hip = copy.deepcopy(hip)
    asymmetric_hip.update(id='hip-asymmetric-ridge')
    asymmetric_hip['roof']['ridgeX'] = 2
    clockwise_hip = copy.deepcopy(hip)
    clockwise_hip.update(id='hip-collinear-clockwise-footprint',
                         footprint=[[0,0],[0,10],[3,10],[6,10],[6,0],[3,0]])
    mansard = recipe('mansard-independent-volume',rectangle,[[0,8],[6,8]],'mansard')
    mansard['roof'].update(kneeInset=.72,topInset=1.35,kneeHeight=10.28)
    taxonomy = [recipe('taxonomy-'+family+('-raised' if raised else ''),rectangle,gable_profile(family,6,8,3,raised))
                for family,raised in [('spout',0),('neck',0),('neck',.8),('bell',.8)]]
    return [
        recipe('concave-pitched', concave, gable),
        recipe('concave-flat', concave, [[0, 8], [6, 8]], 'flat'),
        recipe('concave-shed', concave, [[0, 8], [6, 8]], 'shed'),
        recipe('stepped-gable', rectangle, [[0, 8], [1, 8], [1, 9], [2, 9], [2, 10], [4, 10], [4, 9], [5, 9], [5, 8], [6, 8]]),
        recipe('reentrant-gable', rectangle, [[0, 8], [1, 8.8], [2, 8.8], [2.2, 10], [1.9, 10.3], [3, 11.3], [4.1, 10.3], [3.8, 10], [4, 8.8], [5, 8.8], [6, 8]]),
        recipe('straight-cornice-pitched', rectangle, [[0, 8], [6, 8]]),
        recipe('clockwise-footprint', list(reversed(concave)), gable),
        recipe('rear-wing-outside-frontage', [[0, 0], [6, 0], [6, 4], [9, 4], [9, 10], [-2, 10], [-2, 4], [0, 4]], gable),
        narrow,
        asymmetric,
        gambrel,
        concave_gambrel,
        hip,
        asymmetric_hip,
        clockwise_hip,
        mansard,
    ] + taxonomy


def inspect(recipe):
    surface = compile_roof(recipe)
    ring, errors = recipe['footprint'], []
    projected = []
    for i, face in enumerate(surface.triangles):
        points = [surface.vertices[j] for j in face]
        n = normal(*points)
        if not all(math.isfinite(value) for point in points for value in point):
            errors.append(f'triangle {i}: nonfinite vertex')
        if n[2] <= 1e-10:
            errors.append(f'triangle {i}: degenerate or downward-facing covering')
        projected.append([p[:2] for p in points])
    edges = Counter(tuple(sorted((a,b))) for face in surface.triangles for a,b in zip(face,face[1:]+face[:1]))
    if any(count > 2 for count in edges.values()):
        errors.append('covering nonmanifold edge')
    front_edges = 0
    for ai, bi in surface.boundary:
        a, b = surface.vertices[ai], surface.vertices[bi]
        front = abs(a[1]-surface.setback) < 1e-6 and abs(b[1]-surface.setback) < 1e-6
        if front:
            front_edges += 1
        elif not any(on_segment(a,p,q) and on_segment(b,p,q) for p,q in zip(ring,ring[1:]+ring[:1])):
            errors.append(f'internal crack between vertices {ai}/{bi}')
    # Detect T junctions even if an area comparison masks a zero-width crack.
    t_junctions = 0
    for a,b in edges:
        p,q = surface.vertices[a],surface.vertices[b]
        for i,r in enumerate(surface.vertices):
            if i in (a,b) or not on_segment(r,p,q,1e-7):
                continue
            dx,dy = q[0]-p[0],q[1]-p[1]
            t = ((r[0]-p[0])*dx+(r[1]-p[1])*dy)/(dx*dx+dy*dy)
            if 1e-7 < t < 1-1e-7 and abs(r[2]-(p[2]+t*(q[2]-p[2]))) < 1e-7:
                t_junctions += 1
    if t_junctions:
        errors.append(f'{t_junctions} unsplit edge/vertex T junctions')
    expected = 0
    for face in triangulate(ring):
        clipped = clip_reference([ring[i] for i in face], (0,surface.setback),(1,surface.setback))
        if len(clipped) >= 3:
            expected += abs(area(clipped))
    covered = sum(abs(area(face)) for face in projected)
    if abs(covered-expected) > 1e-6:
        errors.append(f'coverage area {covered} != footprint after setback {expected}')
    overlap = 0
    for i,first in enumerate(projected):
        for second in projected[i+1:]:
            overlap += overlap_area(first,second)
    if overlap > 1e-6:
        errors.append(f'projected overlapping area {overlap}')
    if min(v[1] for v in surface.vertices) < surface.setback-1e-7:
        errors.append('roof crosses facade back plane')
    if min(v[2] for v in surface.vertices) < surface.eaves-1e-7:
        errors.append('roof crosses below body eaves')
    if recipe['roof']['kind'] in ('pitched', 'gambrel'):
        for ai,bi in surface.boundary:
            a,b = surface.vertices[ai],surface.vertices[bi]
            if abs(a[1]-surface.setback)>1e-6 or abs(b[1]-surface.setback)>1e-6:
                continue
            for t in (0,.25,.5,.75,1):
                x,z = a[0]+t*(b[0]-a[0]),a[2]+t*(b[2]-a[2])
                limit = silhouette_height(recipe['gable']['profile'],x)
                if limit is not None and z > limit+1e-7:
                    errors.append(f'roof crosses front silhouette at {x}')
    infill_vertices,infill_faces = boundary_infill(surface,recipe['roof']['kind']=='shed')
    for i,face in enumerate(infill_faces):
        n = normal(*(infill_vertices[j] for j in face))
        if math.sqrt(sum(value*value for value in n)) < 1e-9:
            errors.append(f'infill triangle {i}: degenerate')
    chimney = recipe.get('details',{}).get('chimney')
    if chimney:
        try:
            surface.height(chimney['x'],chimney['y'])
        except ValueError as error:
            errors.append(str(error))
    return {'id':recipe['id'],'status':'pass' if not errors else 'fail',
            'vertices':len(surface.vertices),'coveringTriangles':len(surface.triangles),
            'infillTriangles':len(infill_faces),'boundaryEdges':len(surface.boundary),
            'facadeOwnedEdges':front_edges,'expectedProjectedAreaM2':expected,
            'coverageErrorM2':covered-expected,'overlapAreaM2':overlap,
            'tJunctions':t_junctions,'errors':errors}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=Path('artifacts/building-library/roof-tests/geometry-report.json'))
    args = parser.parse_args()
    recipes = [json.loads(p.read_text()) for p in sorted((BLENDER_SCRIPTS/'building_lib/recipes').glob('*.json'))]
    recipes += [json.loads(p.read_text()) for p in sorted((BLENDER_SCRIPTS/'building_lib/fixtures/roof-components').glob('*.json'))
                if p.name != 'manifest.json']
    checks = [inspect(resolve(recipe)) for recipe in recipes] + [inspect(recipe) for recipe in fixtures()]
    rejected = []
    invalid = [
        ('unknown-family', {'roof': {'kind':'onion','eaves':8,'top':11}}),
        ('hip-concave-footprint', {'roof': {'kind':'hip','eaves':8,'top':11,'hipEndRun':3}}),
        ('courtyard', {'holes': [[[1,1],[2,1],[2,2]]]}),
        ('invalid-transition', {'roof': {'kind':'pitched','eaves':8,'top':11,'frontTransition':0}}),
        ('setback-removes-roof', {'roof': {'kind':'pitched','eaves':8,'top':11,'setback':100}}),
        ('setback-crosses-facade', {'roof': {'kind':'pitched','eaves':8,'top':11,'setback':.1}}),
        ('missing-front-profile', {'gable': {'profile': []}}),
        ('nonfinite-height', {'roof': {'kind':'pitched','eaves':8,'top':float('nan')}}),
        ('ridge-outside-pitch-span', {'roof': {'kind':'pitched','eaves':8,'top':11,'pitchSpan':[2,4],'ridgeX':5}}),
        ('gambrel-missing-knees', {'roof': {'kind':'gambrel','eaves':8,'top':11}}),
        ('gambrel-reversed-knees', {'roof': {'kind':'gambrel','eaves':8,'top':11,'kneeSpan':[5,1],'kneeHeight':10}}),
        ('gambrel-shallow-lower-pitch', {'roof': {'kind':'gambrel','eaves':8,'top':11,'kneeSpan':[1,5],'kneeHeight':8.5}}),
        ('mansard-concave-footprint', {'roof': {'kind':'mansard','eaves':8,'top':11,'kneeInset':.72,'topInset':1.35,'kneeHeight':10.28}}),
    ]
    for name, change in invalid:
        recipe = copy.deepcopy(fixtures()[0]);recipe.update(change)
        try:
            compile_roof(recipe)
            rejected.append({'id':name,'status':'fail','reason':'accepted unsupported input'})
        except ValueError as error:
            rejected.append({'id':name,'status':'pass','reason':str(error)})
    for name,changes in [('hip-missing-end-run',{'hipEndRun':None}),
                         ('hip-excessive-end-run',{'hipEndRun':6}),
                         ('hip-zero-rise',{'top':8}),
                         ('hip-invented-pitch-span',{'pitchSpan':[1,5]})]:
        recipe = copy.deepcopy(next(r for r in fixtures() if r['id']=='hip-ordinary-house'))
        recipe['roof'].update(changes)
        try:
            compile_roof(recipe)
            rejected.append({'id':name,'status':'fail','reason':'accepted invalid hip'})
        except ValueError as error:
            rejected.append({'id':name,'status':'pass','reason':str(error)})
    # An attachment query outside the roof must fail instead of floating on an
    # extrapolated height function, even if the point lies in the footprint bbox.
    notch = compile_roof(fixtures()[0])
    try:
        notch.height(3,8)
        rejected.append({'id':'chimney-in-footprint-notch','status':'fail'})
    except ValueError as error:
        rejected.append({'id':'chimney-in-footprint-notch','status':'pass','reason':str(error)})
    # Known construction heights away from the front join establish that the
    # warehouse has real broken pitches rather than a relabelled simple gable.
    gambrel = compile_roof(next(r for r in fixtures() if r['id']=='gambrel-warehouse'))
    samples = [(0,8),(.5,9),(1,10),(2,10.5),(3,11),(4,10.5),(5,10),(5.5,9),(6,8)]
    errors = [f'x={x}: {gambrel.height(x,8)} != {z}' for x,z in samples
              if abs(gambrel.height(x,8)-z)>1e-7]
    checks.append({'id':'gambrel-independent-height-samples','status':'fail' if errors else 'pass','errors':errors})
    hip = compile_roof(next(r for r in fixtures() if r['id']=='hip-ordinary-house'))
    samples = [(0,5,8),(3,.24,8),(3,1.24,9),(3,3.24,11),
               (3,7,11),(3,9,9),(3,10,8),(1,5,9),(6,5,8)]
    errors = [f'({x},{y}): {hip.height(x,y)} != {z}' for x,y,z in samples
              if abs(hip.height(x,y)-z)>1e-7]
    checks.append({'id':'hip-independent-height-samples','status':'fail' if errors else 'pass','errors':errors})
    mansard = compile_roof(next(r for r in fixtures() if r['id']=='mansard-independent-volume'))
    samples = [(0,5,8),(.36,5,9.14),(.72,5,10.28),(1.35,5,11),
               (3,5,11),(3,.24,8),(3,.96,10.28),(6,5,8),(3,10,8)]
    errors = [f'({x},{y}): {mansard.height(x,y)} != {z}' for x,y,z in samples
              if abs(mansard.height(x,y)-z)>1e-7]
    checks.append({'id':'mansard-independent-height-samples','status':'fail' if errors else 'pass','errors':errors})
    passed = all(row['status']=='pass' for row in checks+rejected)
    report = {'status':'pass' if passed else 'fail','checks':checks,'rejectedInputs':rejected,
              'contracts':['covering is an open triangular surface, not a closed solid',
                           'facade exclusively owns the pitched/flat front closure',
                           'footprint, eaves and independent gable heights are unchanged',
                           'hidden roof structure and front join remain inferred'],
              'limitations':['courtyard/multiple volumes and concave hips/mansards unsupported',
                             'numerical checks do not establish photographic fidelity']}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    for row in checks+rejected:
        print(row['id'],row['status'],row.get('errors',row.get('reason','')))
    return 0 if passed else 1

if __name__ == '__main__':
    raise SystemExit(main())
