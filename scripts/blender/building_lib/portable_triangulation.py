"""Explicit Node earcut adapter for isolated portable draft studies.

Uses the installed primary package API. Geometry callers independently check
winding, area and manifold topology; a triangulator result alone is not proof.
"""
import json,subprocess
from pathlib import Path


def earcut_rings(rings):
    script="""import earcut from 'earcut';
const parts=[];for await(const part of process.stdin)parts.push(part);
const rings=JSON.parse(Buffer.concat(parts).toString());
const flat=rings.flat().flat(),holes=[];let offset=rings[0].length;
for(const ring of rings.slice(1)){holes.push(offset);offset+=ring.length;}
console.log(JSON.stringify(earcut(flat,holes,2)));
"""
    result=subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(rings),
        text=True,capture_output=True,check=True,cwd=Path(__file__).resolve().parents[3])
    indices=json.loads(result.stdout)
    if len(indices)%3:raise ValueError('Incomplete earcut triangle')
    return [tuple(indices[i:i+3]) for i in range(0,len(indices),3)]
