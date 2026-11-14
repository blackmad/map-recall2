"""Write or replace one centre-venues catalogue entry in src/canalRecall/landmarks/manualCatalogue.json.

  python3 scripts/landmarks/venue-catalogue-entry.py <entry.json>

The entry JSON carries the hand-written fields (id, name, landmarkId, materialOverrides, attribution, heightMetres,
galleryView, headingFrom: [i, j] ring vertices); footprint, surveyed anchor, buildingFootprint, suppressOsmIds and bagYear
come from scripts/landmarks/<id>-footprints.json (venue-prepare.ts). The catalogue round-trips through json indent=1.
"""
import json, math, sys
CAT = 'src/canalRecall/landmarks/manualCatalogue.json'
e = json.load(open(sys.argv[1]))
fp = json.load(open(f"scripts/landmarks/{e['id']}-footprints.json"))
ring = fp['nativeRing']
i, j = e.pop('headingFrom')
a, b = ring[i], ring[j]
tx, tz = b[0] - a[0], b[1] - a[1]
L = math.hypot(tx, tz); tx /= L; tz /= L
us = [p[0] * tx + p[1] * tz for p in ring]; vs = [-p[0] * tz + p[1] * tx for p in ring]
cu, cv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
cx, cz = cu * tx - cv * tz, cu * tz + cv * tx
lat0 = fp['anchor'][1]
m_lat = 111320.0; m_lng = 111320.0 * math.cos(math.radians(lat0))
centre = [round(fp['anchor'][0] + cx / m_lng, 8), round(fp['anchor'][1] - cz / m_lat, 8)]
heading = round((math.degrees(math.atan2(tx, -tz)) + 360) % 360, 2)
entry = {
  'id': e['id'], 'name': e['name'], 'landmarkId': e.get('landmarkId', e['id']),
  'modelUrl': f"./models/{e['id']}.glb",
  'suppressOsmIds': [f"NL.IMBAG.Pand.{p}" for p in fp['pands']] + e.get('extraSuppress', []),
  'spatialSuppression': False,
  'footprint': {'centre': centre, 'headingDegrees': heading, 'lengthMetres': round(max(us) - min(us), 1), 'widthMetres': round(max(vs) - min(vs), 1)},
  'surveyed': {'anchor': fp['anchor'], 'northOffsetDegrees': 0, 'source': e['surveyedSource']},
  'groundAltitudeMetres': 0, 'facingOffsetDegrees': 0, 'heightMetres': e['heightMetres'],
}
if 'galleryView' in e: entry['galleryView'] = e['galleryView']
entry['bagYear'] = fp['pandHeights'][0]['year']
entry['materialOverrides'] = e['materialOverrides']
entry['attribution'] = e['attribution']
entry['buildingFootprint'] = fp['buildingFootprint']
t = open(CAT).read(); cat = json.loads(t)
assert json.dumps(cat, indent=1, ensure_ascii=False) + '\n' == t, 'catalogue no longer round-trips at indent 1'
cat = [x for x in cat if x['id'] != entry['id']] + [entry]
open(CAT, 'w').write(json.dumps(cat, indent=1, ensure_ascii=False) + '\n')
print('wrote', entry['id'], entry['footprint'])
