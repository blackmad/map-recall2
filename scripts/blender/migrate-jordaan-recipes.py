"""One-time prototype migration. Building-specific overrides live in recipes afterward."""
import json,math
from pathlib import Path
from building_lib.frames import FacadeFrame
from building_lib.layout import solve_storeys
ROOT=Path(__file__).resolve().parents[2]
# Explicit editorial corrections from today's five prototypes; not generic rules.
PROFILES=[[(0,.85),(.28,.85),(.29,.89),(.39,.93),(.43,.985),(.54,.985),(.58,.955),(.69,.93),(.71,.85),(1,.85)],[(0,.96),(.5,1),(1,.96)],[(0,.75),(.12,.75),(.15,.83),(.20,.90),(.30,.96),(.43,.995),(.57,.995),(.70,.96),(.80,.90),(.85,.83),(.88,.75),(1,.75)],[(0,.76),(.05,.81),(.20,.81),(.25,.84),(.29,.93),(.26,.945),(.35,.97),(.44,.99),(.56,.99),(.65,.97),(.74,.945),(.71,.93),(.75,.84),(.80,.81),(.95,.81),(1,.76)],[(0,.78),(.12,.78),(.19,.84),(.25,.91),(.33,.96),(.43,.99),(.57,.99),(.67,.96),(.75,.91),(.81,.84),(.88,.78),(1,.78)]]
CONFIG=[(3.2,'#e4e0d4',150,.85,.85),(4.6,'#655f57',0,.7,.96),(3.8,'#625149',150,.7,.75),(4.3,'#78766c',230,.7,.76),(4.,'#c7c5b8',180,.65,.78)]

