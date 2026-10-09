"""Render original measured semantic surfaces without changing or exporting them."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
import bpy
from building_lib.ir import resolve
from building_lib.source_massing import _tessellate_rings
from building_lib.geometry import mesh
from building_lib.materials.blender import material
from building_lib.review import render

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--ir',required=True);parser.add_argument('--artifact-root',required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);recipe=resolve(json.loads(Path(args.ir).read_text()))
    for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
    cache=Path(__file__).resolve().parents[2]/'.cache/blender-building-materials'
    mats={kind:material('slate' if kind=='roof' else recipe.get('wallMaterial','redbrick'),cache,recipe.get('roofColour') if kind=='roof' else recipe.get('wallColour'),style='simple') for kind in ('wall','roof','ground')}
    for index,surface in enumerate(recipe['sourceShell']['surfaces']):
        vertices,faces,_=_tessellate_rings(surface['rings'],recipe.get('massing',{}).get('maxPlanarityDeviation',.03))
        obj=mesh('Original measured '+str(index),vertices,faces,mats[surface['type']]);obj['comparisonOnly']=True
    recipe['id']+='-source';recipe['height']=max(p[2] for s in recipe['sourceShell']['surfaces'] for r in s['rings'] for p in r)
    art=Path(args.artifact_root);art.mkdir(parents=True,exist_ok=True);render(recipe,art)

if __name__=='__main__':main()
