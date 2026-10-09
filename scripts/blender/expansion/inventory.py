"""Inventory immutable cache evidence by owner AND selected physical plane."""
import hashlib, json, math, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
CACHE=ROOT/'.worktrees/amsterdam-facade-rebuild'
OUT=ROOT/'artifacts/building-library/expansion'

def distance(a,b): return math.hypot(a['x']-b['x'],a['y']-b['y'])

def main():
    entries=json.loads((ROOT/'scripts/blender/expansion/source-manifest.json').read_text())['entries']
    paths=sorted((CACHE/'.cache').glob('**/panorama-audit/*/evidence/manifest.json'))
    manifests=[(p,json.loads(p.read_text())) for p in paths]
    (OUT/'cached-evidence').mkdir(exist_ok=True)
    summary=[]
    for e in entries:
        origin=e['owner']['geometry']['building']['coordinateFrame']['originRD']
        target=[{'x':origin['x']+p[0],'y':origin['y']-p[1]} for p in e['front']]
        items={}
        for p,m in manifests:
            for r in m.get('records',[]):
                if r.get('buildingId')!=e['owner']['id']:continue
                wall=r.get('wall')
                direct=max(distance(target[i],wall[k]) for i,k in enumerate(('start','end'))) if wall else math.inf
                reverse=max(distance(target[1-i],wall[k]) for i,k in enumerate(('start','end'))) if wall else math.inf
                reason='same-selected-plane-unregistered' if direct<=.3 else 'same-owner-context-width-or-plane-disagreement'
                if reverse<=.3:reason='reversed-frontage-rejected'
                for tier,im in r.get('images',{}).items():
                    h=im.get('sha256')
                    if not h or h in items:continue
                    image_path=p.parent/'images'/im['file'];exists=image_path.is_file()
                    dest=OUT/'cached-evidence'/f"{e['id']}-{tier}-{h[:12]}.jpg"
                    if exists:shutil.copyfile(image_path,dest)
                    pano_path=p.parent/'panoramas'/f"{im['panoramaId']}.jpg"
                    items[h]={
                        'sha256':h,'captureDate':im['date'],'tier':tier,
                        'captureKey':im['panoramaId']+'|'+im['date'],
                        'panoramaId':im['panoramaId'],'panoramaSha256':im.get('panoramaSha256'),
                        'width':im['width'],'height':im['height'],'sourceDimensions':im.get('sourceDimensions'),
                        'plane':im.get('plane'),'pose':im.get('pose'),'wall':wall,
                        'sourcePath':str(image_path.relative_to(ROOT)),
                        'reviewPath':str(dest.relative_to(ROOT)) if exists else None,
                        'sourceAvailable':exists,'wholePanoramaAvailable':pano_path.is_file(),
                        'wholePanoramaPath':str(pano_path.relative_to(ROOT)),
                        'registration':{'status':'ambiguous' if direct<=.3 else 'rejected-for-metric-transfer','reason':reason,'endpointErrorM':direct,'reverseErrorM':reverse},
                        'geometryRevision':e['owner']['geometryRevision'],
                        'geometryRevisionVerified':False,'rectificationDerivationKey':r.get('derivationKey'),
                        'coverage':['ground','upper','roof'] if tier=='full' else [tier] if tier in ('ground','roof') else ['context'],
                        'occlusion':{'status':'unreviewed'},
                    }
        rows=[]
        for year in sorted({im['captureDate'][:4] for im in items.values()}):
            row={'year':year}
            for region in ('ground','upper','roof'):
                im=[i for i in items.values() if i['captureDate'].startswith(year) and region in i['coverage'] and i['registration']['status']=='ambiguous']
                row[region]={'independentCaptureCount':len({i['captureKey'] for i in im}),'cropCount':len(im),'registered':0,'visibility':'unreviewed'}
            rows.append(row)
        bundle={'schemaVersion':1,'id':e['id'],'ownerId':e['owner']['id'],'reviewDate':'2026-09-30','geometryRevision':e['owner']['geometryRevision'],'frontage':e['front'],'targetRD':target,'evidence':sorted(items.values(),key=lambda im:(im['captureDate'],im['tier'])),'coverage':rows,'searchedLocations':[str(p.relative_to(ROOT)) for p in paths],'policy':'A cached crop is not a measured facade. Disagreement remains explicit; adjacent walls do not supply primary-front coverage. Dates count acquisitions, not independent registered observations.'}
        (OUT/f"{e['id']}-cached-inventory.json").write_text(json.dumps(bundle,indent=2)+'\n')
        summary.append({'id':e['id'],'cachedCrops':len(items),'datedCoverage':rows})
    (OUT/'cached-inventory-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
