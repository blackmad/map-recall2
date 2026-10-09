"""Isolated source-derived draft mesh study; no Blender/GLB acceptance claim."""
import argparse,json,math,hashlib
from pathlib import Path
from building_lib.ir import resolve
from building_lib.schema import validate
from building_lib.batch import evidence_for
from building_lib.source_massing import compile_source_massing,frontage_profile
from building_lib.facade_mesh import compile_facade
from building_lib.opening_mesh_capture import capture_opening,capture_warehouse
from building_lib.portable_triangulation import earcut_rings
from building_lib.component_catalog import resolve as resolve_component
from building_lib.cornice_plan import cornice_blocks
from building_lib.balcony_plan import balcony_blocks
from building_lib.layout import SURFACES


def build(recipe,evidence_root):
    recipe=resolve(recipe);errors=validate(recipe)
    if errors:raise ValueError(errors)
    evidence_for(recipe,evidence_root)
    if recipe.get('massing',{}).get('mode')!='source-derived' or recipe.get('geometryMode')!='apertures':
        raise ValueError('Portable study requires source-derived aperture recipe')
    if any(value for key,value in recipe.get('details',{}).items() if key not in ('sourceDormers','appearanceDormers')):raise ValueError('Portable study implements only explicitly supported flat dormers among roof details')
    objects=[];compiled=compile_source_massing(recipe)
    wall=recipe['materials'].get('wallColour','#855842');roof='#454c4d'
    for surface in compiled.surfaces:
        objects.append({'name':'Massing / '+('inferred-appearance ' if recipe.get('massing',{}).get('appearanceRoof') else 'source-derived ')+surface['type']+' '+str(surface['index']),
            'vertices':surface['vertices'],'faces':surface['triangles'],
            'material':roof if surface['type']=='roof' else wall,'sourceDerived':not recipe.get('massing',{}).get('appearanceRoof')})
    def place(obj,front):
        c,s=math.cos(front['rotation']),math.sin(front['rotation']);ox,oy=front['origin']
        obj['vertices']=[[ox+x*c-y*s,oy+x*s+y*c,z] for x,y,z in obj['vertices']]
        obj['frontageId']=front['id'];objects.append(obj)
    for front in recipe['frontages']:
        if any(front.get(key) for key in ('openFrames','recessedUpperPanels')):
            raise ValueError('Portable study has unsupported facade assemblies')
        store=front.get('storefront',{})
        if store.get('cornice',True) or any(store.get(key) for key in ('signs','awnings','recessedAssemblies')):
            raise ValueError('Portable study requires undecorated ground assembly')
        mesh=compile_facade(front['width'],frontage_profile(recipe,front),front['openings'],triangulator=earcut_rings)
        place({'name':'Facade / '+front['id'],'vertices':mesh.vertices,'faces':mesh.faces,'material':wall},front)
        if front.get('coping'):
            from building_lib.gables import coping_mesh
            spec=front['coping']
            vertices,faces=coping_mesh(frontage_profile(recipe,front),spec.get('width',.11),spec.get('depth',.34),inset_top=True)
            place({'name':'Gable / continuous coping','vertices':vertices,'faces':faces,
                'material':spec['colour'],'componentKind':'gable-coping'},front)
        from building_lib.facade_finish import finish_mesh
        finish=finish_mesh(recipe,front,earcut_rings)
        if finish:
            place({'name':'Upper finish / '+front['id'],'vertices':finish.vertices,'faces':finish.faces,
                'material':front['upperFinish']['colour'],'componentKind':'upper-finish'},front)
        ground=[o for o in front['openings'] if o['storey']=='ground']
        finish=compile_facade(front['width'],[(0,store['height']),(front['width'],store['height'])],ground,-.065,-.03,triangulator=earcut_rings)
        place({'name':'Ground / '+front['id'],'vertices':finish.vertices,'faces':finish.faces,'material':store['finishColour']},front)
        from building_lib.entrance_stairs import stair_meshes
        for step in store.get('entranceSteps',[]):
            for obj in stair_meshes(step,front,recipe):
                obj['featureId']=step['id'];place(obj,front)
        from building_lib.component_catalog import resolve_zone
        from building_lib.facade_finish import zone_mesh
        for raw in front.get('materialZones',[]):
            zone=resolve_zone(raw,front,recipe['roof']['eaves'])
            finish=zone_mesh(zone,front,earcut_rings)
            place({'name':zone['id']+' / material finish','vertices':finish.vertices,'faces':finish.faces,
                'material':zone['colour'],'materialZoneId':zone['id'],'componentKind':'material-zone'},front)
        for spec in front['openings']:
            from building_lib.grouped_bays import opening_owners
            if spec['id'] in opening_owners(front):continue
            from building_lib.warehouse import warehouse_opening_spec
            spec=warehouse_opening_spec(spec)
            meshes,_=capture_opening(spec,spec.get('frameColour','#d7d5bd'),spec.get('glassColour','#3e4c4a'),'#9f8851')
            for obj in meshes:obj['featureId']=spec['id'];place(obj,front)
        attachments,_=capture_warehouse(front,recipe)
        for obj in attachments:
            obj['componentKind']=obj.get('warehouseComponent');place(obj,front)
        from building_lib.grouped_bays import bay_plan
        from building_lib.grouped_bay_shell import shell_parts
        for raw in front.get('groupedBays',[]):
            plan=bay_plan(raw,front,recipe['roof']['eaves'])
            for obj in shell_parts(plan,plan.get('colour',wall),plan.get('frameColour','#d7d5bd'),plan.get('glassColour','#3e4c4a')):place(obj,front)
        for raw in front.get('components',[]):
            spec=resolve_component(raw,front,recipe['roof']['eaves'])
            blocks=[]
            if spec['kind']=='cornice':
                for label,x,z,w,h,d in cornice_blocks(spec):
                    if any(min((w+o['width'])/2-abs(x-o['x']),
                               (h+o['height'])/2-abs(z-o['z']))>1e-7 for o in front['openings']):
                        raise ValueError('Portable cornice overlaps an aperture; Blender Boolean required')
                    blocks.append((label,x,SURFACES['shell_front']-d/2,z,w,d,h,spec.get('colour','#d7d5bd')))
            elif spec['kind']=='pilaster':
                from building_lib.pilaster_plan import pilaster_mesh,pilaster_blocks
                vertices,faces=pilaster_mesh(spec,SURFACES['shell_front'])
                if any(min((spec['width']+.12+o['width'])/2-abs(spec['x']-o['x']),
                           (spec['height']+o['height'])/2-abs(spec['z']-o['z']))>1e-7 for o in front['openings']):
                    raise ValueError('Pilaster crosses an aperture; author piers between openings')
                place({'name':spec['id']+' / shaft','vertices':vertices,'faces':faces,'material':spec.get('colour','#d7d5bd'),'componentId':spec['id'],'componentKind':'pilaster'},front)
                blocks=[(*block,spec.get('colour','#d7d5bd')) for block in pilaster_blocks(spec,SURFACES['shell_front'])]
            elif spec['kind']=='balcony':
                blocks=[(*block[:-1],spec.get('colour','#b5afa0') if block[-1]=='slab' else spec.get('frameColour','#343b37'))
                        for block in balcony_blocks(spec,SURFACES['shell_front'])]
            elif spec['kind'] in ('stringcourse','lintel','sill'):
                if any(min((spec['width']+o['width'])/2-abs(spec['x']-o['x']),
                           (spec['height']+o['height'])/2-abs(spec['z']-o['z']))>1e-7 for o in front['openings']):
                    raise ValueError('Portable masonry band overlaps an aperture; adjust its datum')
                blocks=[(spec['kind'],spec['x'],SURFACES['shell_front']-spec['projection']/2,spec['z'],
                         spec['width'],spec['projection'],spec['height'],spec.get('colour','#d7d5bd'))]
            else:raise ValueError('Portable study supports pilasters, cornices, balconies and simple masonry bands')
            for label,x,y,z,w,d,h,colour in blocks:
                vertices=[[x+sx*w/2,y+sy*d/2,z+sz*h/2]
                          for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)]
                place({'name':spec['id']+' / '+label,'vertices':vertices,
                       'faces':[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],
                       'material':colour,'componentId':spec['id'],'componentKind':spec['kind']},front)
    from building_lib.source_attachments import dormer_plan,pitched_dormer_cap
    for raw in recipe.get('details',{}).get('sourceDormers',[])+recipe.get('details',{}).get('appearanceDormers',[]):
        p=dormer_plan(recipe,raw)
        if p['capRise']:raise ValueError('Portable source dormer currently requires a flat cap')
        x,y,w,d=p['x'],p['frontY'],p['width'],p['bodyDepth'];bottom,head=p['bottom'],p['head']
        windows=[dict(o,x=o['x']-x+w/2,z=o['z']-bottom) for o in p['windows']]
        mesh=compile_facade(w,[(0,head-bottom),(w,head-bottom)],windows,front=y,back=y+min(d,.29),triangulator=earcut_rings)
        body={'name':p['id']+' / pierced front cheeks','vertices':[[xx+x-w/2,yy,zz+bottom] for xx,yy,zz in mesh.vertices],'faces':mesh.faces,'material':raw.get('wallColour',wall)}
        parts=[body]
        boxes=[('flat cap',x,y+d/2-.025,head+.04,w+.12,d+.13,.10,raw.get('roofColour',roof)),
               ('pale front fascia',x,y-.045,head-.03,w+.10,.12,.14,raw.get('frameColour','#d7d5bd'))]
        if p['capStyle']=='pitched':
            vertices,faces=pitched_dormer_cap(p);parts.append({'name':p['id']+' / pitched cap','vertices':vertices,'faces':faces,'material':raw.get('roofColour',roof)});boxes=boxes[1:]
        if d>.29:boxes.append(('closed rear cheeks',x,y+(.29+d)/2,(bottom+head)/2,w,d-.29,head-bottom,raw.get('wallColour',wall)))
        for label,bx,by,bz,bw,bd,bh,colour in boxes:
            parts.append({'name':p['id']+' / '+label,'vertices':[[bx+sx*bw/2,by+sy*bd/2,bz+sz*bh/2] for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)],
                'faces':[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],'material':colour})
        for opening in p['windows']:
            joinery,_=capture_opening(dict(opening,glazingDepth=.12),raw.get('frameColour','#d7d5bd'),raw.get('glassColour','#3e4c4a'))
            for obj in joinery:obj['vertices']=[[xx,yy+y+.035,zz] for xx,yy,zz in obj['vertices']]
            parts.extend(joinery)
        for obj in parts:obj['componentId']=p['id'];obj['componentKind']='appearance-roof-box' if p.get('assembly')=='roof-box' else 'appearance-roof-dormer' if p.get('supportMode')=='inferred-appearance-roof' else 'source-roof-dormer';objects.append(obj)
    return {'status':'isolated portable draft; not promoted','recipeId':recipe['id'],'buildingId':recipe['buildingId'],
            'sourceAudit':compiled.audit,'objects':objects,'placement':recipe['placement'],
            'remaining':['Independent baseline joinery comparison','Native decorative gable reconciliation','Actual GPU/shader render critique','GLB/placement verification']}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('recipe',type=Path);parser.add_argument('--evidence-root',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    original=args.recipe.read_bytes();result=build(json.loads(original),args.evidence_root)
    result['recipeSHA256']=hashlib.sha256(original).hexdigest();args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,separators=(',',':'))+'\n')
    assert args.recipe.read_bytes()==original
    print('Recovered',len(result['objects']),'draft mesh objects without scene mutation')
