"""Cache-backed authoring batches: reusable recipes, incremental build, failures.

Starter layouts are explicitly unreviewed. A photo pass changes the recipe,
not this program. Geometry failures are per-owner, never swallowed as success.
All output is isolated under artifacts; original sources remain untouched.
"""
import argparse,copy,hashlib,json,math,subprocess,sys,time
from pathlib import Path
from seed_to_ir import foundation,bind_source_rd
from building_lib.ir import resolve
from building_lib.schema import validate
from building_lib.source_massing import compile_source_massing

ROOT=Path(__file__).resolve().parents[3]

def read(p):return json.loads(p.read_text())
def write(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2)+'\n')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def native_profile(recipe):
    """Upper envelope of native primary wall edges; no guessed gable family."""
    width=recipe['frontages'][0]['width'];selected=[];edges=[]
    for i,surface in enumerate(recipe['sourceShell']['surfaces']):
        if surface['type']!='wall':continue
        points=[p for ring in surface['rings'] for p in ring]
        if not points or max(abs(p[1]) for p in points)>.04:continue
        if min(p[0] for p in points)<-.05 or max(p[0] for p in points)>width+.05:continue
        selected.append(i)
        for ring in surface['rings']:
            edges.extend((a,b) for a,b in zip(ring,ring[1:]+ring[:1]) if abs(a[0]-b[0])>1e-8)
    if not edges:raise ValueError('No complete native primary wall envelope')
    xs=sorted({0,width,*[max(0,min(width,p[0])) for edge in edges for p in edge]})
    profile=[]
    for x in xs:
        candidates=[]
        for a,b in edges:
            if min(a[0],b[0])-.04<=x<=max(a[0],b[0])+.04:
                candidates.append(a[2]+(x-a[0])/(b[0]-a[0])*(b[2]-a[2]))
        if not candidates:raise ValueError('Gap in native primary wall envelope')
        # Extending a rounded source endpoint to the bound facade endpoint
        # must not create a new owner height above the actual source points.
        native_peak=max(p[2] for i in selected for ring in recipe['sourceShell']['surfaces'][i]['rings'] for p in ring)
        profile.append([x,min(max(candidates),native_peak)])
    if min(z for x,z in profile)<=3:raise ValueError('Native primary wall envelope too low')
    # Drop interior collinear knots to leave a recipe a person can edit.
    compact=[]
    for p in profile:
        compact.append(p)
        while len(compact)>=3:
            a,b,c=compact[-3:]
            if abs((b[1]-a[1])*(c[0]-a[0])-(c[1]-a[1])*(b[0]-a[0]))>1e-6:break
            compact.pop(-2)
    return compact,selected

def starter_entrance(front):
    """Residential authoring prior, never a claimed photo observation."""
    front['openingRows']=[row for row in front.get('openingRows',[]) if row.get('storey')!='ground']
    front['openingPatterns']=[p for p in front.get('openingPatterns',[]) if p.get('storey','ground')!='ground']+[
        {'id':'ground','preset':'right-entry','storey':'ground','provenance':{
            'status':'inferred','basis':'Unreviewed residential entrance prior',
            'note':'A plausible entrance avoids window-only starters. Position/layout must be checked against the dated photo; shop/warehouse/garage exceptions are explicit.'}}]


def normalize_starters(args,out):
    batch=read(out/'batch.json');changed=[];failures=[]
    for entry in batch['entries']:
        if entry['status']!='starter-needs-photo-pass':continue
        path=out/entry['recipe'];original=read(path);front=original['frontages'][0]
        # Restrict migration to the exact legacy uniform-window ground prior.
        if front.get('openingPatterns') or front.get('openings') or not any(row.get('id')=='ground' and row.get('storey')=='ground' for row in front.get('openingRows',[])):continue
        candidate=copy.deepcopy(original);starter_entrance(candidate['frontages'][0])
        try:
            issues=validate(resolve(candidate))
            if issues:raise ValueError('; '.join(issues))
            before=out/'before-starter-normalization'/path.name
            if not before.exists():write(before,original)
            write(path,candidate);changed.append(entry['id'])
        except (ValueError,KeyError) as error:failures.append({'id':entry['id'],'error':str(error)})
    write(out/'starter-normalization-report.json',{'changed':changed,'failures':failures,'policy':'Inferred entrance prior only; authoring/evidence status unchanged; photo pass still required.'})
    print(json.dumps({'starterEntrancePriors':len(changed),'failures':failures}))


