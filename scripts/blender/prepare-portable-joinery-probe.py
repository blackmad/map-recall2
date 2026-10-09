"""Prepare ordinary opening probes; projecting assembly transforms excluded."""
import json,math
from pathlib import Path
from building_lib.opening_mesh_capture import capture_opening
ROOT=Path(__file__).resolve().parents[2]
samples=[];excluded=[]
for identifier in ('rozengracht-158','derde-looiersdwarsstraat-61-73','derde-goudsbloemdwarsstraat-31-39'):
    recipe=json.loads((ROOT/'public/canal-drive/models/building-library'/f'{identifier}.recipe.json').read_text())
    for front in recipe['frontages']:
        projected={opening for bay in front.get('groupedBays',[]) for opening in bay['openingIds']}
        for opening in front['openings']:
            if 'warehouse' in opening or opening['id'] in projected:
                excluded.append({'modelId':identifier,'featureId':opening['id'],'reason':'separate projecting bay/shutter assembly transform'});continue
            meshes,_=capture_opening(opening,'frame','glass','brass')
            c,s=math.cos(front.get('rotation',0)),math.sin(front.get('rotation',0));ox,oy=front['origin']
            for mesh in meshes:mesh['vertices']=[[ox+x*c-y*s,oy+x*s+y*c,z] for x,y,z in mesh['vertices']]
            samples.append({'modelId':identifier,'frontageId':front['id'],'featureId':opening['id'],
                            'head':opening.get('head','rectangular'),'meshes':meshes})
output=ROOT/'artifacts/jordaan-building-library/overnight-source-review/cafe-draft'
(output/'joinery-probe.json').write_text(json.dumps(samples,separators=(',',':'))+'\n')
(output/'joinery-probe-exclusions.json').write_text(json.dumps(excluded,indent=2)+'\n')
print('Prepared',len(samples),'ordinary opening probes;',len(excluded),'unsupported assembly probes excluded explicitly')
