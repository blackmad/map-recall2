"""Adapt cached source seeds to the existing v1 IR, without inventing joinery.

Photographic interpretation is a separate authoring step. Owner/source/frontage
bindings and selected wall dimensions remain explicit; seed image registration
is not promoted to measurement. No batch writes or downloads occur on import.
"""
import copy,json,math,sys,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.frames import FacadeFrame
from building_lib.layout import solve_storeys


def bind_source_rd(recipe,bundle,seed):
    """Attach the immutable seed's physical frontage and geographic frame.

    Uses the repository RD conversion, never fits the model to a photograph.
    Returns the facade frame for authoring additional physical street fronts.
    """
    selected=seed['selectedFacade'];building=seed['building']
    a,b=selected['orderedFrontageLocal'];ring=building['footprint']['coordinates'][0][0][:-1]
    frame=FacadeFrame.from_frontage(a,b,[sum(p[k] for p in ring)/len(ring) for k in (0,1)])
    if abs(frame.determinant+1)>1e-9:raise ValueError('Unexpected source frontage handedness')
    for surface,raw in zip(recipe['sourceShell']['surfaces'],building['surfaces']):
        for local_ring,raw_ring in zip(surface['rings'],raw['rings']):
            for local,point in zip(local_ring,raw_ring):
                if math.dist(frame.world(local[:2]),[point[0],point[2]])>=.001:
                    raise ValueError('Source facade frame changed a native point')
    origin=building['coordinateFrame']['originRD'];anchor=[origin['x']+a[0],origin['y']-a[1]]
    recipe['placement']['sourceRDFrame']={'anchorRD':anchor,'xAxisRD':[frame.tangent[0],-frame.tangent[1]],
        'yAxisRD':[frame.inward[0],-frame.inward[1]],'buildingId':seed['ownerId'],
        'geometryRevision':recipe['geometryRevision'],
        'source':'Frozen seed originRD and ordered physical frontage; normalized source vertices checked within 1 mm.'}
    result=subprocess.run(['node','--import','tsx','--input-type=module','-e',
        "import {rdToLngLat} from './src/canalRecall/facade/rdNew.ts';const [x,y]=JSON.parse(process.argv[1]);console.log(JSON.stringify(rdToLngLat({x,y})));",json.dumps(anchor)],
        cwd=ROOT,check=True,capture_output=True,text=True)
    recipe['placement']['anchor']=json.loads(result.stdout)
    bundle['physicalFacade']['plane']={key:copy.deepcopy(point) for key,point in zip(('start','end'),selected['orderedFrontageRD'])}
    return frame