def prepare(args,out):
    inventory=read(ROOT/'artifacts/jordaan-building-library/owners.json')['owners']
    summary=read(ROOT/'artifacts/jordaan-building-library/summary.json');block_path=ROOT/summary['geometrySource']['path']
    block=read(block_path);by_id={b['id']:b for b in block['buildings']}
    baseline=read(ROOT/'public/canal-drive/models/building-library/manifest.json')
    existing={m.get('buildingId') for m in baseline['models']}
    frozen=read(ROOT/'artifacts/jordaan-building-library/next-cohort.json')['entries']
    # Keep unresolved current cohort cases intact; this batch explores others.
    excluded=existing|{r['ownerId'] for r in frozen}
    for other_batch in args.exclude_batch:
        excluded.update(e['ownerId'] for e in read(other_batch/'batch.json')['entries'])
    candidates=[r for r in inventory if r['ownerId'] not in excluded and not r['held']
        and r['cachedFacadeCount']==1 and r['addresses'] and r['sourceShellAvailable']
        and r['selectedFacade'] and r['selectedFacade']['selectedWallHeight']
        and {'full','ground','roof'}<=set(r['selectedFacade']['tiers'])
        and 3<=r['selectedFacade']['wallWidthM']<=12]
    candidates.sort(key=lambda r:(r['street'] or '',r['ownerId']))
    entries=[];failures=[];start=time.monotonic()
    for row in candidates[args.offset:]:
        if len(entries)>=args.limit:break
        owner=row['ownerId'];identifier='bag-'+owner
        try:
            b=by_id[owner];seed={'schemaVersion':1,'ownerId':owner,
                'sourceGeometryFingerprint':hashlib.sha256(json.dumps({'footprint':b['footprint'],'surfaces':b['surfaces'],'coordinateFrame':b['coordinateFrame']},sort_keys=True).encode()).hexdigest(),
                'building':b,'selectedFacade':row['selectedFacade'],'sourceBlock':summary['geometrySource']}
            recipe,bundle=foundation(seed,identifier,', '.join(row['addresses']),', '.join(row['addresses']),2.9,1)
            bind_source_rd(recipe,bundle,seed)
            profile,indices=native_profile(recipe);body=min(profile[0][1],profile[-1][1]);peak=max(p[2] for s in recipe['sourceShell']['surfaces'] for r in s['rings'] for p in r)
            ground=min(3.2,body*.32);count=max(1,round((body-ground)/3.0));span=(body-ground)/count
            recipe['storeys']=[{'id':'ground','bottom':0,'top':ground}]+[
                {'id':'upper_'+str(i+1),'bottom':ground+i*span,'top':ground+(i+1)*span} for i in range(count)]
            recipe.update(massing={'mode':'source-derived'},geometryMode='apertures',style='simple',height=peak,
                          authoringStatus='starter; photo layout needs a quick look')
            recipe['roof'].update(eaves=body,top=peak)
            recipe['heightChoice'].update(value=peak,eavesM=body,roofPeakM=peak,reason='Native primary wall envelope and immutable source owner maximum. Storey layout is an unreviewed starter.')
            recipe['materials'].update(wall='brownbrick',wallColour='#8a5d4b')
            front=recipe['frontages'][0];front['profile']=profile;w=front['width']
            front['sourceWallSelection']={'geometryRevision':recipe['geometryRevision'],'surfaceIndices':indices,'depthRange':[-.04,.04],
                'provenance':{'basis':'Native coplanar primary wall envelope','note':'Only matched primary source walls are owned. All other native street/roof geometry remains unchanged.'}}
            front['storefront'].update(height=ground,finishColour='#8a5d4b',cornice=False)
            bays=max(2,min(5,round(w/2.1)));centres=[(i+.5)/bays for i in range(bays)]
            front['openingRows']=[{'id':'upper','storeys':[s['id'] for s in recipe['storeys'][1:]],
                'centresFraction':centres,'widthFraction':.66/bays,'heightFraction':.66,'sillFraction':.16,
                'template':{'transom':.25,'frameColour':'#d7d5bd','glassColour':'#3e4c4a'},
                'provenance':{'status':'inferred','basis':'Unreviewed starter pattern; replace bay/storey choices after looking at the dated photos.'}},
                {'id':'ground','storey':'ground','centresFraction':centres,'widthFraction':.66/bays,
                 'heightFraction':.78,'sillFraction':.10,'template':{'transom':.25,'frameColour':'#d7d5bd','glassColour':'#3e4c4a'},
                 'provenance':{'status':'inferred','basis':'Unreviewed starter ground pattern; shop and door layout needs a photo pass.'}}]
            starter_entrance(front)
            errors=validate(resolve(recipe))
            if errors:raise ValueError('; '.join(errors))
            # Photo metadata stays immutable. Validate the exact files once.
            images=row['selectedFacade']['images']
            for im in images:
                if digest(ROOT/im['path'])!=im['sha256']:raise ValueError('Evidence changed: '+im['path'])
            write(out/'seeds'/f'{owner}.json',seed);write(out/'recipes'/f'{identifier}.recipe.json',recipe)
            write(out/'evidence'/f'{identifier}.json',bundle)
            entries.append({'ownerId':owner,'id':identifier,'address':recipe['address'],'status':'starter-needs-photo-pass',
                'recipe':'recipes/'+identifier+'.recipe.json','evidence':'evidence/'+identifier+'.json',
                'photos':{tier:next(i for i in reversed(images) if i['tier']==tier) for tier in ('full','ground','roof')},
                'detailPriority':{'tier':'ordinary','signals':[],'policy':'POI, distinctive architecture and visibility may raise priority; never invent sign text.'}})
        except (ValueError,KeyError,RuntimeError) as error:failures.append({'ownerId':owner,'error':str(error)})
    write(out/'batch.json',{'version':1,'entries':entries,'preparationFailures':failures,
        'seconds':round(time.monotonic()-start,2),'sourceInventoryCandidates':len(candidates),
        'reviewPolicy':'Starter patterns are not photo-reviewed reconstructions. Quick photo pass before fidelity approval. No production replacement.'})
    print(json.dumps({'prepared':len(entries),'failed':len(failures),'seconds':round(time.monotonic()-start,2)}))

