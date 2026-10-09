#!/usr/bin/env python3
"""Resolve an adjacent cached address/owner/frontage; never infer a house style."""
import argparse
import hashlib
import json
import math
from cached_owner import resolve_cached_owner
from datetime import datetime, timezone
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--address', required=True)
p.add_argument('--pand-id', help='Explicit physical owner within a multi-Pand official address')
p.add_argument('--anchor', required=True, help='Single-owner existing trial inventory')
p.add_argument('--side', choices=['left', 'right'], required=True)
p.add_argument('--output', required=True)
p.add_argument('--frontage-rd', help='Explicit source-selected two native endpoints as JSON; not an adjacency claim')
p.add_argument('--cache', default='.worktrees/amsterdam-facade-rebuild/.cache/city-appearance/areas/jordaan-sample-v1/raw')
a = p.parse_args()
output = Path(a.output)
if output.exists():
    raise SystemExit('Refusing to overwrite an existing trial')
street, number = a.address.rsplit(' ', 1)
if not number.isdigit():
    raise SystemExit('Select an explicit base house number')
cache = Path(a.cache)
digest = lambda data: hashlib.sha256(data).hexdigest()

def features(pattern):
    for file in sorted(cache.glob(pattern)):
        try:
            data = json.loads(file.read_text())
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            for feature in data.get('features', []):
                yield file, feature

vbos = list(features('addresses*.json'))
selected = [(f, v) for f, v in vbos if v['properties'].get('status') == 'Verblijfsobject in gebruik'
            and v['properties'].get('openbare_ruimte_naam') == street
            and str(v['properties'].get('huisnummer')) == number]
try:
    pand_path, pand, selected, address_parents = resolve_cached_owner(selected, list(features('bag-*.json')), a.pand_id)
except ValueError as error:
    raise SystemExit(str(error)) from error
parent_uuid = pand['id']
pid = pand['properties']['identificatie']
child_ids = {url.rsplit('/', 1)[-1] for url in pand['properties'].get('verblijfsobject.href', [])}
if any(v['id'] not in child_ids for _, v in selected):
    raise SystemExit('Official address/Pand join is not reciprocal')
aliases = sorted({v['properties']['openbare_ruimte_naam'] + ' ' + str(v['properties']['huisnummer'])
                  for _, v in vbos if v['id'] in child_ids and v['properties'].get('status') == 'Verblijfsobject in gebruik'
                  and parent_uuid in {url.rsplit('/', 1)[-1] for url in v['properties'].get('pand.href', [])}})
anchor_bytes = Path(a.anchor).read_bytes()
anchors = json.loads(anchor_bytes)['entries']
if len(anchors) != 1 or anchors[0]['cachedOwnerId'] == pid:
    raise SystemExit('Select one different physical anchor owner')
anchor = anchors[0]
left, right = anchor['orderedFrontageRD']
dx, dy = right['x'] - left['x'], right['y'] - left['y']
length = math.hypot(dx, dy)
if length <= 0:
    raise SystemExit('Degenerate anchor frontage')
join = left if a.side == 'left' else right
native_matches = []
for file in sorted(cache.glob('3dbag-*.json')):
    data = file.read_bytes()
    if pid.encode() not in data:
        continue
    collection = json.loads(data)
    for feature in collection.get('features', []):
        if feature['id'] == 'NL.IMBAG.Pand.' + pid:
            native_matches.append((file, data, collection, feature))
if len(native_matches) != 1:
    raise SystemExit('No unique cached native owner')
native_path, native_bytes, collection, feature = native_matches[0]
transform = collection['metadata']['transform']
vertices = [[x * transform['scale'][i] + transform['translate'][i] for i, x in enumerate(v)] for v in feature['vertices']]
rings = []
for obj in feature['CityObjects'].values():
    for geometry in obj.get('geometry', []):
        if str(geometry['lod']) != '2.2':
            continue
        for si, shell in enumerate(geometry['boundaries']):
            for fi, face in enumerate(shell):
                semantic = geometry['semantics']['surfaces'][geometry['semantics']['values'][si][fi]]
                if semantic['type'] == 'GroundSurface':
                    rings.append([vertices[i][:2] for i in face[0]])
nearest = sorted((math.hypot(v[0] - join['x'], v[1] - join['y']), ri, vi)
                 for ri, ring in enumerate(rings) for vi, v in enumerate(ring))
