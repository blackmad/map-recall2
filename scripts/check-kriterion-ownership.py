"""Source ownership and complete runtime projection checks. Requires Shapely.

Run the TS runtime-footprint decoder first; keep its source/output as evidence.
This checks identity scope without widening replacement suppression.
"""
import json
import math
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union

folder = Path('artifacts/kriterion-feedback-oct7')
audit = json.loads(Path('scripts/landmarks/kriterion-ownership-research.json').read_text())
proposal = json.loads((folder / 'kriterion-proposed-spec.json').read_text())
assert proposal['suppressOsmIds'] == ['w268999077', 'NL.IMBAG.Pand.0363100012253901']
parts = {part['id']: part for part in audit['parts']}
front = parts['NL.IMBAG.Pand.0363100012253901']
assert front['baselineHouseFractionCovered'] > .999
assert front['repairedHouseFractionCovered'] > .999
official = {part['id']: part for part in audit['currentOfficialParts']}
assert official['0363100012253901']['fractionInsideOsmScope'] > .99
assert official['0363100012181099']['outsideScopeMetres2'] > 70
assert official['0363100012181101']['fractionInsideOsmScope'] == 0

spec = json.loads((folder / 'kriterion-spec.json').read_text())
lon, lat = spec['surveyed']['anchor']
footprints = json.loads(Path('scripts/landmarks/retail-cinema-footprints.json').read_text())
source = next(item for item in footprints if item['id'] == 'kriterion')
scope = Polygon([((p[0]-lon)*111320*math.cos(math.radians(lat)), (p[1]-lat)*111320) for p in source['ring']])
proof = []
for state, name in [('before', 'runtime-projected-before.json'), ('after', 'runtime-projected-mesh.json')]:
    mesh = json.loads((folder / name).read_text())
    masonry, all_geometry = [], []
    for triangle in mesh['triangles']:
        polygon = Polygon([point[:2] for point in triangle['points']])
        if polygon.area > 1e-9:
            all_geometry.append(polygon)
            if triangle['material'] == 'brick':
                masonry.append(polygon)
    body, whole = unary_union(masonry), unary_union(all_geometry)
    row = dict(state=state, runtimeRotationDegrees=mesh['placement']['modelRotationDegrees'],
               sourceScopeAreaMetres2=scope.area, masonryProjectedAreaMetres2=body.area,
               masonryCoverageOfOsm=scope.intersection(body).area/scope.area,
               masonryOutsideOsmMetres2=body.difference(scope).area,
               masonryMissingSourceMetres2=scope.difference(body).area,
               allGeometryProjectedAreaMetres2=whole.area,
               allGeometryOutsideOsmMetres2=whole.difference(scope).area)
    proof.append(row)
    # Complete decoded footprint, not a few front samples: wrong yaw cannot
    # achieve this coverage. Small compressed-edge loss remains reported.
    assert row['masonryCoverageOfOsm'] > .999
    assert row['masonryOutsideOsmMetres2'] < .6
(folder / 'runtime-footprint-proof.json').write_text(json.dumps(proof, indent=2)+'\n')
print(json.dumps(dict(frontOwnership='legacy and repaired house both wholly within Pand2253901',
                     aliases=proposal['suppressOsmIds'], runtimeFootprints=proof,
                     remainingFailure='Rear Pand1099 includes unmodeled residential space and must remain; full visual acceptance pending'), indent=2))