def main():
 if any((ROOT/'scripts/blender/building_lib/recipes').glob('rozengracht-*.json')):
  raise SystemExit('One-time migration already applied. Existing recipes contain reviewed overrides; edit recipes directly. Migration refuses to overwrite them.')
 for n,c in enumerate(json.loads((ROOT/'scripts/blender/jordaan-pois-source.json').read_text())['entries']):
    building=c['owner']['geometry']['building'];ring=building['footprint']['coordinates'][0][0][:-1]
    inside=[sum(p[i] for p in ring)/len(ring) for i in (0,1)];frame=FacadeFrame.from_frontage(*c['front'],inside)
    width=frame.width;footprint=[frame.local(p) for p in ring]
    heights=[v[1] for s in building['surfaces'] for r in s['rings'] for v in r];height=building['height']
    gh,groundColour,cutoff,offset,ef=CONFIG[n]
    datum=building['coordinateFrame']['heightDatum']['offsetNAP'];groundNAP=building['groundNAP']
    frontwalls=[s for s in building['surfaces'] if s['type']=='wall' and max(abs(frame.local([p[0],p[2]])[1]) for p in s['rings'][0])<.08]
    fronttops=[p[1]+datum-groundNAP for s in frontwalls for p in s['rings'][0] if p[1]>1]
    if not fronttops: raise ValueError('No physical frontage shell binding')
    # Roof-percentile height is only a statistic. Raw front-wall geometry anchors
    # facade proportions; shaped front walls supply separate shoulder/eaves.
    height=max(fronttops) if n!=1 else building['height']
    eaves=min(fronttops) if n in (1,2,3) else height*ef

    obs=next(o['payload'] for o in c['owner']['observations'] if o['payload'].get('images',{}).get('full'))
    photoH=obs['images']['full']['plane']['topZ']-obs['images']['full']['plane']['baseZ'];groundH=obs['images']['ground']['plane']['topZ']-obs['images']['ground']['plane']['baseZ']
    full=c['shapeFeatures']['full'];rows={}
    for f in full['features']:
      if f['kind'] in ('window','door') and f['bounds'][1]>=cutoff and (1-f['bounds'][3]/full['height'])*photoH-offset>=gh-.15:rows.setdefault(round(f['bounds'][1]/10),[]).append(f)
    keys=sorted(rows);storeys=solve_storeys(gh,eaves,len(keys));spacing=(eaves-gh)/len(keys);openings=[]
    for f in full['features']:
      if f['kind'] not in ('window','door'):continue
      x0,y0,x1,y1=f['bounds'];x=(x0+x1)/2/full['width']*width;z=(1-(y0+y1)/2/full['height'])*photoH-offset;w=(x1-x0)/full['width']*width;h=(y1-y0)/full['height']*photoH
      if z-h/2<gh-.15:continue
      if y0<cutoff:x=width*.5;w=min(w,width*.21);z=min(z,height-.45-h/2);level='attic'
      else:
       siblings=sorted(rows[round(y0/10)],key=lambda f:f['bounds'][0])
       if n>=2 and len(siblings)==3:x=width*(.17+.33*siblings.index(f));w=width*.23
       rowIndex=keys.index(round(y0/10));h=spacing*.72;z=gh+spacing*(len(keys)-rowIndex-.5);level=f'upper_{len(keys)-rowIndex}'
      z=min(z,height-h/2-.18)
      item={'id':'Upper '+f['id'],'x':x,'z':z,'width':w,'height':h,'kind':f['kind'],'head':f.get('head','rectangular'),'transom':f.get('transom',.23),'storey':level,'provenance':{'status':'inferred','sourceHash':c['source']['full']['sha256'],'reason':'Prototype photo feature; metric registration unresolved'}}
      if n==4 and f['kind']=='door':item['balcony']=True
      openings.append(item)
      if n==1 and level!='attic':openings.append({**item,'id':'Inferred tree-occluded left upper bay '+f['id'],'x':width*.25,'provenance':{'status':'unknown','reason':'Tree hides bay; retained diagnostic hypothesis pending registered alternate views'}})
    ground=c['shapeFeatures']['ground'];bases=[f['bounds'][3] for f in ground['features'] if f['kind']=='door'] or [f['bounds'][3] for f in ground['features'] if f['kind']=='window'];go=(1-max(bases)/ground['height'])*groundH-.12;signs=[];awnings=[]
    for f in ground['features']:
      if f['kind'] not in ('window','door','fascia','awning'):continue
      x0,y0,x1,y1=f['bounds'];x=(x0+x1)/2/ground['width']*width;z=(1-(y0+y1)/2/ground['height'])*groundH-go;w=(x1-x0)/ground['width']*width;h=(y1-y0)/ground['height']*groundH
      if n==4:
       if f['kind']=='door':x=width*(.16 if (x0+x1)/2<ground['width']/2 else .84);w=width*.16
       elif f['kind'] in ('window','fascia'):x=width/2;w=width*(.46 if f['kind']=='window' else .44)
      w=min(w,2*min(x,width-x))
      if f['kind'] in ('window','door') and h>.3:
       bottom=max(.12,z-h/2);top=min(gh-.1,z+h/2);h=top-bottom;z=(top+bottom)/2
       openings.append({'id':'Shop '+f['id'],'x':x,'z':z,'width':w,'height':h,'kind':f['kind'],'head':f.get('head','rectangular'),'transom':f.get('transom',.23),'storey':'ground','frameColour':f.get('frameColour','#314c42' if n==3 else '#dedccf'),'provenance':{'status':'inferred','sourceHash':c['source']['ground']['sha256'],'reason':'Cropped feature interpreted; threshold set to street datum'}})
      elif f['kind']=='fascia':signs.append({'id':f['id'],'x':x,'z':z,'width':w,'height':max(h,.12),'colour':f.get('colour','#263d32'),'text':'TABAK & CIGARETTEN' if n==0 else f.get('text',''),'anchor':'storefront'})
      elif f['kind']=='awning':awnings.append({'x':x,'z':z,'width':w,'height':min(h,.45),'projection':.85 if n==1 else .38,'colour':f.get('colour','#303633'),'text':f.get('text') or ('Heineken   BAR THEO' if n==2 else '')})
    if n==0:awnings.append({'x':width*.39,'z':2.27,'width':width*.46,'height':.09,'projection':.43,'colour':'#b76725','text':''})
    geo=c['owner']['footprint']['coordinates'][0][0];idx=min(range(len(ring)),key=lambda i:math.dist(ring[i],c['front'][0]));u=frame.tangent
    recipe={'schemaVersion':1,'id':c['id'],'name':c['name'],'address':c['address'],'caseId':c['caseId'],'synthetic':False,'buildingId':c['owner']['id'],'geometryRevision':c['owner']['geometryRevision'],'sourceBundle':c['id']+'.json','footprint':footprint,'height':height,'storeys':storeys,'roof':{'kind':'pitched','eaves':eaves,'top':max(eaves+.1,height-.45),'status':'inferred','setback':.24},'gable':{'profile':[[x*width,eaves if abs(z-ef)<1e-5 else eaves+(z-ef)/(1-ef)*(height-eaves)] for x,z in PROFILES[n]],'status':'inferred'},'frontages':[{'id':'street','origin':[0,0],'rotation':0,'width':width,'openings':openings,'storefront':{'anchor':width/2,'finishColour':groundColour,'height':gh,'signs':signs,'awnings':awnings}}],'materials':{'wall':'brownbrick' if n in (1,3) else 'redbrick','wallColour':c['brickColour'],'roof':'slate','frame':'ivorytimber'},'details':{'chimney':{'x':width*.77,'y':max(p[1] for p in footprint)*.73,'status':'inferred'},'bicycleSign':n==3},'placement':{'anchor':geo[idx],'xAxisBearingDegrees':math.degrees(math.atan2(u[0],-u[1]))%360,'frontageLocal':c['front'],'inputFrameDeterminant':frame.determinant,'axes':'glTF x=along frontage,y=up,z=towards street'},'sourceShell':{'surfaces':[{'type':s['type'],'rings':[[[*frame.local([p[0],p[2]]),p[1]+datum-groundNAP] for p in ring] for ring in s['rings']]} for s in building['surfaces']],'groundNAP':groundNAP,'sourceOffsetNAP':datum,'source':'3DBAG LoD2.2','pointCloudYear':building['pointCloudYear']},'heightEvidence':[{'source':'3DBAG LoD2.2','year':building['pointCloudYear'],'datum':'NAP','groundNAP':groundNAP,'roofStatisticRelativeM':building['height'],'rawSurfaceExtentM':max(heights)-min(heights),'frontWallTopRelativeM':max(fronttops),'eavesChoiceM':eaves,'uncertainty':'frontwall binding <=0.08m; source roof shape uncertain; ground datum from cached model','lineage':'AHN-derived 3DBAG, not independent AHN evidence'}],'heightChoice':{'value':height,'reportedRoofStatisticM':building['height'],'surfaceRange':max(heights)-min(heights),'frontWallTopM':max(fronttops),'eavesM':eaves,'reason':'Front wall anchors dimensions. Shaped front-wall minimum top anchors shoulders; flat uncertain 3DBAG roofs use explicit photo-inferred eaves fractions. Key Color roof peak remains inferred from roof statistic, not trusted eaves; no maximum-surface stretching.'},'targetAppearanceDate':c['source']['ground']['captureDate'],'assumptions':['Metric crop registration unresolved; openings remain illustrative panels, not verified apertures.','Unseen side/rear windows not asserted; roof volume and chimney inferred.','Source years must be reviewed per region before authoring geometry.']}
    if n==1:recipe['assumptions'].append('Tree-occluded left bay, height and roof remain unaccepted hypotheses; no multi-year feature recovery claimed.')
    (ROOT/'scripts/blender/building_lib/recipes'/f"{c['id']}.json").write_text(json.dumps(recipe,indent=2)+'\n')
if __name__=='__main__':main()