def build(args,out):
    batch=read(out/'batch.json');report=[];start=time.monotonic()
    # Include builder sources in the fingerprint; failed/stale outputs never
    # count as a successful current asset. One failure does not stop the batch.
    code_hash=hashlib.sha256(b''.join(p.read_bytes() for p in sorted((ROOT/'scripts/blender/building_lib').glob('*.py')))+
        (ROOT/'scripts/blender/build-draft-portable-meshes.py').read_bytes()+
        (ROOT/'scripts/export-portable-building-draft.ts').read_bytes()).hexdigest()
    for entry in batch['entries']:
        recipe=out/entry['recipe'];model=out/'build'/entry['id'];state=model/'state.json'
        if entry['status']=='starter-needs-photo-pass' and not args.include_starters:
            report.append({'id':entry['id'],'status':'needs-photo-pass'});continue
        key=hashlib.sha256(recipe.read_bytes()+(out/entry['evidence']).read_bytes()+code_hash.encode()).hexdigest()
        asset=model/'assets'/f"{entry['id']}.glb"
        checks=model/'assets/export-checks.json'
        saved=read(state) if state.exists() else {}
        if (saved.get('fingerprint')==key and asset.exists() and checks.exists()
                and saved.get('assetSHA256')==digest(asset)
                and saved.get('checksSHA256')==digest(checks)):
            report.append({'id':entry['id'],'status':'cached','triangles':saved['triangles']});continue
        try:
            model.mkdir(parents=True,exist_ok=True)
            commands=[[sys.executable,str(ROOT/'scripts/blender/build-draft-portable-meshes.py'),str(recipe),
                '--evidence-root',str(out/'evidence'),'--output',str(model/'meshes.json')],
                ['node','--import','tsx',str(ROOT/'scripts/export-portable-building-draft.ts'),
                 '--input',str(model/'meshes.json'),'--recipe',str(recipe),'--output-root',str(model/'assets')]]
            for command in commands:
                run=subprocess.run(command,cwd=ROOT,capture_output=True,text=True)
                if run.returncode:raise RuntimeError((run.stderr or run.stdout)[-2000:])
            export=read(model/'assets/export-checks.json')
            write(state,{'fingerprint':key,'id':entry['id'],'status':'built','sourceStatus':entry['status'],'triangles':export['triangles'],
                'assetSHA256':digest(asset),'checksSHA256':digest(checks)})
            report.append({'id':entry['id'],'status':'built','triangles':export['triangles']})
        except (ValueError,RuntimeError) as error:
            if state.exists():state.unlink()
            report.append({'id':entry['id'],'status':'failed','error':str(error)})
    write(out/'build-report.json',{'entries':report,'seconds':round(time.monotonic()-start,2),
        'built':sum(r['status']=='built' for r in report),'cached':sum(r['status']=='cached' for r in report),
        'failed':sum(r['status']=='failed' for r in report),'notPromoted':True})
    summary=read(out/'build-report.json')
    print(json.dumps({k:v for k,v in summary.items() if k!='entries'}))

