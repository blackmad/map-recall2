"""Reproduce an owner-level, cache-only Jordaan inventory and evidence cohort.

This prepares evidence tasks, not recipes or accepted reconstructions.
"""
import hashlib
import json
import math
import shutil
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / '.worktrees/amsterdam-facade-rebuild'
OUT = ROOT / 'artifacts/jordaan-building-library'
PUBLIC = ROOT / 'public/canal-drive/models/building-library/jordaan'
BLOCK = CACHE / '.cache/city-appearance/districts/da-costa-jordaan-v1/e7a51599312c472206b3f4e202f9196166aae1584b579df1ba26f43a46cbbfa7/block.json'
BOUNDARY = CACHE / 'scripts/city-appearance/districts/amsterdam-buurten-da-costa-jordaan-2024-01-25.geojson'
CONFIG = CACHE / 'scripts/city-appearance/districts/da-costa-jordaan-v1.json'

def read(p): return json.loads(p.read_text())
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p): return str(p.relative_to(ROOT))
def write(p, data): p.write_text(json.dumps(data, indent=2) + '\n')
def dist(a,b): return math.hypot(a['x']-b['x'],a['y']-b['y'])

def selected_height(building, record, origin):
    wall=record.get('wall',{}); a,b=wall.get('start'),wall.get('end')
    if not a or not b or dist(a,b)<.1: return None
    length=dist(a,b); ux=(b['x']-a['x'])/length; uy=(b['y']-a['y'])/length
    matches=[]
    for index,surface in enumerate(building.get('surfaces',[])):
        if surface.get('type')!='wall': continue
        points=[p for ring in surface.get('rings',[]) for p in ring]
        if not points: continue
        points=[(origin['x']+p[0],origin['y']-p[2],p[1]) for p in points]
        error=max(abs((x-a['x'])*uy-(y-a['y'])*ux) for x,y,z in points)
        projections=[(x-a['x'])*ux+(y-a['y'])*uy for x,y,z in points]
        overlap=max(0,min(length,max(projections))-max(0,min(projections)))
        if error<=.15 and overlap>=min(length*.8,2):
            matches.append({'surfaceIndex':index,'planeErrorM':error,'overlapM':overlap,
                            'bottom':min(p[2] for p in points),'top':max(p[2] for p in points)})
    if not matches:return None
    match=max(matches,key=lambda m:(m['overlapM'],-m['planeErrorM']))
    return {**match,'heightM':match['top']-match['bottom'],
            'status':'selected-coplanar-source-wall; feature registration unresolved'}

