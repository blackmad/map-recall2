"""Staged schema-v1 recipe proposals from exact source shells and editorial data.

No live recipe writes; dimensions retain conflicting source measurements rather
than stretching body/storeys to a roof statistic. Image-derived details remain
labelled hypotheses until independent metric registration is available.
"""
import json, math, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.frames import FacadeFrame
from building_lib.layout import solve_storeys
from building_lib.schema import validate

def source_image(entry, tier):
    """Resolve the feature crop by hash, never by observation ordering."""
    source=entry['source'][tier];features=entry['shapeFeatures'][tier]
    matches=[o['payload']['images'][tier] for o in entry['owner']['observations']
             if o['payload'].get('images',{}).get(tier,{}).get('sha256')==source['sha256']]
    if len(matches)!=1:
        raise ValueError(f"{entry['id']}: {tier} crop requires one exact source observation")
    image=matches[0]
    if features.get('cropSha256')!=source['sha256']:
        raise ValueError(f"{entry['id']}: {tier} features belong to a different crop")
    if (features['width'],features['height'])!=(image['width'],image['height']):
        raise ValueError(f"{entry['id']}: {tier} feature dimensions disagree with crop")
    return image

def preserve_joinery(item, feature):
    """Keep manually reviewed divisions instead of generic width-based defaults."""
    for key in ('mullions','upperLights'):
        if key in feature:item[key]=feature[key]