def foundation(seed,identifier,name,address,ground_top,upper_rows,anchor=None):
    building=seed['building'];selected=seed['selectedFacade'];ring=building['footprint']['coordinates'][0][0][:-1]
    front=copy.deepcopy(selected['orderedFrontageLocal'])
    frame=FacadeFrame.from_frontage(*front,[sum(p[i] for p in ring)/len(ring) for i in (0,1)])
    datum=building['coordinateFrame']['heightDatum']['offsetNAP'];ground=building['groundNAP']
    height=selected['selectedWallHeight'];eaves=height['top']+datum-ground
    shell=[{'type':surface['type'],'rings':[[[*frame.local([p[0],p[2]]),p[1]+datum-ground] for p in points] for points in surface['rings']]} for surface in building['surfaces']]
    storeys=solve_storeys(ground_top,eaves,upper_rows);images=copy.deepcopy(selected['images']);ground_images=[i for i in images if i['tier']=='ground'];target=ground_images[-1]['captureDate']
    coverage=[]
    for year in sorted({i['captureDate'][:4] for i in images}):
        row={'year':year}
        for tier,name_tier in [('ground','ground'),('full','upper'),('roof','roof')]:
            matching=[i for i in images if i['captureDate'][:4]==year and i['tier']==tier]
            row[name_tier]={'captures':sorted({i['panoramaId']+'|'+i['captureDate'] for i in matching}),'crops':len(matching),'registered':0,'visible':'visually reviewed; unregistered seed crop'}
        coverage.append(row)
    derived=[]
    for item in images:
        if item['tier']=='context':continue
        derived.append({**item,'captureKey':item['panoramaId']+'|'+item['captureDate'],'sourceDimensions':item['nativeDimensions'],'registration':{'status':'unregistered','metricEligible':False},'selectedReason':'Cached selected-facade evidence; separate full/roof crops are not independent captures.'})
    bundle={'schemaVersion':1,'id':identifier,'ownerId':seed['ownerId'],'geometryRevision':seed['sourceGeometryFingerprint'],'physicalFacade':{'frontage':front,'orderedFrontageRD':selected['orderedFrontageRD'],'elevationId':selected['elevationId'],'identityStatus':'visually plausible; metric registration unresolved'},'targetAppearanceDate':target,'derived':derived,'candidates':images,'coverage':coverage,'policy':'Original cached images retained; source fingerprint is a cache geometry digest, not externally certified revision.','gaps':['No independent feature registration.','Only two independent captures in this seed; tier crop duplicates are not new observations.']}
    placement={'frontageLocal':front,'inputFrameDeterminant':frame.determinant,'xAxisBearingDegrees':math.degrees(math.atan2(frame.tangent[0],-frame.tangent[1]))%360,'axes':'glTF x=along frontage,y=up,z=towards street'}
    if anchor:placement['anchor']=anchor
    recipe={'schemaVersion':1,'id':identifier,'name':name,'address':address,'buildingId':seed['ownerId'],'synthetic':False,'geometryRevision':seed['sourceGeometryFingerprint'],'sourceBundle':identifier+'.json','footprint':[frame.local(p) for p in ring],'height':eaves,'storeys':storeys,'roof':{'kind':'flat','eaves':eaves,'top':eaves,'setback':.24,'status':'inferred'},'gable':{'family':'straight','rise':1,'status':'inferred'},'frontages':[{'id':'street','origin':[0,0],'rotation':0,'width':frame.width,'openings':[],'storefront':{'height':ground_top,'anchor':frame.width/2,'finishColour':'#d7d4bb','signs':[],'awnings':[]}}],'materials':{'wall':'creamrender','wallColour':'#d7d4bb','roof':'slate','frame':'ivorytimber'},'details':{},'placement':placement,'sourceShell':{'surfaces':shell,'groundNAP':ground,'sourceOffsetNAP':datum,'source':'3DBAG LoD2.2','pointCloudYear':building['pointCloudYear']},'heightEvidence':[{'source':'3DBAG LoD2.2','year':building['pointCloudYear'],'groundNAP':ground,'selectedWallHeightRaw':height,'selectedWallTopRelativeM':eaves,'roofStatisticRelativeM':building['height'],'lineage':'AHN-derived3DBAG; not independent height evidence'}],'heightChoice':{'value':eaves,'eavesM':eaves,'roofPeakM':eaves,'reportedRoofStatisticM':building['height'],'reason':'Selected wall top normalized by source offsetNAP-groundNAP; rear roof percentile is not substituted for frontage eaves.'},'targetAppearanceDate':target,'authoringStatus':'foundation-source-massing-review-pending','assumptions':['Photographic features unregistered; opening dimensions remain inferred author proportions.','Seed geometry fingerprint is a cache digest, not an externally certified revision.','Exact owner footprint and all semantic surfaces retained; stock flat roof placeholder must not replace source-derived rear volumes in a promoted reconstruction.','No source crop datum or pixel height is treated as an independent measurement.']}
    return recipe,bundle

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--seed',required=True,type=Path);parser.add_argument('--id',required=True);parser.add_argument('--name',required=True);parser.add_argument('--address',required=True);parser.add_argument('--ground-top',required=True,type=float);parser.add_argument('--upper-rows',required=True,type=int);parser.add_argument('--output',required=True,type=Path);parser.add_argument('--evidence-root',required=True,type=Path)
    args=parser.parse_args();recipe,bundle=foundation(json.loads(args.seed.read_text()),args.id,args.name,args.address,args.ground_top,args.upper_rows)
    args.output.parent.mkdir(parents=True,exist_ok=True);args.evidence_root.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(recipe,indent=2)+'\n');(args.evidence_root/(args.id+'.json')).write_text(json.dumps(bundle,indent=2)+'\n')