def preview(args,out):
    import shutil
    batch=read(out/'batch.json');models=[];assets=out/'preview/detail/assets'
    from recipe_review import review_warnings
    warnings=[]
    for entry in batch['entries']:
        warnings.append({'id':entry['id'],'address':entry['address'],
            'warnings':review_warnings(read(out/entry['recipe']))})
    write(out/'recipe-review-warnings.json',{'policy':'Photo review suggestions; no automatic geometry or material changes.',
        'entries':warnings,'flagged':sum(bool(e['warnings']) for e in warnings)})
    assets.mkdir(parents=True,exist_ok=True)
    report=read(out/'build-report.json');valid={r['id'] for r in report['entries'] if r['status'] in ('built','cached')}
    for entry in batch['entries']:
        source=out/'build'/entry['id']/'assets'
        if entry['id'] not in valid:continue
        recipe=read(out/entry['recipe'])
        for model in read(source/'manifest.json')['models']:
            models.append({**model,'frontageLocal':recipe['placement']['frontageLocal'],
                'massingMode':recipe.get('massing',{}).get('mode'),
                'appearanceRoof':recipe.get('massing',{}).get('appearanceRoof'),
                'authoringStatus':recipe.get('authoringStatus'),
                'reviewHold':entry.get('reviewHold'),
                'acceptance':'isolated draft; fidelity and district acceptance pending'})
        for extension in ('.glb','.recipe.json'):
            shutil.copy2(source/(entry['id']+extension),assets/(entry['id']+extension))
    write(assets/'manifest.json',{'version':1,'scope':'Unreviewed authoring batch previews','models':models})
    run=subprocess.run(['node','--import','tsx',str(ROOT/'scripts/render-building-lod-projections.ts'),
        '--root',str(out/'preview'),'--source-root',str(assets),'--detail-only','--incremental'],cwd=ROOT)
    if run.returncode:raise RuntimeError('Batch preview failed')
    command=['node','--import','tsx',str(ROOT/'scripts/building-batch-review.ts'),'--root',str(out)]
    if args.publish_root:command+=['--publish-root',str(args.publish_root)]
    if args.page_name:command+=['--page-name',args.page_name]
    run=subprocess.run(command,cwd=ROOT)
    if run.returncode:raise RuntimeError('Batch review sheet failed')

