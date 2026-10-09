"""Recover saved component topology for a GPU-free, unpromoted LOD study.

This is not a Blender exporter. Coordinates are local, transforms are serialized
inputs, and face triangulation/normal evaluation remain deliberately unclaimed.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from read_blend import BlendFile
from building_lod import keep_object


def inspect(path):
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    blend = BlendFile(path)
    objects = []
    estimates = Counter()
    for block, offset in blend.records('Object'):
        if offset: raise ValueError('Unexpected array of object IDs')
        props = blend.properties(block)
        name = blend.field(block, 0, 'ID', 'name')[2:]
        obj = dict(address=str(block['address']), name=name, properties=props,
                   type=blend.field(block,0,'Object','type'))
        obj['transform'] = {key: blend.field(block,0,'Object',key) for key in
                            ('parent','partype','loc','dloc','size','dsize','dscale',
                             'rot','drot','rotmode','quat','dquat','parentinv')}
        obj['transform']['parent'] = str(obj['transform']['parent'])
        obj['unevaluated'] = {}
        for field in ('modifiers','constraints'):
            off = blend.types['Object']['fields'][field]['offset']
            obj['unevaluated'][field] = bool(blend.field(block,off,'ListBase','first'))
        if obj['type'] == 1:
            mesh = blend.resolve(block,blend.field(block,0,'Object','data'),'Mesh')
            positions, faces, attributes = blend.mesh_arrays(mesh)
            obj['mesh'] = dict(positions=positions,faces=faces,
                attributes={key:{k:v for k,v in value.items() if k!='data'} for key,value in attributes.items()})
            # Polygon count estimate, not a claim about Blender's evaluated GLB.
            triangles = sum(len(face)-2 for face in faces)
            source_only = bool(props.get('sourceOnly',False))
            obj['sourceOnly'] = source_only
            obj['keep'] = {level: source_only or keep_object(name,level,
                component_kind=props.get('componentKind',''),
                feature_id=props.get('featureId',''),component_id=props.get('componentId',''))
                for level in ('facade','massing')}
            if not source_only:
                estimates['detail'] += triangles
                for level, keep in obj['keep'].items():
                    if keep: estimates[level] += triangles
        objects.append(obj)
    if hashlib.sha256(path.read_bytes()).hexdigest() != before:
        raise ValueError('Source scene changed during read')
    return dict(source=str(path),sha256=before,status='read-only topology; unpromoted',
                evaluatedExport=False, estimatedPolygonTriangles=dict(estimates),objects=objects)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('scenes',nargs='+',type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    summary = []
    for path in args.scenes:
        result = inspect(path)
        (args.output / (path.stem+'.json')).write_text(json.dumps(result,separators=(',',':'))+'\n')
        summary.append({key:result[key] for key in ('source','sha256','status','evaluatedExport','estimatedPolygonTriangles')})
        print(path.stem,result['estimatedPolygonTriangles'])
    (args.output/'report.json').write_text(json.dumps(summary,indent=2)+'\n')
