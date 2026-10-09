"""Evidence-authored composite frontage correction through the common IR.

The owner-specific visual decisions live here; geometry compiler stays generic.
"""
import copy
import json
import math
import sys
from pathlib import Path
from reframe_recipe import rebase_plan, pixel_x_in_frame

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.frames import FacadeFrame

def main():
    out=ROOT/'artifacts/l37-scope-correction';out.mkdir(exist_ok=True)
    recipe= json.loads((ROOT/'artifacts/building-library/visual-critique/lauriergracht-37/before-recipe.json').read_text())
    entry=next(e for e in json.loads((ROOT/'scripts/blender/expansion/source-manifest.json').read_text())['entries'] if e['id']=='lauriergracht-37')
    owner=entry['owner'];origin=owner['geometry']['building']['coordinateFrame']['originRD']
    frame=FacadeFrame.from_frontage(*recipe['placement']['frontageLocal'],[sum(p[i] for p in owner['geometry']['building']['footprint']['coordinates'][0][0])/len(owner['geometry']['building']['footprint']['coordinates'][0][0]) for i in (0,1)])
    minx=min(p[0] for ring in recipe['sourceShell']['surfaces'][25]['rings'] for p in ring)
    maxx=max(p[0] for ring in recipe['sourceShell']['surfaces'][3]['rings'] for p in ring)
    corrected=rebase_plan(recipe,[minx,0]);width=maxx-minx
    corrected['massing']={'mode':'source-derived'}
    front=[frame.world([x,0]) for x in [minx,maxx]]
    corrected['placement'].update(frontageLocal=front,anchor=[4.881419760638602,52.37143004842073])
    selected=[3,25,58,60,26,39]
    facade=corrected['frontages'][0];facade.update(origin=[0,0],width=width)
    facade['sourceWallSelection']={'surfaceIndices':selected,'depthRange':[-.003,.379],
        'geometryRevision':corrected['geometryRevision'],
        'provenance':{'basis':'inferred/source-supported','note':'Photo-authored composite front replacement including same-owner shallow recess; original source surfaces retained in audit.', 'status':'inferred','source':'3DBAG same-owner composite front and wider dated photograph',
                      'reason':'Replace explicitly selected main-front wall patches including shallow recess; maintain all other owner surfaces and exact footprint. No global plane tolerance expansion.'}}
    source=entry['source']['full'];features=entry['shapeFeatures']['full']
    image=next(o['payload']['images']['full'] for o in owner['observations'] if o['payload'].get('images',{}).get('full',{}).get('sha256')==source['sha256'])
    plane=image['plane'];opens=[]
    for f in features['features']:
        if f['kind'] not in ('window','door'):continue
        row=f['row'];bay=f['bay'];x0,y0,x1,y1=f['bounds']
        left=pixel_x_in_frame(x0,features['width'],plane,origin,frame)-minx
        right=pixel_x_in_frame(x1,features['width'],plane,origin,frame)-minx
        level=5-row
        prior=next(o for o in recipe['frontages'][0]['openings'] if o['id']==('new-plane-ground-entrance' if row==5 and bay==5 else 'new-plane-ground-window-1' if row==5 else f'new-plane-upper-{level}-bay-1'))
        opening=copy.deepcopy(prior)
        bounds=[(222,313),(373,463),(519,609),(664,774),(832,940)][row-1]
        top,bottom=bounds;scale=recipe['roof']['eaves']/(985-158)
        opening.update(id=f'full-front-row-{row}-bay-{bay}',x=(left+right)/2,width=abs(right-left),z=(985-(top+bottom)/2)*scale,height=(bottom-top)*scale)
        opening['provenance']={'status':'inferred','sourcePath':'.worktrees/amsterdam-facade-rebuild/'+source['path'],
            'sourceHash':source['sha256'],'captureDate':source['captureDate'],'pixelBounds':f['bounds'],
            'cropPlane':plane,'verticalAnchorInference':{'facadeTopPixel':158,'groundPixel':985,'authoredRowPixels':[top,bottom],'selectedFacadeHeightM':recipe['roof']['eaves']},'reason':'Five complete groups visually confirmed on full-owner facade. X mapped via original padded crop plane into source frame. Z inferred from visually selected facade-top/ground anchors and unchanged source wall height; not independent metric registration.'}
        if row==1:opening.update(mullions=[.5],upperLights=[.25,.5,.75],transom=.52)
        elif row<5:opening.update(mullions=[1/3,2/3],upperLights=[.2,.4,.6,.8],transom=.48)
        elif bay<5:opening.update(mullions=[1/3,2/3],upperLights=[.2,.4,.6,.8],transom=.52)
        else:
            opening.update(kind='door',frameColour='#514032',glassColour='#4c5550',width=.95,height=(985-873)*scale,z=(985-873)*scale/2,transom=None,mullions=[],lowerPanel={'height':(985-873)*scale*.85,'colour':'#554031'})
        opens.append(opening)
        if row<5 or bay<5:opening['upperLightBars']=[.5]
        if row==5 and bay==5:
            for side,centre in [('left',opening['x']-.95),('right',opening['x']+.95)]:
                flank=copy.deepcopy(opening);flank.update(id=opening['id']+'-'+side+'-glass',kind='window',x=centre,width=.58,z=(985-(875+970)/2)*scale,height=(970-875)*scale,transom=.2,mullions=[],frameColour='#bcbcac');flank.pop('lowerPanel',None);opens.append(flank)
    facade['openings']=opens
    datums=[0,(985-803)*scale,(985-636.5)*scale,(985-491)*scale,(985-343)*scale,recipe['roof']['eaves']]
    for index,storey in enumerate(corrected['storeys']):
        storey.update(bottom=datums[index],top=datums[index+1])
    corrected['storeyDatumInference']={'sourceHash':source['sha256'],'reason':'Floor separations inferred from midpoints of visible row gutters in original wider photo; facade source height unchanged.','pixelSeparations':[985,803,636.5,491,343,158]}
    facade['storefront'].update(anchor=width/2,height=datums[1],cornice=False)
    cornice=copy.deepcopy(recipe['frontages'][0]['components'][0])
    facade['components']=[cornice]+[{'id':o['id']+'-sill','kind':'sill','openingId':o['id'],'height':.11,'projection':.18,'margin':.04,'drop':.025,'material':'limestone','colour':'#bcbcac','provenance':o['provenance']} for o in opens if o['kind']=='window']
    entrance=next(o for o in opens if o['id']=='full-front-row-5-bay-5')
    facade['components'].append({'id':'entrance-pale-canopy','kind':'cornice','profile':'flat','x':entrance['x'],'z':(985-872)*scale+.08,'width':3.25,'height':.16,'projection':.42,'material':'limestone','colour':'#bcbcac','provenance':entrance['provenance']})
    zone=copy.deepcopy(recipe['frontages'][0]['materialZones'][0]);zone.update(x=width/2,width=width)
    upper=next(o for o in opens if o['id']=='full-front-row-1-bay-1')
    zone.update(z=(985-(223+269)/2)*scale,height=(269-223)*scale)
    zone['provenance']=copy.deepcopy(opens[0]['provenance']);zone['provenance']['reason']='Continuous pale top strip across five observed groups; dimensions inferred.'
    facade['materialZones']=[zone]
    eaves=corrected['roof']['eaves'];corrected['gable']['profile']=[[0,eaves],[width,eaves]]
    corrected['authoringStatus']='composite-full-owner-frontage-draft'
    corrected['visualObservations']=['Full-owner wider photograph shows five complete grouped bays on each upper row, four grouped ground windows and right entrance.','Highest row is narrower with a continuous pale connecting band; rows below have broader grouped sash assemblies.','Same-owner source walls include left full-height wing and shallow connecting recess previously mistaken for excluded owner scope.']
    corrected['assumptions']=['Stylized full-owner front correction; independent image-to-wall anchor registration remains unresolved.','Exact footprint and complete semantic source shell retained under a translated normalized frame, with source-derived massing for rear/roof geometry.','Explicit selected wall patches are replaced by a photo-authored common front plane; shallow recess flattened as recorded source-supported simplification.','Source-derived rear/roof geometry is retained, but photographic detail and roof railings remain incomplete.','Original padded full-photo plane is retained; its crop width is not equated with physical facade width.']
    corrected['placement']['anchorTransform']={'implementation':'src/canalRecall/facade/rdNew.ts rdToLngLat', 'auditPath':'artifacts/building-library/placement-audit.json','anchorRD':{'x':origin['x']+front[0][0],'y':origin['y']-front[0][1]},'previousAnchorWGS':recipe['placement']['anchor'],'previousAnchorRD':{'x':120552.26797300534,'y':487180.34429998056},'previousSelectedOriginRD':{'x':120549.40817002577,'y':487179.1040474554},'previousAnchorToSelectedOriginErrorM':3.112,'normalizedOriginTranslationM':-minx,'note':'Previous placement used nearest footprint vertex rather than exact frontage origin. Composite anchor is recomputed from exact source endpoints; plan translation alone did not preserve old placement. Actual game transform remains unverified.'}
    bundle=json.loads((ROOT/'public/canal-drive/models/building-library/evidence/lauriergracht-37.json').read_text())
    old=copy.deepcopy(bundle['physicalFacade']);physical=copy.deepcopy(old)
    physical['frontage']=front
    physical['plane'].update(start={'x':origin['x']+front[0][0],'y':origin['y']-front[0][1]},end={'x':origin['x']+front[1][0],'y':origin['y']-front[1][1]})
    physical.update(scope='full-owner composite facade envelope',sourceSurfaceIndices=selected,sourcePatchDepthRange=[-.003,.379],priorPartialPhysicalFacade=old,
       associationDiscrepancy=False,scopeCorrection='Previous single14.78mwall selection omitted same-ownerleftwing; wider original crop is valid contextual evidence for composite21mfront.')
    bundle['physicalFacade']=physical
    for derived in bundle['derived']:
        derived['scope']='partial crop projected onto former14.78mselectedwall; retain original immutable plane mapping'
        derived['registration']['status']='ambiguous'
    bundle['visualReview'].update(observations=corrected['visualObservations'],draftReadiness='composite-frontage-draft',scopeCorrection='Previous exclusion claim withdrawn: source owner includes omitted wing.',originalWiderSourcePath='.worktrees/amsterdam-facade-rebuild/'+source['path'])
    (out/'evidence').mkdir(exist_ok=True)
    (out/'evidence/lauriergracht-37.json').write_text(json.dumps(bundle,indent=2)+'\n')
    corrected['sourceBundlePath']='artifacts/l37-scope-correction/evidence/lauriergracht-37.json'
    (out/'lauriergracht-37.json').write_text(json.dumps(corrected,indent=2)+'\n')
    (out/'manifest.json').write_text(json.dumps({'schemaVersion':1,'recipes':['lauriergracht-37.json']},indent=2)+'\n')
    print(json.dumps({'width':width,'frontage':front,'openings':len(opens),'scope':'draft awaiting explicit sourceWallSelection build validation'},indent=2))

if __name__=='__main__':main()
