"""Original plan ownership; source footprints/heights stay unchanged."""
import json
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
root = Path(__file__).resolve().parent
survey = json.loads((root / 'melkweg-footprints.json').read_text())
high = [p for p in survey['parts'] if p['id'].startswith('east-high-hall')]
plan = lambda p: Polygon(p['ring'], p.get('holes', []))
floor = unary_union([plan(p) for p in high])
core = next(p for p in survey['parts'] if p['id'] == 'modern-glazed-lower-core')
remaining = plan(core).difference(floor)
polys = [] if remaining.is_empty else ([remaining] if remaining.geom_type == 'Polygon' else list(remaining.geoms))
polys = [p for p in polys if p.area > 1e-9]  # negligible overlay arithmetic residue
data = {'roofOverrides': {core['id']: [{'ring': list(p.exterior.coords)[:-1], 'holes': [list(h.coords)[:-1] for h in p.interiors]} for p in polys]},
        'shellBottomOwnedByCeiling': [p['id'] for p in high],
        'ledger': {'coreRoofArea': plan(core).area, 'coreRoofRemovedArea': plan(core).intersection(floor).area, 'coreRoofRemainingArea': remaining.area,
                   'ceilingSoleOwnerArea': sum(plan(p).area for p in high), 'planesM': [15, 18.3],
                   'rule': '15m dark cantilever floor replaces intersecting generic core roof; 18.3m explicit dark ceiling replaces matching high-shell bottom caps.'}}
(root / 'melkweg-top-ownership.json').write_text(json.dumps(data, indent=2) + '\n')
print(data['ledger'])
