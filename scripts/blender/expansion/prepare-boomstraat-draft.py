"""Photo-authored Boomstraat 23 study; isolated until rendered review.

Both native half-walls jointly own the entire photographed street facade.
Stepped knots, caps, joinery and bands are inferred from dated crops; their
metre proportions are illustrative, not photographic measurements.
"""
import copy,hashlib,json,sys
from pathlib import Path
from seed_to_ir import foundation,bind_source_rd
from building_lib.ir import resolve
from building_lib.schema import validate
from building_lib.batch import evidence_for
from building_lib.source_massing import compile_source_massing

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'artifacts/jordaan-building-library/overnight-source-review/boomstraat-draft'
OWNER='0363100012169233'
cohort=json.loads((ROOT/'artifacts/jordaan-building-library/next-cohort.json').read_text())
entry=next(e for e in cohort['entries'] if e['ownerId']==OWNER)
seed_bytes=(ROOT/entry['sourceSeedPath']).read_bytes();seed=json.loads(seed_bytes)
recipe,bundle=foundation(seed,'boomstraat-23','Boomstraat 23 stepped gable','Boomstraat 23',4.35,1)
bind_source_rd(recipe,bundle,seed)
front=recipe['frontages'][0];width=front['width']
top=max(p[2] for s in recipe['sourceShell']['surfaces'] for r in s['rings'] for p in r)
base=8.698999989032746
recipe.update(massing={'mode':'source-derived'},geometryMode='apertures',style='simple',height=top,
              authoringStatus='isolated photo-authored stepped-gable draft; visual review pending')
recipe['roof'].update(eaves=base,top=top)
recipe['heightChoice'].update(value=top,eavesM=base,roofPeakM=top,
    reason='Native owner maximum and left front shoulder retained. Photographed decorative steps replace the coarse primary triangular wall under explicit ownership; proportions are inferred.')
recipe['storeys']=[{'id':'ground','bottom':0,'top':4.35},
    {'id':'upper_1','bottom':4.35,'top':7.82},{'id':'attic','bottom':7.82,'top':top}]
recipe['materials'].update(wall='brownbrick',wallColour='#815642',frame='ivorytimber')
front['storefront'].update(finishColour='#747871',cornice=False)
# Five explicit risers per shoulder, as visible in the roof crop. The narrow
# crest preserves the exact native owner height; no generic stepped preset.
levels=[base,9.60,10.40,11.20,12.05,top]
fractions=[0,.06,.17,.29,.39,.46]
left=[]
for i,(fraction,z) in enumerate(zip(fractions,levels)):
    if i:left.append([fraction*width,levels[i-1]])
    left.append([fraction*width,z])
front['profile']=left+[[width-x,z] for x,z in reversed(left)]
front['profile'][-1][1]=8.988999989032746
front['sourceWallSelection']={'geometryRevision':recipe['geometryRevision'],
    'surfaceIndices':[1,3],'depthRange':[-.02,0],
    'ownershipProfile':[[0,top],[width,top]],
    'provenance':{'basis':'Two coplanar native front half-walls and dated whole-front roof crop',
        'note':'Wall 1 and wall 3 jointly own the entire public street frontage. Replace only their coarse triangular front outline with explicit inferred steps. Immutable native source shell, footprint and owner maximum retained.'}}

def photo(tier):
    image=next(i for i in entry['selectedFacade']['images'] if i['tier']==tier)
    if hashlib.sha256((ROOT/image['path']).read_bytes()).hexdigest()!=image['sha256']:
        raise ValueError('Frozen evidence hash changed')
    return {'status':'inferred','sourcePath':image['path'],'sourceHash':image['sha256'],
        'captureDate':image['captureDate'],'cropPlane':copy.deepcopy(image['plane']),
        'basis':'Visible feature layout in unregistered dated crop; illustrative metre proportions.'}

def opening(identifier,fraction,z,w,h,tier,storey,kind='window',transom=.23,mullions=None):
    spec={'id':identifier,'x':fraction*width,'z':z,'width':w,'height':h,
        'head':'rectangular','kind':kind,'storey':storey,'frameColour':'#d9d8c9',
        'glassColour':'#364543','transom':transom,'mullions':mullions or [],'provenance':photo(tier)}
    if kind=='door':spec['lowerPanel']={'height':.75,'colour':'#303d39'}
    front['openings'].append(spec)

