#!/usr/bin/env python3
"""Pure diagnostic of the captured baseline's exporter-dependent roof facets."""
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from baseline_covering import patches
from building_lib.roof_surfaces import compile_roof
from check_roofs import normal


def deviation(points):
    for i in range(1,len(points)-1):
        vector = normal(points[0],points[i],points[i+1])
        magnitude = math.sqrt(sum(value*value for value in vector))
        if magnitude > 1e-9:
            return max(abs(sum(vector[j]*(p[j]-points[0][j]) for j in range(3)))/magnitude for p in points)
    return 0


def main():
    rows = []
    for path in sorted((ROOT/'scripts/blender/building_lib/recipes').glob('*.json')):
        recipe = json.loads(path.read_text())
        before = patches(recipe)
        surface = compile_roof(recipe)
        after = [[surface.vertices[i] for i in face] for face in surface.triangles]
        old_errors,new_errors = [deviation(p) for p in before],[deviation(p) for p in after]
        row = {'id':recipe['id'],
               'before':{'coveringPolygons':len(before),
                         'nominalTriangulatedCoveringFaces':sum(len(p)-2 for p in before),
                         'nonplanarPolygons':sum(d>1e-6 for d in old_errors),
                         'maxPlaneDeviationM':max(old_errors)},
               'after':{'coveringTriangles':len(after),'nonplanarPolygons':sum(d>1e-6 for d in new_errors),'maxPlaneDeviationM':max(new_errors)}}
        rows.append(row)
        print(json.dumps(row))
    output = ROOT/'artifacts/building-library/roof-tests/baseline-planarity-diagnostic.json'
    output.write_text(json.dumps({'basis':'Captured foundation covering algorithm before this task; Blender scene comparison is separate','checks':rows},indent=2)+'\n')

if __name__ == '__main__':
    main()
