"""Evidence-authored two-front café draft, isolated pending rendered critique.

The coarse native gable remains explicit, never silently replaced by a preset.
All opening dimensions are illustrative unregistered proportions.
"""
import argparse,copy,hashlib,json,math,sys
from pathlib import Path
from seed_to_ir import foundation,bind_source_rd
from building_lib.ir import resolve
from building_lib.schema import validate
from building_lib.batch import evidence_for

ROOT=Path(__file__).resolve().parents[3]
OWNER='0363100012167753'
OUT=ROOT/'artifacts/jordaan-building-library/overnight-source-review/cafe-draft'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--refined',action='store_true',help='Isolated photo-inferred curved gable and cornice study')
args=parser.parse_args()
if args.refined:OUT=OUT/'refined'
cohort=json.loads((ROOT/'artifacts/jordaan-building-library/next-cohort.json').read_text())
entry=next(e for e in cohort['entries'] if e['ownerId']==OWNER)
seed=json.loads((ROOT/entry['sourceSeedPath']).read_text())
recipe,bundle=foundation(seed,'brouwersgracht-119','Brouwersgracht 119 café corner','Brouwersgracht 119 / Goudsbloemstraat 1',2.9,2)
frame=bind_source_rd(recipe,bundle,seed)
top=max(p[2] for surface in recipe['sourceShell']['surfaces'] for r in surface['rings'] for p in r)
base=9.668999985456468
recipe.update(massing={'mode':'source-derived'},geometryMode='apertures',style='simple',height=top,
              authoringStatus='isolated authored draft; native gable/photo mismatch and render review pending')
recipe['roof'].update(eaves=base,top=top)
recipe['storeys']=[{'id':'ground','bottom':0,'top':2.9},{'id':'upper_1','bottom':2.9,'top':6.2},{'id':'upper_2','bottom':6.2,'top':base},{'id':'attic','bottom':base,'top':top}]
recipe['heightChoice'].update(value=top,eavesM=base,roofPeakM=top,
    reason='Native full owner roof maximum retained; 9.669 m is the exact secondary-wall top. Coarse primary roof/gable boundary is not a measured decorative silhouette.')
recipe['materials'].update(wall='brownbrick',wallColour='#855842',frame='ivorytimber')
primary=recipe['frontages'][0];width=primary['width']
primary['profile']=[[0,9.368999985456467],[2.130803399311614,12.158999985456466],
                    [2.130803399311614,12.538999985456467],[width,base]]
primary['storefront'].update(height=2.9,finishColour='#855842',cornice=False)

def evidence(facade,tier):
    image=next(i for i in facade['images'] if i['tier']==tier)
    assert hashlib.sha256((ROOT/image['path']).read_bytes()).hexdigest()==image['sha256']
    return {'status':'inferred','sourcePath':image['path'],'sourceHash':image['sha256'],
            'captureDate':image['captureDate'],'cropPlane':copy.deepcopy(image['plane']),
            'basis':'Visible feature presence and layout in unregistered dated crop; all authored metre dimensions are illustrative.'}

def opening(front,identifier,x,z,w,h,provenance,storey='ground',kind='window',bars=None,transom=.25):
    front['openings'].append({'id':identifier,'x':x,'z':z,'width':w,'height':h,
        'head':'rectangular','kind':kind,'storey':storey,'frameColour':'#d7d5bd',
        'glassColour':'#3e4c4a','transom':transom,'mullions':bars if bars is not None else [],
        'provenance':copy.deepcopy(provenance)})

upper=evidence(entry['selectedFacade'],'full');ground=evidence(entry['selectedFacade'],'ground')
for row,z in enumerate((4.45,7.55),1):
    for col,fraction in enumerate((.27,.74),1):
        opening(primary,f'canal-upper-{row}-{col}',width*fraction,z,width*.30,1.90,upper,f'upper_{row}')
opening(primary,'native-gable-window',2.13,10.87,.65,.87,evidence(entry['selectedFacade'],'roof'),'attic',transom=None)
opening(primary,'canal-display',1.30,1.46,2.27,2.60,ground,bars=[.25,.50,.75],transom=.21)
opening(primary,'canal-entry',3.29,1.42,.90,2.62,ground,kind='door',transom=.21)

side=entry['otherCachedFacades'][0];a,b=[frame.local(p) for p in side['orderedFrontageLocal']]
rotation=math.atan2(b[1]-a[1],b[0]-a[0]);side_top=side['selectedWallHeight']['top']+recipe['sourceShell']['sourceOffsetNAP']-recipe['sourceShell']['groundNAP']
secondary={'id':'goudsbloemstraat','origin':a,'rotation':rotation,'width':side['wallWidthM'],
    'eaves':side_top,'profile':[[0,side_top],[side['wallWidthM'],side_top]],'openings':[],
    'storefront':{'height':2.9,'anchor':side['wallWidthM']/2,'finishColour':'#855842','cornice':False,'signs':[],'awnings':[]}}