if (not nearest or nearest[0][0] > .1) and not a.frontage_rd:
    detail = dict(address=a.address, pandId=pid, addresses=aliases,
                  anchorEndpointRD=join, nativeSource=str(native_path),
                  nearestDistanceM=nearest[0][0] if nearest else None,
                  nearestGroundVertexRD=rings[nearest[0][1]][nearest[0][2]] if nearest else None)
    raise SystemExit('Target does not adjoin the selected anchor endpoint; select source frontage explicitly: ' + json.dumps(detail))
if not nearest:
    raise SystemExit('Missing native ground ring')
distance, ri, vi = nearest[0]
if a.frontage_rd:
    explicit = json.loads(a.frontage_rd)
    if not isinstance(explicit, list) or len(explicit) != 2 or any(not isinstance(v, list) or len(v) != 2 or any(not isinstance(c, (int, float)) or not math.isfinite(c) for c in v) for v in explicit):
        raise SystemExit('Explicit frontage requires two finite RD points')
    matches = [(i, ring) for i, ring in enumerate(rings) if all(any(math.dist(p, v) < 1e-5 for v in ring) for p in explicit)]
    if len(matches) != 1 or math.dist(*explicit) <= .1:
        raise SystemExit('Explicit frontage endpoints must select one exact native ground ring')
    ri, ring = matches[0]
    front = [next(v for v in ring if math.dist(p, v) < 1e-5) for p in explicit]
    if (front[1][0] - front[0][0]) * dx + (front[1][1] - front[0][1]) * dy <= 0:
        raise SystemExit('Explicit frontage must follow the reviewed left-to-right street direction')
else:
    end = rings[ri][vi]
    sign = -1 if a.side == 'left' else 1
    candidates = []
    for point in rings[ri]:
        vx, vy = point[0] - end[0], point[1] - end[1]
        along = (vx * dx + vy * dy) / length
        cross = abs(vx * dy - vy * dx) / length
        if sign * along > .1 and cross <= .08:
            candidates.append((sign * along, point))
    if not candidates:
        nearby = sorted((dict(pointRD=point, distanceM=math.dist(point, end),
                              alongM=sign * ((point[0]-end[0])*dx+(point[1]-end[1])*dy)/length,
                              crossM=abs((point[0]-end[0])*dy-(point[1]-end[1])*dx)/length)
                         for point in rings[ri] if math.dist(point,end)>.1), key=lambda p:p['distanceM'])[:6]
        detail = dict(address=a.address,pandId=pid,addresses=aliases,nativeSource=str(native_path),
                      nearestDistanceM=distance,nearestGroundVertexRD=end,nearbyGroundVertices=nearby)
        raise SystemExit('No supported continuation along source frontage; select curved/corner frontage explicitly: ' + json.dumps(detail))
    other = max(candidates, key=lambda item: item[0])[1]
    front = [other, end] if a.side == 'left' else [end, other]
entry = dict(address=a.address, addresses=aliases, cachedOwnerId=pid,
             selectedFacade=pid + ':e:neighbor-perspective', orderedFrontageRD=[dict(x=v[0], y=v[1]) for v in front], images=[],
             nativeRawSource=dict(path=str(native_path), sha256=digest(native_bytes), featureIds=[feature['id']], state='Cached exact owner; no new request'),
             sourceSelection=('Official reciprocal parent with explicit source-selected native endpoints; adjacency not claimed' if a.frontage_rd else 'Official reciprocal parent and native ground-ring adjacency candidate; reference/roof inspection required'),
             seedProvenance=dict(anchorPath=str(Path(a.anchor).resolve()), anchorSha256=digest(anchor_bytes), anchorOwner=anchor['cachedOwnerId'], side=a.side,
                                 explicitPandId=a.pand_id, officialAddressParentUuids=address_parents,
                                 pandPath=str(pand_path), pandSha256=digest(pand_path.read_bytes()), vboPaths=sorted({str(f) for f, _ in selected}),
                                 joinDistanceM=distance, groundPolygonIndex=ri, adjacencyLimitM=.1, continuationLineToleranceM=.08,
                                 selectionMethod='explicit-native-endpoints' if a.frontage_rd else 'adjacent-ground-continuation'))
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(dict(schemaVersion=1, selectionStartedAt=datetime.now(timezone.utc).isoformat(),
                                 status='seeded-source-candidate-not-acceptance', entries=[entry]), indent=2) + '\n')
print(json.dumps(dict(pandId=pid, addresses=aliases, widthM=math.dist(*front), joinDistanceM=distance, output=str(output), networkRequests=0)))
