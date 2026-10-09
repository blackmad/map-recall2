"""Unequal compound fronts keep roof ownership and material apertures intact."""
import copy,json,sys,unittest
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.ir import resolve
from building_lib.appearance_massing import appearance_shell,pitched_covering
from building_lib.source_massing import compile_source_massing
from building_lib.component_catalog import resolve_zone
from building_lib.facade_finish import zone_mesh
from building_lib.portable_triangulation import earcut_rings
from building_lib.polygons import area,cross

def fixture():
    return json.loads((ROOT/'artifacts/building-batch-scale-200/recipes/bag-0363100012169527.recipe.json').read_text())

class SteppedFlatFronts(unittest.TestCase):
    def test_independent_flat_parts_close_and_conserve_owner(self):
        for scale in (.8,1,1.25):
            r=fixture();f=r['frontages'][0];f['width']*=scale
            f['profile']=[[x*scale,z] for x,z in f['profile']]
            r['footprint']=[[x*scale,y] for x,y in r['footprint']]
            r=resolve(r);before=copy.deepcopy(r);spec=r['massing']['appearanceRoof']
            roof=pitched_covering(r,spec);w=f['width']
            self.assertAlmostEqual(roof.height(w*.25,2),15)
            self.assertAlmostEqual(roof.height(w*.75,2),12)
            self.assertAlmostEqual(sum(abs(area([roof.vertices[i][:2] for i in face])) for face in roof.triangles),abs(area(r['footprint'])),places=5)
            edges=Counter();points={}
            for surface in appearance_shell(r)['surfaces']:
                ring=surface['rings'][0]
                for a,b in zip(ring,ring[1:]+ring[:1]):
                    key=tuple(sorted(tuple(round(v,3) for v in p) for p in (a,b)));edges[key]+=1;points[key]=(a,b)
            self.assertTrue(all(n==2 or all(abs(p[2])<1e-7 for p in points[k]) for k,n in edges.items()))
            self.assertTrue(compile_source_massing(r).audit['sourceClosedAboveGround'])
            self.assertEqual(before,r)

    def test_material_zone_is_closed_and_leaves_glazing_visible(self):
        r=resolve(fixture());front=r['frontages'][0];zone=resolve_zone(front['materialZones'][0],front,12)
        before=copy.deepcopy(front);mesh=zone_mesh(zone,front,earcut_rings);edges=Counter()
        for face in mesh.faces:
            for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1
        self.assertTrue(all(n==2 for n in edges.values()))
        def covered(x,z):
            for face in mesh.faces:
                vertices=[mesh.vertices[i] for i in face]
                if any(abs(p[1]-zone['frontDepth'])>1e-7 for p in vertices):continue
                points=[(p[0],p[2]) for p in vertices]
                if all(cross(a,b,(x,z))>=-1e-8 for a,b in zip(points,points[1:]+points[:1])) or all(cross(a,b,(x,z))<=1e-8 for a,b in zip(points,points[1:]+points[:1])):return True
            return False
        own=[o for o in front['openings'] if o['x']>front['width']/2]
        self.assertEqual(len(own),13)
        for o in own:self.assertFalse(covered(o['x'],o['z']),o['id'])
        self.assertTrue(covered(front['width']*.505,5))
        self.assertEqual(before,front)
        bad=copy.deepcopy(zone);bad['width']*=.9
        with self.assertRaises(ValueError):zone_mesh(bad,front,earcut_rings)

    def test_bad_part_heights_and_silhouettes_rejected(self):
        r=resolve(fixture())
        for patch in ({'eaves':11},{'peak':16},{'eaves':float('nan')},{'eaves':'15'},{'fraction':.4}):
            bad=copy.deepcopy(r);bad['massing']['appearanceRoof']['parts'][0].update(patch)
            with self.assertRaises(ValueError):appearance_shell(bad)
        bad=copy.deepcopy(r);bad['frontages'][0]['profile'][0][1]=14
        with self.assertRaises(ValueError):appearance_shell(bad)

if __name__=='__main__':unittest.main()
