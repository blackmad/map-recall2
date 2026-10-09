"""Export conservative LOD variants of immutable reviewed building scenes."""
import argparse,json,hashlib,sys,collections,struct,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from building_lod import keep_object,object_role

def mesh_hash(obj):
    import struct
    digest=hashlib.sha256();digest.update(bytes(str(obj.matrix_world),'utf8'))
    for v in obj.data.vertices:digest.update(struct.pack('<fff',*v.co))
    for face in obj.data.polygons:
        digest.update(struct.pack('<I',len(face.vertices)))
        for i in face.vertices:digest.update(struct.pack('<I',i))
        digest.update(struct.pack('<I?',face.material_index,face.use_smooth))
    return digest.hexdigest()

def main(argv):
    p=argparse.ArgumentParser();p.add_argument('--id',action='append',default=[]);p.add_argument('--output-root',default=str(ROOT/'artifacts/building-lod'));p.add_argument('--render',action='store_true');a=p.parse_args(argv)
    import bpy
    from building_lib.export import save_and_export
    from building_lib.review import render
    base=ROOT/'public/canal-drive/models/building-library';full=json.loads((base/'manifest.json').read_text());models=[m for m in full['models']if not m.get('synthetic')and m['id']!='material-gallery'and(not a.id or m['id']in a.id)]
    if a.id and set(a.id)-{m['id']for m in models}:raise ValueError('Unknown selected real LOD owner')
    out=Path(a.output_root);out.mkdir(parents=True,exist_ok=True);reports=[]
    manifests={level:{'version':1,'units':full['units'],'axes':full['axes'],'models':[]}for level in ('facade','massing')}
    for m in models:
        identifier=m['id'];scene=ROOT/'artifacts/building-library'/(identifier+'.blend');recipe=json.loads((base/(identifier+'.recipe.json')).read_text())
        original_scene_hash=hashlib.sha256(scene.read_bytes()).hexdigest();original_model_hash=hashlib.sha256((base/(identifier+'.glb')).read_bytes()).hexdigest()
        for level in manifests:
            bpy.ops.wm.open_mainfile(filepath=str(scene));objects=[o for o in bpy.context.scene.objects if o.type=='MESH'and not o.get('sourceOnly')]
            before={o.name:mesh_hash(o)for o in objects};omitted=[];roles=collections.Counter()
            for obj in objects:
                kind=obj.get('componentKind','');feature=obj.get('featureId','');component=obj.get('componentId','')
                if not keep_object(obj.name,level,kind,feature,component):
                    omitted.append(obj.name);roles[object_role(obj.name,feature,component)]+=1;bpy.data.objects.remove(obj,do_unlink=True)
            kept=[o for o in bpy.context.scene.objects if o.type=='MESH'and not o.get('sourceOnly')]
            assert kept and all(mesh_hash(o)==before[o.name]for o in kept),'Retained LOD geometry changed'
            objects_hash={o.name:before[o.name]for o in kept}
            for obj in kept:obj['lodLevel']=level;obj['lodOriginalModelSHA256']=original_model_hash
            assets=out/level/'assets';art=out/level/'build';art.mkdir(parents=True,exist_ok=True)
            result=save_and_export(recipe,kept,assets,art)
            assert result['triangles']<=m['triangles'];assert result['geometryRevision']==m['geometryRevision'];assert result['sourceRDFrame']==m['sourceRDFrame']
            # Tall roof/chimney/gable silhouettes must retain exact vertical anchors.
            for bound in ('min','max'):assert abs(result['boundsBlenderMetres'][bound][2]-m['boundsBlenderMetres'][bound][2])<1e-6,'LOD changed vertical envelope'
            result.update(lodLevel=level,lodOriginalModelSHA256=original_model_hash,recipeUrl=m['recipeUrl'],recipeHash=m['recipeHash'],lodScope='Same reviewed owner geometry; identified fine dressing omitted. Original reconstruction status and inference unchanged.')
            manifests[level]['models'].append(result)
            # Copy source-bound recipes/evidence without modifying the originals.
            (assets/(identifier+'.recipe.json')).write_text(json.dumps(recipe,indent=2)+'\n')
            if a.render:render(recipe,art)
            assert hashlib.sha256(scene.read_bytes()).hexdigest()==original_scene_hash and hashlib.sha256((base/(identifier+'.glb')).read_bytes()).hexdigest()==original_model_hash
            report={'id':identifier,'ownerId':m['buildingId'],'level':level,'sourceTriangles':m['triangles'],'triangles':result['triangles'],'drawCalls':result['drawCalls'],'bytes':result['bytes'],'retainedMeshes':len(kept),'removedMeshes':len(omitted),'omittedRoles':dict(roles),'retainedMeshHashes':objects_hash,'originalSceneSHA256':original_scene_hash,'originalModelSHA256':original_model_hash,'retainedGeometryExact':True,'verticalAnchorsPreserved':True,'originalAssetsUnchanged':True}
            reports.append(report);print('LOD_RESULT '+json.dumps({k:v for k,v in report.items()if k not in('retainedMeshHashes','omittedRoles')}),flush=True)
            (out/'report.json').write_text(json.dumps(reports,indent=2)+'\n')
            for key,manifest in manifests.items():
                (out/key/'assets').mkdir(parents=True,exist_ok=True);(out/key/'assets/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('LOD_BATCH '+json.dumps({'owners':len(models),'variants':len(reports),'originalAssetsUnchanged':True}),flush=True)
if __name__=='__main__':main(sys.argv[sys.argv.index('--')+1:]if '--'in sys.argv else sys.argv[1:])