# Ground: two tall windows and two distinct dark entries, observed in the
# less-obscured ground crop. Foliage is not modeled as facade geometry.
opening('ground-left-window',.125,2.39,width*.20,3.48,'ground','ground',transom=.26,mullions=[.5])
opening('ground-left-entry',.365,2.23,width*.17,3.94,'ground','ground','door',transom=.26)
opening('ground-right-window',.610,2.39,width*.20,3.48,'ground','ground',transom=.26,mullions=[.5])
opening('ground-right-entry',.860,2.23,width*.16,3.94,'ground','ground','door',transom=.26)
for col,fraction in enumerate((.29,.70),1):
    opening('upper-window-'+str(col),fraction,6.25,width*.245,1.95,'full','upper_1',transom=.24,mullions=[.5])
for col,fraction in enumerate((.20,.80),1):
    opening('gable-low-side-'+str(col),fraction,8.90,.62,1.05,'roof','attic',transom=.28,mullions=[.5])
opening('gable-low-center',.50,9.20,.82,1.30,'roof','attic',transom=.28,mullions=[.5])
opening('gable-high-center',.50,10.85,.60,1.02,'roof','attic',transom=.32,mullions=[.5])
front['components']=[]

def band(identifier,x,z,w,h=.10,projection=.12,profile='flat',tier='roof'):
    front['components'].append({'id':identifier,'kind':'cornice','x':x,'z':z,'width':w,
        'height':h,'projection':projection,'overhang':0,'profile':profile,
        'colour':'#cfcbbb','provenance':photo(tier)})

band('ground-head-band',width/2,4.48,width,.20,.24,'stepped','full')
band('upper-sill-course',width/2,5.20,width,.10,.10,'flat','full')
band('upper-head-course',width/2,7.34,width,.10,.10,'flat','full')
band('gable-base-course',width/2,7.82,width,.13,.13)
# Put caps inside each silhouette ledge, preserving the native overall peak.
for i in range(len(levels)-1):
    a,b=fractions[i]*width,fractions[i+1]*width
    for side,x in (('left',(a+b)/2),('right',width-(a+b)/2)):
        band('step-cap-'+side+'-'+str(i),x,levels[i]-.045,b-a+.035,.09,.16)
band('crest-cap',width/2,top-.055,width*(1-2*fractions[-1])+.06,.11,.17)
for spec in front['openings']:
    if spec['storey']=='ground':continue
    band(spec['id']+'-sill',spec['x'],spec['z']-spec['height']/2-.055,spec['width']+.18,.09,.15)
recipe['assumptions'] += ['One photographed public street front; no cached secondary physical facade exists for this seed. Unseen rear appearance remains inferred.',
    'Five-step shoulders, ten pale ledge caps, crest cap and ten openings are visually inferred from dated crops, not registered dimensions.',
    'Brick relief, semicircular decorative pediments above the main upper windows, ground entry carving and entrance steps remain simplified or omitted pending shared component support.',
    'Both native primary half-walls are explicitly selected; evidence covers the whole front rather than just the seed selected half-wall.']
resolved=resolve(recipe);errors=validate(resolved)
if errors:raise ValueError(errors)
compiled=compile_source_massing(resolved)
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'boomstraat-23.recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
(OUT/'boomstraat-23.json').write_text(json.dumps(bundle,indent=2)+'\n')
evidence_for(recipe,OUT)
report={'status':'isolated draft; not promoted','owner':OWNER,'openings':len(front['openings']),
    'components':len(front['components']),'nativePeakM':top,'nativeFrontSurfaces':[1,3],
    'schemaAndSourceCompilerPassed':True,'sourceEvidenceBindingPassed':True,
    'sourceSeedSHA256':hashlib.sha256(seed_bytes).hexdigest(),
    'remaining':['Rendered visual critique','Decorative upper pediments and entrance steps','Actual browser/shader review']}
(OUT/'preflight.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