def apply(args,out):
    """Apply compact existing-IR edits without touching owner/source fields."""
    if not args.edits:raise ValueError('apply requires --edits')
    edits=read(args.edits);batch=read(out/'batch.json');entries={e['id']:e for e in batch['entries']}
    allowed={'storeys','storeyLayout','materials','gable','roof','frontages','assumptions','authoringStatus','details','massing','height','heightChoice'}
    changed=[];errors=[]
    def merge(base,patch):
        result=copy.deepcopy(base)
        for key,value in patch.items():
            result[key]=merge(result[key],value) if isinstance(value,dict) and isinstance(result.get(key),dict) else copy.deepcopy(value)
        return result
    for edit in edits['edits']:
        try:
            entry=entries[edit['id']];p=out/entry['recipe'];original=read(p);patch=copy.deepcopy(edit['recipe'])
            if 'reviewHold' in edit and edit['reviewHold'] is not None and (not isinstance(edit['reviewHold'],str) or not edit['reviewHold'].strip()):
                raise ValueError('Review hold needs a nonempty reason or null to clear')
            if 'detailPriority' in edit and edit['detailPriority'] not in ('automatic','ordinary','extra'):
                raise ValueError('Unknown detail attention tier')
            if set(patch)-allowed:raise ValueError('Photo edit cannot replace owner/source identity fields')
            if 'massing' in patch and set(patch['massing'])-{'appearanceRoof'}:raise ValueError('Photo massing edits may change only explicit appearanceRoof')
            fronts=patch.pop('frontages',None);recipe=merge(original,patch)
            if 'storeyLayout' in patch and 'storeys' not in patch:recipe.pop('storeys',None)
            if 'storeys' in patch and 'storeyLayout' not in patch:recipe.pop('storeyLayout',None)
            if fronts is not None:
                for front in fronts:
                    existing=next(f for f in recipe['frontages'] if f['id']==front['id'])
                    if set(front)&{'origin','rotation','width'}:raise ValueError('Photo pass cannot move the physical facade')
                    index=recipe['frontages'].index(existing);recipe['frontages'][index]=merge(existing,front)
            recipe['authoringStatus']='photo-pass draft; simplified likeness review pending'
            issues=validate(resolve(recipe))
            if issues:raise ValueError('; '.join(issues))
            before=out/'before-photo-pass'/p.name
            if not before.exists():write(before,original)
            write(p,recipe);entry['status']='photo-pass-draft';entry['photoPassNotes']=edit.get('notes','')
            if 'reviewHold' in edit:entry['reviewHold']=edit['reviewHold']
            if 'detailPriority' in edit:
                entry['manualDetailPriority']=edit['detailPriority']
            changed.append(edit['id'])
        except (ValueError,KeyError,StopIteration) as error:errors.append({'id':edit['id'],'error':str(error)})
    write(out/'batch.json',batch);write(out/'photo-pass-report.json',{'changed':changed,'failures':errors})
    print(json.dumps({'photoEdited':len(changed),'failed':errors}))

def run(args,out):
    if args.edits:apply(args,out)
    build(args,out);preview(args,out)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','apply','build','preview','run','normalize-starters'])
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--limit',type=int,default=40)
    parser.add_argument('--offset',type=int,default=0);parser.add_argument('--include-starters',action='store_true')
    parser.add_argument('--edits',type=Path)
    parser.add_argument('--publish-root',type=Path)
    parser.add_argument('--exclude-batch',type=Path,action='append',default=[])
    parser.add_argument('--page-name')
    args=parser.parse_args();out=args.output.resolve()
    if not out.is_relative_to(ROOT/'artifacts'):raise ValueError('Batch output must be isolated under artifacts')
    if args.phase=='prepare' and (out/'batch.json').exists():raise ValueError('Batch already exists; use another output path')
    {'prepare':prepare,'apply':apply,'build':build,'preview':preview,'run':run,'normalize-starters':normalize_starters}[args.phase](args,out)
