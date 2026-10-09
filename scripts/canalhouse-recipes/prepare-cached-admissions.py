#!/usr/bin/env python3
"""Prepare evidence records for explicit human-authored recipes from cached trials."""
import argparse,hashlib,json,subprocess,tempfile
from datetime import datetime,timezone
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--inventory',required=True);p.add_argument('--stage',required=True);p.add_argument('--references',default='docs/references/canalhouse-recipes');a=p.parse_args();D=Path(a.references);P=Path(a.stage);inventory=json.loads(Path(a.inventory).read_text());joins=json.loads((P/'official-parent-joins.json').read_text());parents=json.loads((P/'official-pands.json').read_text())
def api_source(path):
 path=Path(path);data=json.loads(path.read_text());return {'url':data['links'][0]['href'],'rawPath':str(path.resolve()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
def camera(image):return {'pano_id':image['panoramaId'],'timestamp':image['captureDate'],'_links':{'equirectangular_medium':{'href':image['sourceUrl']}}}
for e in inventory['entries']:
 stem=e['address'].lower().replace(' ','-');recipe=json.loads((D/f'{stem}-recipe-input.json').read_text());id=recipe['id'];pid=e['cachedOwnerId'];street,number=e['address'].rsplit(' ',1);native=json.loads((P/f'{number}-native-screen.json').read_text());survey=json.loads((D/f'{id}-survey.json').read_text());active=[j for j in joins if j['pand']==pid];parent=parents[pid]
 assert number.isdigit(),'Select an explicit base house number'
 child_ids={url.split('/')[-1] for url in parent['feature']['properties'].get('verblijfsobject.href',[])}
 assert active and all(j['feature']['properties'].get('status')=='Verblijfsobject in gebruik' and j['feature']['id'] in child_ids and parent['feature']['id'] in {url.split('/')[-1] for url in j['feature']['properties'].get('pand.href',[])} for j in active),'Non-reciprocal or inactive official join'
 canonical=[j for j in active if j['feature']['properties'].get('openbare_ruimte_naam')==street and str(j['feature']['properties'].get('huisnummer'))==number]
 assert canonical,'Missing exact requested canonical street and base house number'
 # Apartment suffixes share the selected base address. Choose its official VBO
 # deterministically, retaining every reciprocal corner alias in join evidence.
 vbo=min(canonical,key=lambda j:(j['feature']['properties']['identificatie'],j['feature']['id'],j['raw']))
 body=min(h for hs in native['endpointHeights'] for h in hs);register=json.loads((P/f'{number}-register.json').read_text());rce=next((r for r in register if r.get('source')=='rce'),None);full=next(i for i in e['images'] if i['tier']=='full');lower_tier=recipe.get('lowerReferenceTier','ground');assert lower_tier in ['full','ground'],'Unsupported lower reference tier';near=next(i for i in e['images'] if i['tier']==lower_tier);raw=Path(e['nativeRawSource']['path']);family=recipe['crown'].get('shape',{}).get('family',e.get('crownFamily'))
 assert family in ['lijst','hals','klok','punt','trap'],'Explicit source-observed crown family required'
 source_wall_id=recipe.get('sourceBodyWallId')
 if source_wall_id:
  wall=next(w for w in survey['facadeWallsRD'] if w['surfaceId']==source_wall_id)
  body=max(v[2] for v in wall['vertices'])-survey['attributes']['b3_h_maaiveld']
 assert survey['bagId']==pid and body>0
 admission={'schemaVersion':1,'id':id+'-source-admission','observedOn':datetime.now(timezone.utc).date().isoformat(),'status':'human-source-screened;candidate-only','officialIdentity':{'address':e['address'],'pandId':pid,'vboId':vbo['feature']['properties']['identificatie'],'vboSource':api_source(vbo['raw']),'pandSource':api_source(parent['raw']),'joinEvidence':{'method':'Exact official Pand verblijfsobject.href joins reciprocal VBO pand.href UUID','pandFeatureId':parent['feature']['id'],'vboFeatureIds':[j['feature']['id'] for j in active]}},'sourceProvenance':{'raw3DBag':{**e['nativeRawSource'],'rawPath':str(raw.resolve()),'url':json.loads(Path(str(raw)+'.source.json').read_text())['url']},'sourceCommit':None,'archiveSync':'pending-local-private-pack','archiveModelManifestPath':f'models/{id}/manifest.json','registerGeneration':'datasets/amsterdam-monument-register/2026-10-05T06-10-55-572Z-83107','registerMatches':register,'processedReferences':e['images'],'privateLocalPack':str(P),'beeldbankAccess':'No new fetch; municipal-first ordinary-house trial. Targeted archive questions deferred.'},'native':{'surveyFootprintPolygonsRD':survey['surveyFootprintPolygonsRD'],'municipalBagGeometryWGS84':parent['feature']['geometry']},'principalFront':{'orientedLeftToRightAsSeenFromCanal':native['exact'],'facadePlaneToleranceM':.1},'heights':{'groundNapM':native['ground'],'bodyEavesNominalM':body,'bodyEavesAdmission':('Explicit source-selected facade wall top; photo registration uncalibrated.' if source_wall_id else 'Lower exact native roof-end height; unequal ends retained. Photo positions uncalibrated.'),'sourceBodyWallId':source_wall_id,'endpointHeightCandidatesM':native['endpointHeights']},'houses':[{'id':id,'pandId':pid,'address':e['address'],'crown':{'label':family,'profileNormalized':e.get('explicitCrownProfile',[[0,1],[1,1]])},'criticalTraits':e['criticalTraits'],'uncertainties':['Coarse photo proportions, source/native height registration uncalibrated','No cached register match' if not register else 'Current versus historical alterations not fully resolved'],'sources':{'captureDate':full['captureDate'],'nearCaptureDate':near['captureDate'],'projection':{'camera':camera(full)},'nearCamera':camera(near),'principalImage':full['path'],'nearImage':near['path'],'lowerReferenceTier':lower_tier,'registerUrl':rce['recordUrl'] if rce else None,'registerDescription':[x['text'] for x in rce['descriptions']] if rce else [],'nearWholeRootCrop':str(P/f'{number}-near-perspective.jpg'),'rootInspection':e['rootInspection']}}]}
 target=D/f'{id}-source-admission.json'
 if target.exists():raise ValueError(f'Refusing to overwrite existing evidence: {target}')
 # Finalize before writing: invalid/mismatched cached cameras cannot leave a
 # partially authored admission behind. RD conversion lives in the shared TS helper.
 helper=Path(__file__).resolve().with_name('finalize-admission-camera.ts')
 manifest=P/f'{number}-neighbor-camera-manifest.json'
 with tempfile.TemporaryDirectory() as temp:
  draft=Path(temp)/'admission.json';draft.write_text(json.dumps(admission))
  finalized=subprocess.run(['node','--import','tsx',str(helper),'--admission',str(draft),'--manifest',str(manifest.resolve()),'--stdout'],cwd=helper.parents[2],check=True,capture_output=True,text=True)
  target.write_text(finalized.stdout)
print(json.dumps({'admissions':len(inventory['entries']),'status':'camera-finalized;not-acceptance'}))