def main():
    entries=json.loads((ROOT/'scripts/blender/expansion/source-manifest.json').read_text())['entries']
    notes=json.loads((ROOT/'scripts/blender/expansion/authoring-notes.json').read_text())['entries']
    out=ROOT/'scripts/blender/expansion/recipes';out.mkdir(exist_ok=True)
    reports=[]
    for e in entries:
        b=e['owner']['geometry']['building'];spec=notes[e['id']]
        ring=b['footprint']['coordinates'][0][0][:-1]
        frame=FacadeFrame.from_frontage(*e['front'],[sum(p[i] for p in ring)/len(ring) for i in (0,1)])
        footprint=[frame.local(p) for p in ring];width=frame.width
        datum=b['coordinateFrame']['heightDatum']['offsetNAP'];ground=b['groundNAP']
        shell=[{'type':s['type'],'rings':[[[*frame.local([p[0],p[2]]),p[1]+datum-ground] for p in r] for r in s['rings']]} for s in b['surfaces']]
        frontwalls=[]
        for i,s in enumerate(shell):
            if s['type']!='wall':continue
            points=s['rings'][0]
            if max(abs(p[1]) for p in points)<=.15:
                tops=[p[2] for p in points if p[2]>2]
                if tops:frontwalls.append({'index':i,'width':max(p[0] for p in points)-min(p[0] for p in points),'tops':tops})
        near=[]
        if frontwalls:
            dominant=max(frontwalls,key=lambda s:s['width']);eaves=max(dominant['tops']);peak=eaves
            height_reason='Dominant selected-front 3DBAG wall top. Roof statistic retained separately; roof shape inferred.'
        else:
            # Held diagnostic only: record nearby source geometry and keep the
            # selected-plane disagreement visible instead of substituting a box.
            for i,s in enumerate(shell):
                if s['type']!='wall':continue
                ps=s['rings'][0]
                if max(abs(p[1]) for p in ps)<=1.5 and max(p[0] for p in ps)>=0 and min(p[0] for p in ps)<=width:
                    tops=[p[2] for p in ps if p[2]>2]
                    if tops:near.append({'index':i,'tops':tops,'maxPlaneOffsetM':max(abs(p[1]) for p in ps)})
            if not near:raise ValueError(e['id']+': no frontage or diagnostic near-front shell')
            eaves=min(p for s in near for p in s['tops']);peak=max(p for s in near for p in s['tops'])
            height_reason='HELD: selected facade is not coplanar with source shell. Near-front shoulder/peak are diagnostic hypotheses only.'
        gh=spec['groundHeightM'];n=spec['upperRows'];storeys=solve_storeys(gh,eaves,n);spacing=(eaves-gh)/n
        upper=e['shapeFeatures']['full'];ground_crop=e['shapeFeatures']['ground'];openings=[]
        full_image=source_image(e,'full');ground_image=source_image(e,'ground')
        photo_h=full_image['plane']['topZ']-full_image['plane']['baseZ']
        windows=[f for f in upper['features'] if f['kind'] in ('window','door') and 'gable-opening' not in f['id']]
        groups=[]
        for f in sorted(windows,key=lambda f:f['bounds'][1]):
            y=f['bounds'][1]/upper['height']
            if not groups or abs(y-groups[-1][0]['bounds'][1]/upper['height'])>.055:groups.append([])
            groups[-1].append(f)
        # Lowest group is ground in cached feature proposals; upper row count is
        # a reviewed visual observation, never inferred from bounding box height.
        upper_groups=groups[:n]
        new_plane=spec.get('newPlaneLayout')
        omit_original=bool(new_plane) or spec['readiness']=='held-photo-plane-width-disagreement'
        if not omit_original:
            for row,features in enumerate(upper_groups):
                level=n-row;fstorey=f'upper_{level}';floor=storeys[level]
                for f in features:
                    x0,y0,x1,y1=f['bounds'];h=min((y1-y0)/upper['height']*photo_h,spacing*.84)
                    item={'id':f['id'],'x':(x0+x1)/2/upper['width']*width,'z':floor['bottom']+spacing*.5,'width':(x1-x0)/upper['width']*width,'height':h,'kind':f['kind'],'head':'segmental' if f.get('head') in ('segmental','rounded') else 'rectangular','transom':f.get('transom',.28),'storey':fstorey,'frameColour':spec['frameColour'],'provenance':{'status':'inferred','sourceHash':e['source']['full']['sha256'],'reason':'Visually checked bay/row hypothesis; original crop registration unresolved; metric dimensions are not observed.'}}
                    preserve_joinery(item,f)
                    openings.append(item)
            gp=ground_image['plane'];ground_h=gp['topZ']-gp['baseZ']
            features=ground_crop['features'];doors=[f['bounds'][3] for f in features if f['kind']=='door']
            baseline=max(doors) if doors else max(f['bounds'][3] for f in features if f['kind']=='window')
            for f in features:
                if f['kind'] not in ('window','door') or f['bounds'][1]<ground_crop['height']*.1:continue
                x0,y0,x1,y1=f['bounds'];bottom=max(.12,(baseline-y1)/ground_crop['height']*ground_h+.12);top=min(gh-.12,(baseline-y0)/ground_crop['height']*ground_h+.12)
                if top<=bottom+.2:continue
                x=(x0+x1)/2/ground_crop['width']*width;w=min((x1-x0)/ground_crop['width']*width,2*min(x,width-x))
                item={'id':f['id'],'x':x,'z':(top+bottom)/2,'width':w,'height':top-bottom,'kind':f['kind'],'head':f.get('head','rectangular'),'transom':f.get('transom',.25),'storey':'ground','frameColour':f.get('frameColour',spec['frameColour']),'provenance':{'status':'inferred','sourceHash':e['source']['ground']['sha256'],'reason':'Visual ground assembly proposal, street threshold hypothesis; independent registration unresolved.'}}
                preserve_joinery(item,f)
                openings.append(item)
        if new_plane:
            for row in range(n):
                level=n-row;floor=storeys[level]
                for bay,x in enumerate(new_plane['bayCentres']):
                    openings.append({'id':f'new-plane-upper-{level}-bay-{bay+1}','x':x*width,'z':floor['bottom']+spacing*.5,'width':width*new_plane['upperRowWidthFractions'][row],'height':spacing*(.61 if row==0 else .66),'kind':'window','head':'rectangular','transom':.5,'mullions':[1/3,2/3],'upperLights':[.25,.5,.75],'storey':f'upper_{level}','frameColour':spec['frameColour'],'provenance':{'status':'inferred','sourcePath':new_plane['sourcePath'],'confirmingPath':new_plane['confirmingPath'],'reason':'New selected-plane visual proportions; no transfer from rejected wider original crop, metric registration unresolved.'}})
            for bay,x in enumerate(new_plane['groundWindows']):
                openings.append({'id':f'new-plane-ground-window-{bay+1}','x':x*width,'z':gh*.54,'width':width*.195,'height':gh*.72,'kind':'window','head':'rectangular','transom':.5,'mullions':[1/3,2/3],'upperLights':[.25,.5,.75],'storey':'ground','frameColour':spec['frameColour'],'provenance':{'status':'inferred','sourcePath':new_plane['sourcePath'],'reason':'New-plane grouped ground window; lower wall hedge obscured.'}})
            openings.append({'id':'new-plane-ground-entrance','x':width*new_plane['groundDoor'],'z':gh*.46,'width':width*.15,'height':gh*.85,'kind':'door','head':'rectangular','transom':.18,'storey':'ground','frameColour':spec['frameColour'],'provenance':{'status':'inferred','sourcePath':new_plane['confirmingPath'],'reason':'Observed right entrance; threshold and opening dimensions remain hypotheses.'}})
        roof_top=peak if peak>eaves else eaves+(1.4 if spec['roofKind']=='pitched' else .15)
        ratios=spec.get('gableRatios',[[0,0],[1,0]])
        geo=e['owner']['footprint']['coordinates'][0][0];idx=min(range(len(ring)),key=lambda i:math.dist(ring[i],e['front'][0]));u=frame.tangent
        recipe={'schemaVersion':1,'id':e['id'],'name':e['name'],'address':e['address'],'caseId':e['caseId'],'synthetic':False,'buildingId':e['owner']['id'],'geometryRevision':e['owner']['geometryRevision'],'sourceBundle':e['id']+'.json','sourceBundlePath':str(Path('artifacts/building-library/expansion/evidence')/(e['id']+'.json')),'footprint':footprint,'height':max(eaves,peak),'storeys':storeys,'roof':{'kind':spec['roofKind'],'eaves':eaves,'top':roof_top,'status':'inferred','setback':.24},'gable':{'profile':[[x*width,eaves+y*(roof_top-eaves)] for x,y in ratios],'status':'inferred'},'frontages':[{'id':'street','origin':[0,0],'rotation':0,'width':width,'openings':openings,'storefront':{'anchor':width/2,'height':gh,'finishColour':spec['groundColour'],'signs':[],'awnings':[]}}],'materials':{'wall':'brownbrick' if spec['groundColour'] in ('#2d3134','#53514b','#5c4d42') else 'redbrick','wallColour':e['brickColour'],'roof':'slate','frame':'ivorytimber'},'details':{},'placement':{'anchor':geo[idx],'xAxisBearingDegrees':math.degrees(math.atan2(u[0],-u[1]))%360,'frontageLocal':e['front'],'inputFrameDeterminant':frame.determinant,'axes':'glTF x=along frontage,y=up,z=towards street'},'sourceShell':{'surfaces':shell,'groundNAP':ground,'sourceOffsetNAP':datum,'source':'3DBAG LoD2.2','pointCloudYear':b['pointCloudYear']},'heightEvidence':[{'source':'3DBAG LoD2.2','year':b['pointCloudYear'],'datum':'NAP','groundNAP':ground,'roofStatisticRelativeM':b['height'],'frontWallTopCandidates':frontwalls,'diagnosticNearFrontWalls':near,'lineage':'AHN-derived3DBAG; not independent height evidence'}],'heightChoice':{'value':max(eaves,peak),'eavesM':eaves,'roofPeakM':roof_top,'reportedRoofStatisticM':b['height'],'reason':height_reason},'targetAppearanceDate':e['source']['ground']['captureDate'],'authoringStatus':spec['readiness'],'visualObservations':spec['observed'],'assumptions':['Draft staged for review; no independently registered image features.','Exact owner footprint and semantic source shell retained. Generated side/rear shell currently uses one eaves extrusion; complex rear volumes require reconstruction.','Roof volume is a hypothesis; no hidden-side openings or invented businesses added.',*spec['limitations']]}
        errors=validate(recipe)
        (out/(e['id']+'.json')).write_text(json.dumps(recipe,indent=2)+'\n')
        reports.append({'id':e['id'],'status':spec['readiness'],'validationErrors':errors,'frontageWidthM':width,'planDepthM':max(p[1] for p in footprint)-min(p[1] for p in footprint),'bodyEavesM':eaves,'roofPeakM':roof_top,'reportedRoofStatisticM':b['height'],'sourceSurfaces':len(shell),'openings':len(openings),'frontwallBinding':bool(frontwalls)})
    (ROOT/'artifacts/building-library/expansion/draft-audit.json').write_text(json.dumps(reports,indent=2)+'\n')
    print(json.dumps(reports,indent=2))

if __name__=='__main__':main()
