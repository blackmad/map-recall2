"""Author an inferred dormer with native roof support; writes an isolated edit."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from building_lib.ir import resolve
from building_lib.source_massing import compile_source_massing
from building_lib.source_attachments import dormer_plan
from building_lib.roof_surfaces import clip_half_plane
from building_lib.polygons import area
from building_lib.schema import validate

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',type=Path,required=True);parser.add_argument('--id',required=True)
parser.add_argument('--x-fraction',type=float,default=.5);parser.add_argument('--setback',type=float,default=.5)
parser.add_argument('--width',type=float,default=1.2);parser.add_argument('--height',type=float,default=1.4);parser.add_argument('--depth',type=float,default=.65)
parser.add_argument('--wall-colour');parser.add_argument('--surface-indices');parser.add_argument('--notes',required=True);parser.add_argument('--output',type=Path,required=True)
a=parser.parse_args();root=a.root.resolve();output=a.output.resolve()
if not output.is_relative_to(Path('artifacts').resolve()):raise ValueError('Dormer edits stay under isolated artifacts')
batch=json.loads((root/'batch.json').read_text());entry=next(e for e in batch['entries'] if e['id']==a.id)
original=json.loads((root/entry['recipe']).read_text());recipe=resolve(original);front=recipe['frontages'][0]
if front['origin']!=[0,0] or front['rotation']!=0:raise ValueError('Dormer authoring currently requires the primary building-local front')
if not 0<a.x_fraction<1 or a.setback<0:raise ValueError('Dormer centre must lie inside the frontage and behind it')
x=front['width']*a.x_fraction;y=a.setback;left=x-a.width/2;right=x+a.width/2
compiled=compile_source_massing(recipe,exclude_attachment_voids=True);indices=[]
for surface in compiled.surfaces:
 if surface['type']!='roof' or surface['index'] is None:continue
 covered=0
 for face in surface['triangles']:
  p=[surface['vertices'][i][:2] for i in face]
  for dist in (lambda p:p[0]-left,lambda p:right-p[0],lambda p:p[1]-y,lambda p:y+a.depth-p[1]):
   p=clip_half_plane(p,dist)
   if len(p)<3:break
  if len(p)>=3:covered+=abs(area(p))
 if covered>1e-8:indices.append(surface['index'])
if a.surface_indices:indices=[int(v) for v in a.surface_indices.split(',')]
photo=entry['photos']['roof']
spec={'id':'photo-roof-dormer','sourceSurfaceIndices':indices,'x':x,'y':y,'width':a.width,'height':a.height,'depth':a.depth,
 'provenance':{'status':'inferred','basis':a.notes,'sourcePath':photo['path'],'sourceHash':photo['sha256'],'captureDate':photo['captureDate']}}
if a.wall_colour:
 import re
 if not re.fullmatch(r'#[0-9a-fA-F]{6}',a.wall_colour):raise ValueError('Dormer wall colour must be six-digit hex')
 spec['wallColour']=a.wall_colour
items=[p for p in original.get('details',{}).get('sourceDormers',[]) if p['id']!=spec['id']]+[spec]
recipe.setdefault('details',{})['sourceDormers']=items
p=dormer_plan(recipe,spec)
if p['head']+.09>recipe['height']+1e-8:raise ValueError('Dormer cap would exceed the native owner peak')
errors=validate(recipe)
if errors:raise ValueError(errors)
edit={'id':a.id,'notes':entry.get('photoPassNotes','')+' '+a.notes,'recipe':{'details':{'sourceDormers':items}}}
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps({'edits':[edit]},indent=2)+'\n')
print(json.dumps({'id':a.id,'supportSurfaceIndices':indices,'windowHeight':p['window']['height'],'head':p['head'],'output':str(output)}))
