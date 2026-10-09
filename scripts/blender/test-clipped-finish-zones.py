"""Finish bands crossing doors/windows preserve voids and closed boundaries."""
import copy,json,unittest
from pathlib import Path
from collections import Counter
from building_lib.facade_finish import zone_mesh
from building_lib.portable_triangulation import earcut_rings
from building_lib.polygons import area,cross
from building_lib.component_catalog import resolve_zone

def front():
    return {'width':6,'openings':[
        {'id':'door','kind':'door','storey':'ground','x':1,'z':1.5,'width':1,'height':3},
        {'id':'window','kind':'window','storey':'ground','x':3,'z':1.75,'width':1,'height':2.5},
        {'id':'arched','kind':'window','storey':'ground','x':5,'z':1.75,'width':1,'height':2.5,'head':'segmental','archRise':.2}]}

def zone(x=3,width=6,z=.8,height=1.6):
    return {'id':'lower-stone','construction':'clipped','material':'limestone','colour':'#88877b',
            'x':x,'z':z,'width':width,'height':height,'frontDepth':-.085,'thickness':.025}

def surface_area(mesh,depth):
    return sum(abs(area([(mesh.vertices[i][0],mesh.vertices[i][2]) for i in face]))
        for face in mesh.faces if all(abs(mesh.vertices[i][1]-depth)<1e-9 for i in face))

def covered(mesh,x,z,depth):
    for face in mesh.faces:
        if len(face)!=3 or any(abs(mesh.vertices[i][1]-depth)>1e-9 for i in face):continue
        points=[(mesh.vertices[i][0],mesh.vertices[i][2]) for i in face]
        if all(cross(a,b,(x,z))>=-1e-9 for a,b in zip(points,points[1:]+points[:1])):return True
    return False

class ClippedZones(unittest.TestCase):
    def test_real_aligned_arched_frontage_reuses_identical_geometry(self):
        root=Path(__file__).resolve().parents[2]
        r=json.loads((root/'artifacts/building-batch-pilot/recipes/bag-0363100012172675.recipe.json').read_text())
        f=r['frontages'][0];before=copy.deepcopy(f)
        for height in (1.1,1.35,1.6):
            spec=resolve_zone(dict(f['materialZones'][0],height=height,z=height/2),f,r['roof']['eaves'])
            a=zone_mesh(spec,f);b=zone_mesh(spec,f,earcut_rings)
            self.assertEqual(a,b)
            for o in f['openings']:
                if o['storey']=='ground':self.assertFalse(covered(a,o['x'],.9,spec['frontDepth']))
            self.assertTrue(covered(a,.05,.9,spec['frontDepth']))
        self.assertEqual(f,before)

    def test_lower_band_does_not_block_entries_or_lower_glazing(self):
        f=front();before=copy.deepcopy(f)
        for triangulator in (None,earcut_rings):
            mesh=zone_mesh(zone(),f,triangulator)
            # 6*1.6 minus door(1*1.6), and two windows(1*1.1 each).
            self.assertAlmostEqual(surface_area(mesh,-.085),5.8)
            for x,z in [(1,.1),(1,1.5),(3,.8),(5,1.4)]:self.assertFalse(covered(mesh,x,z,-.085))
            for x,z in [(.2,.1),(2,.8),(3,.2),(5,.2),(5.8,1.4)]:self.assertTrue(covered(mesh,x,z,-.085))
            directed=Counter((a,b) for face in mesh.faces for a,b in zip(face,face[1:]+face[:1]))
            self.assertTrue(all(n==1 and directed[b,a]==1 for (a,b),n in directed.items()))
        self.assertEqual(f,before)

    def test_side_crossing_and_arch_cut_are_closed_in_both_consumers(self):
        f=front()
        for spec in (zone(x=3.6,width=4,z=1.5,height=2),zone(x=5,width=1.4,z=2.85,height=.5)):
            meshes=[zone_mesh(spec,f,t) for t in (None,earcut_rings)]
            self.assertAlmostEqual(surface_area(meshes[0],-.085),surface_area(meshes[1],-.085))
            self.assertTrue(all(spec['x']-spec['width']/2-1e-9<=p[0]<=spec['x']+spec['width']/2+1e-9 for m in meshes for p in m.vertices))
            for mesh in meshes:
                edges=Counter(tuple(sorted((a,b))) for face in mesh.faces for a,b in zip(face,face[1:]+face[:1]))
                self.assertTrue(all(n==2 for n in edges.values()))
        self.assertFalse(covered(meshes[0],5,2.9,-.085))
        self.assertTrue(covered(meshes[0],5.6,2.9,-.085))

    def test_contracts_and_empty_surface_rejected(self):
        f=front()
        self.assertEqual(resolve_zone(zone(),f,4)['construction'],'clipped')
        with self.assertRaises(ValueError):zone_mesh(zone(x=1,width=.4,z=1,height=.4),f,earcut_rings)
        for change in ({'construction':'unknown'},{'width':99},{'thickness':.2}):
            with self.assertRaises(ValueError):resolve_zone(dict(zone(),**change),f,4)

if __name__=='__main__':unittest.main()