def main():
    OUT.mkdir(parents=True,exist_ok=True); PUBLIC.mkdir(parents=True,exist_ok=True)
    block=read(BLOCK); config=read(CONFIG); member=next(a for a in config['areas'] if a['district']=='Jordaan')
    snapshot=read(BOUNDARY)
    features=[f for f in snapshot['features'] if f['properties']['identificatie'] in member['boundary']['sourceFeatureIds']]
    if len(features)!=6 or digest(BOUNDARY)!=config['boundarySource']['snapshotSha256']:
        raise ValueError('Frozen municipal boundary mismatch')
    shutil.copy2(BOUNDARY,OUT/'municipal-boundary-snapshot.geojson')
    owners={b['id']:b for b in block['buildings'] if b.get('ownerDistrict')=='Jordaan' and not b.get('acquisitionHalo')}
    existing={}; pilot=read(ROOT/'scripts/blender/component-pilot.json')
    for recipepath in pilot['recipes']:
        p=ROOT/'scripts/blender'/recipepath; recipe=read(p)
        if recipe.get('buildingId'): existing[recipe['buildingId']]={'id':recipe['id'],'recipePath':rel(p)}
    cases=read(CACHE/'public/data/facade-repair-preview/cases.json')['cases']
    held={c['owner']['id'] for c in cases if c.get('address','').startswith('Rozengracht 228') and c.get('owner')}
    indexed=defaultdict(dict); sourcefiles=[]
    for manifest in sorted((CACHE/'.cache/city-appearance/areas').glob('*/panorama-audit/*/evidence/manifest.json')):
        data=read(manifest); sourcefiles.append({'path':rel(manifest),'sha256':digest(manifest)})
        for r in data.get('records',[]):
            if r.get('buildingId') not in owners or not r.get('wall'):continue
            key=json.dumps([r['wall'].get('start'),r['wall'].get('end')],sort_keys=True)
            entry=indexed[r['buildingId']].setdefault(key,{'record':r,'images':{}})
            for tier,image in r.get('images',{}).items():
                path=manifest.parent/'images'/image['file']
                if not path.is_file():continue
                h=image.get('sha256') or digest(path)
                entry['images'].setdefault(h,{'tier':tier,'path':rel(path),'sha256':h,
                    'captureDate':image.get('date'),'panoramaId':image.get('panoramaId'),
                    'nativeDimensions':image.get('sourceDimensions'),'plane':image.get('plane'),
                    'datum':image.get('datum'),'heightInferred':image.get('heightInferred'),
                    'visibility':image.get('visibility'),'manifestPath':rel(manifest),
                    'derivationKey':r.get('derivationKey'),'metricEligible':r.get('metricEligible',False)})
    inventory=[]; candidates=[]
    for ownerid,b in sorted(owners.items()):
        facades=[]
        for value in indexed[ownerid].values():
            r=value['record']; images=list(value['images'].values()); wall=r['wall']
            captures={(i['panoramaId'],i['captureDate']) for i in images}
            years=sorted({i['captureDate'][:4] for i in images if i.get('captureDate')})
            tiers=sorted({i['tier'] for i in images}); height=selected_height(b,r,block['origin'])
            facades.append({'elevationId':r.get('elevationId'),'recordId':r['id'],
                'orderedFrontageRD':[wall['start'],wall['end']],
                'orderedFrontageLocal':[[p['x']-block['origin']['x'],block['origin']['y']-p['y']] for p in [wall['start'],wall['end']]],
                'wallWidthM':r.get('wallWidthM'),'selectedWallHeight':height,
                'independentCaptures':len(captures),'years':years,'tiers':tiers,
                'identityStatus':'not-visually-reviewed','registrationStatus':'unregistered',
                'images':sorted(images,key=lambda i:(i.get('captureDate') or '',i['tier'],i['sha256']))})
        facades.sort(key=lambda f:(bool(f['selectedWallHeight']),len(f['years']),f['independentCaptures'],'full' in f['tiers']),reverse=True)
        row={'ownerId':ownerid,'addresses':b.get('addresses',[]),'street':b.get('street'),
            'year':b.get('year'),'cachedMassingFamily':b.get('family'),
            'footprintAvailable':bool(b.get('footprint')),'sourceShellAvailable':bool(b.get('surfaces')),
            'ownerHeightAvailable':isinstance(b.get('height'),(int,float)),
            'districtMembership':b.get('districtMembership'),
            'existingRecipe':existing.get(ownerid),'held':ownerid in held,
            'cachedFacadeCount':len(facades),'selectedFacade':facades[0] if facades else None,
            'otherCachedFacades':facades[1:],
            'missing':([] if facades else ['cached dated facade evidence'])+([] if facades and facades[0]['selectedWallHeight'] else ['coplanar selected source wall height']),
            'unresolved':['primary frontage visual identity','metric feature registration','unseen rear/roof volumes','actual placement verification']}
        inventory.append(row)
        if not row['existingRecipe'] and not row['held'] and facades and facades[0]['selectedWallHeight'] and {'full','ground','roof'}<=set(facades[0]['tiers']):candidates.append(row)
    # Round-robin streets within massing cohorts; family is a cache heuristic, not visual classification.
    def diversify(rows):
        groups=defaultdict(list)
        for row in rows:groups[row['street']].append(row)
        for rows in groups.values():rows.sort(key=lambda r:(-len(r['selectedFacade']['years']),-r['selectedFacade']['independentCaptures'],r['ownerId']))
        result=[]
        while any(groups.values()):
            for street in sorted(groups):
                if groups[street]:result.append(groups[street].pop(0))
        return result
    cohort_ready=[r for r in candidates if r['addresses'] and r['street'] and len(r['selectedFacade']['years'])>=2]
    later=diversify([r for r in cohort_ready if r['cachedMassingFamily']=='later-infill'])
    others=diversify([r for r in cohort_ready if r['cachedMassingFamily']!='later-infill'])
    cohort=later[:12]+others[:8]
    selected={r['ownerId'] for r in cohort}
    if len(cohort)<20:cohort += [r for r in later[12:]+others[8:] if r['ownerId'] not in selected][:20-len(cohort)]
    summary={'schemaVersion':1,'scope':'Cached exact municipal Jordaan owner inventory, not a certified live total',
        'boundary':{'source':config['boundarySource'],'sha256':digest(BOUNDARY),
          'featureIds':member['boundary']['sourceFeatureIds'],'featureNames':[f['properties']['naam'] for f in features],
          'selectionRule':'Frozen publisher membership: exact municipal footprint intersection; area priority assigns each BAG owner once; exclude acquisition halo. One owner may have multiple addresses/facades.',
          'implementationPath':rel(CACHE/'scripts/city-appearance/merge-district-blocks.ts')},
        'geometrySource':{'path':rel(BLOCK),'sha256':digest(BLOCK),'originRD':block['origin']},
        'counts':{'cachedMergedOwners':len(block['buildings']),'jordaanPrimaryOwners':len(owners),
          'jordaanIntersectingOwners':sum('Jordaan' in b.get('districtMembership',[]) for b in block['buildings']),
          'mergedAcquisitionHaloOwners':sum(bool(b.get('acquisitionHalo')) for b in block['buildings']),
          'footprintOwners':sum(r['footprintAvailable'] for r in inventory),'sourceShellOwners':sum(r['sourceShellAvailable'] for r in inventory),
          'ownerHeightOwners':sum(r['ownerHeightAvailable'] for r in inventory),
          'cachedEvidenceOwners':sum(r['cachedFacadeCount']>0 for r in inventory),
          'cachedDistinctPhysicalFacades':sum(r['cachedFacadeCount'] for r in inventory),
          'selectedCoplanarWallHeightOwners':sum(bool(r['selectedFacade'] and r['selectedFacade']['selectedWallHeight']) for r in inventory),
          'existingRecipeOwners':sum(bool(r['existingRecipe']) for r in inventory),
          'evidenceTaskEligibleNewOwners':len(candidates),'namedMultiyearCohortEligibleOwners':len(cohort_ready),'frozenNextCohort':len(cohort),
          'nextCohortLaterInfillHeuristic':sum(r['cachedMassingFamily']=='later-infill' for r in cohort),
          'visuallyAcceptedMetricReconstructions':0},
        'existingRealRecipesOutsideExactJordaan':[r for owner,r in existing.items() if owner not in owners],
        'confidenceGate':{'status':'not-ready-for-district-reconstruction','requiredRealPilotOwners':20,
          'requiredVisuallyConfirmedOrdinaryOwners':12,
          'requirements':['Freeze visually verified primary frontage identity and ordered endpoints for each owner; wrong owner/plane blocks authoring','Use source-bound footprint and selected-wall height, reviewed stylized resemblance and honest unseen inference; full pane-level photogrammetric registration is not required','Record unregistered opening proportions as inferred rather than survey measurements','Resolve evidenced missing architecture with reusable components and generic fixtures','Verify export/render under actual placement transforms and measured footprints/selected wall heights','Independent four-view critique, repair loop and audited retained/failed outcomes'],
          'districtGoal':'All exact Jordaan owners after confidence gate; 200 is an intermediate batch, not district completion.'},
        'warnings':['Cached massing family is not confirmed architectural classification. The 12 ordinary target requires visual review.','Cached physical facades are not an exhaustive street-visible side count. Primary identity is not inferred from owner ID alone.','Source snapshots are frozen; no live endpoint refresh, downloads or paid vision calls occurred.'],
        'evidenceManifestSources':sourcefiles}
    write(OUT/'summary.json',summary);write(OUT/'owners.json',{'schemaVersion':1,'owners':inventory})
    (OUT/'source-seeds').mkdir(exist_ok=True)
    for row in cohort:
        owner=owners[row['ownerId']]
        fingerprint=hashlib.sha256(json.dumps({'footprint':owner['footprint'],'surfaces':owner['surfaces'],'coordinateFrame':owner['coordinateFrame']},sort_keys=True).encode()).hexdigest()
        path=OUT/'source-seeds'/f"{row['ownerId']}.json"
        write(path,{'schemaVersion':1,'ownerId':row['ownerId'],'sourceGeometryFingerprint':fingerprint,
                    'fingerprintPolicy':'cache geometry fingerprint; not an externally certified geometry revision',
                    'building':owner,'selectedFacade':row['selectedFacade'],'sourceBlock':summary['geometrySource']})
        row['sourceSeedPath']=rel(path)
    write(OUT/'next-cohort.json',{'schemaVersion':1,'stage':'evidence-preparation-only; not executable recipe manifest',
        'geometrySource':summary['geometrySource'],'boundarySha256':digest(BOUNDARY),
        'entries':cohort,'holdPolicy':'Do not author real geometry until physical frontage identity reviewed; unregistered dimensions remain inferred.'})
    write(PUBLIC/'summary.json',summary)
    write(PUBLIC/'cohort.json',{'entries':[{'ownerId':r['ownerId'],'addresses':r['addresses'],'street':r['street'],'cachedMassingFamily':r['cachedMassingFamily'],'years':r['selectedFacade']['years'],'captures':r['selectedFacade']['independentCaptures'],'status':'identity/registration review pending'} for r in cohort]})
    print(json.dumps(summary['counts'],indent=2))

if __name__=='__main__':main()