recipe['frontages'].append(secondary);sw=secondary['width'];upper=evidence(side,'full');ground=evidence(side,'ground')
for row,z in enumerate((4.45,7.55),1):
    for col,fraction in enumerate((.10,.57,.75,.92),1):
        opening(secondary,f'side-upper-{row}-{col}',sw*fraction,z,1.05,1.85,upper,f'upper_{row}')
opening(secondary,'side-cafe-display',sw*.20,1.46,3.20,2.60,ground,bars=[.25,.5,.75],transom=.21)
for i,fraction in enumerate((.60,.78),1):opening(secondary,f'side-ground-window-{i}',sw*fraction,1.43,1.05,2.22,ground,transom=.21)
opening(secondary,'side-entry',sw*.947,1.42,.90,2.62,ground,kind='door',transom=.21)
for front in recipe['frontages']:
    for opening_spec in front['openings']:
        if opening_spec['kind']=='door':
            opening_spec['lowerPanel']={'height':.55,'colour':'#303b37'}
bundle['additionalPhysicalFacades']=[{'id':secondary['id'],'orderedFrontageLocal':side['orderedFrontageLocal'],
    'orderedFrontageRD':side['orderedFrontageRD'],'elevationId':side['elevationId'],
    'identityStatus':'corner visibly plausible from primary and side context; feature registration unresolved'}]
for image in side['images']:
    assert hashlib.sha256((ROOT/image['path']).read_bytes()).hexdigest()==image['sha256']
    bundle['candidates'].append(copy.deepcopy(image))
    if image['tier']!='context':bundle['derived'].append({**copy.deepcopy(image),'frontageId':secondary['id'],
        'captureKey':image['panoramaId']+'|'+image['captureDate'],'sourceDimensions':image['nativeDimensions'],
        'registration':{'status':'unregistered','metricEligible':False},'selectedReason':'Own public side crop; duplicates do not add independent captures.'})
recipe['assumptions'] += ['Both visible street façades are authored from their own dated crops; side origin/angle/width follow frozen physical endpoints.',
    'The native front gable is a coarse asymmetric ramp with a narrow vertical crest, unlike the observed rounded shoulders. No stock bell profile replaces it; appearance reconstruction and render critique remain a hold.',
    'Diagonal leaded upper glass is observed but omitted in this first simplified draft; no photographic dimensional registration claimed.',
    'Unseen rear appearance remains unresolved. No sign wording is guessed.']
if args.refined:
    crest=2.130803399311614;peak=12.538999985456467
    # Explicit photo-inferred knots, not a stock gable preset. The crest is
    # cropped in the evidence: keep its native anchor and hold acceptance.
    left=[(0,9.368999985456467),(.035,9.68),(.08,9.79),(.14,9.58),
          (.24,10.03),(.34,10.66),(.43,11.55),(.5,peak)]
    primary['profile']=[[2*f*crest,z] for f,z in left]
    primary['profile'] += [[width-2*f*(width-crest),z] for f,z in reversed(left[:-1])]
    primary['profile'][-1][1]=base
    primary['sourceWallSelection']={'geometryRevision':recipe['geometryRevision'],
        'surfaceIndices':[5,6],'depthRange':[-.015,.015],
        'ownershipProfile':[[0,peak],[width,peak]],
        'provenance':{'basis':'Explicit physical primary frontage ownership and dated roof crop',
            'note':'Replace the coarse triangular front wall by a photo-inferred curved silhouette. Raw source shell remains immutable; source crest/owner roof maximum and footprint retained. Cropped crest is not registered or accepted.'}}
    for front,photo in ((primary,evidence(entry['selectedFacade'],'full')),(secondary,evidence(side,'full'))):
        front['components']=[{'id':front['id']+'-cafe-band','kind':'cornice',
            'z':2.99,'height':.22,'projection':.20,'overhang':0,
            'colour':'#d7d5bd','provenance':photo}]
    secondary['components'].append({'id':'side-eaves-band','kind':'cornice',
        'z':base-.04,'height':.18,'projection':.17,'overhang':0,
        'colour':'#d7d5bd','provenance':evidence(side,'full')})
    recipe['authoringStatus']='isolated photo-inferred curved gable and cornice draft; render review pending'
    recipe['assumptions'][ -3 ]='Curved primary shoulders are explicit illustrative photo knots under exact native wall ownership; cropped crest keeps the native anchor. Source-derived roof outside the facade remains unchanged and requires visual review.'
errors=validate(resolve(recipe))
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'brouwersgracht-119.recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
(OUT/'brouwersgracht-119.json').write_text(json.dumps(bundle,indent=2)+'\n')
evidence_for(recipe,OUT)
report={'status':'isolated authored draft; not rendered or promoted','owner':OWNER,'frontages':2,
        'openings':sum(len(f['openings']) for f in recipe['frontages']),'purePreflightErrors':errors,
        'commonOwnerFrontageAndRDFrameEvidenceBindingPassed':True,
        'nativePeakM':top,'sourceSeedSHA256':hashlib.sha256((ROOT/entry['sourceSeedPath']).read_bytes()).hexdigest(),
        'remaining':['Native decorative gable reconciliation','Actual render critique','Placement/export verification']}
(OUT/'preflight.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
if errors:sys.exit(1)
