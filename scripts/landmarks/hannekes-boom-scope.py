"""Reproduce held Hannekes Boom scope from installed extracts, without runtime registration."""
import gzip, hashlib, json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
MODEL = 'hannekes-boom'
ANCHOR = [52.3762934, 4.9116163]
PAND = 'NL.IMBAG.Pand.0363100012238899'
TILE = 'public/data/extracts/amsterdam/building-tiles/14/8415/5383.geojson.gz'
BRANDS = 'public/data/extracts/amsterdam/branded-pois.json'

def read(path):
    p = ROOT / path
    return json.loads(gzip.open(p).read() if p.suffix == '.gz' else p.read_text())

def inside(lon, lat, ring):
    odd = False
    for a,b in zip(ring,ring[1:]):
        if (a[1] > lat) != (b[1] > lat) and lon < (b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0]:
            odd = not odd
    return odd

def local(p):
    return [(p[0]-ANCHOR[1])*111320*math.cos(math.radians(ANCHOR[0])), (p[1]-ANCHOR[0])*111320]

def area(ring):
    q = [local(p) for p in ring]
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(q,q[1:])))/2

brands = read(BRANDS)
# The branded extract is a plain list; retain its genuine identity, do not fabricate an extract_landmarks ID.
poi = next(p for p in brands if p.get('name') == 'Hannekes Boom')
features = read(TILE)['features']
main = next(f for f in features if f['properties']['id'] == PAND)
ring = main['geometry']['coordinates'][0]
assert inside(ANCHOR[1], ANCHOR[0], ring), 'Venue point must be inside candidate scope'
neighbors = []
for f in features:
    if f['properties']['id'] == PAND or f['geometry']['type'] != 'Polygon':
        continue
    points = f['geometry']['coordinates'][0][:-1]
    xy = [local(p) for p in points]
    distance = math.hypot(sum(p[0] for p in xy)/len(xy), sum(p[1] for p in xy)/len(xy))
    if distance < 90:
        neighbors.append({'distanceFromAnchorM': round(distance,2), 'feature': f, 'treatment': 'retain; not proven to belong to pavilion'})
record = {
    'modelId': MODEL, 'status': 'source-ready-scope-held-from-runtime', 'nativeScale': 1,
    'coordinateConvention': 'GeoJSON [longitude,latitude]; local east/north metres relative to anchor. Approximate local metres, not RD survey conversion.',
    'genuinePoi': poi, 'landmarkExtractIdentity': None,
    'identityNotes': 'No Hannekes Boom record found in landmarks.json or current landmark backlog. Existing branded-pois local-food-395 is preserved; coordinator must audit promotion into route/map/card contracts without fabricating extract identity.',
    'anchorLatLon': ANCHOR,
    'candidateReplacedIds': [PAND], 'acceptedReplacedIds': [],
    'scopeConfidence': 'Venue anchor lies inside candidate BAG-derived polygon, but official address/VBO-to-Pand relationship and current photo confirmation still required before suppression.',
    'mainCandidateFeature': main,
    'derivedFootprintAreaM2': round(area(ring),2),
    'heightNotes': {'cachedTileHeightM': main['properties']['height'], 'semanticState': 'Installed tier-3 fallback height only; not independently verified eave, occupied roof terrace, or canopy elevation. Do not model whole pavilion at this height without roof evidence.'},
    'retainedNeighbors': sorted(neighbors,key=lambda n:n['distanceFromAnchorM']),
    'openSpaceRules': ['Do not extrude the whole waterfront parcel or terrace.', 'Preserve open water and surrounding paths.', 'Keep Hannekes Boot separate from pavilion building suppression.', 'Roof terrace needs exposed roof surface and supported railing; canopy/tree support needs current photo and geographic alignment.'],
    'provenance': [ {'path': p, 'sha256': hashlib.sha256((ROOT/p).read_bytes()).hexdigest(), 'captureKind':'installed source bytes; selected feature extraction below is processed, not an original API response'} for p in [TILE, BRANDS]],
    'privateArchive': {'status':'pending; sibling outside writable sandbox', 'webTextStaging':'/private/tmp/hannekes-boom-web-extract-2026-10-05.json', 'originalPageBodies':'missing', 'originalPhotos':'missing', 'sourceCommit':None},
    'missingAcceptanceEvidence': ['Current clear waterside facade photograph and opposite/context view, with original bytes archived.', 'Current roof/roof-terrace and canopy profile photograph or surveyed elevation; glazing and tree-column assembly cannot be guessed from prose.', 'Official Dijksgracht 4 BAG VBO/Pand linkage.', 'Source-pack sync and private commit before any model publication.', 'Native-scale gallery plus actual game placement, neighbor retention and route/map/card review.']
}
(ROOT/'scripts/landmarks/hannekes-boom-footprints.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':record['status'],'poi':poi['id'],'candidatePand':PAND,'footprintAreaM2':record['derivedFootprintAreaM2'],'retainedNeighbors':len(neighbors)}))
