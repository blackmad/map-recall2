"""Passage geometry stays open until its owned rear door, across sizes."""
import copy,json,sys,unittest,math
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.recessed_entries import entry_plan,entry_parts
from building_lib.opening_mesh_capture import capture_opening,_capture
from building_lib.polygons import cross

def fixture():
    r=json.loads((ROOT/'artifacts/building-batch-scale-200/recipes/bag-0363100012176870.recipe.json').read_text())
    return next(o for o in r['frontages'][0]['openings'] if o['id']=='ground-entry')

def ray_hits(objects,x,z):
    hits=[]
    for obj in objects:
        for face in obj['faces']:
            for i in range(1,len(face)-1):
                a,b,c=[obj['vertices'][j] for j in (face[0],face[i],face[i+1])]
                points=[(p[0],p[2]) for p in (a,b,c)];den=cross(*points)
                if abs(den)<1e-10:continue
                weights=[cross(points[1],points[2],(x,z))/den,cross(points[2],points[0],(x,z))/den,cross(points[0],points[1],(x,z))/den]
                if min(weights)>=-1e-8:hits.append((sum(t*p[1] for t,p in zip(weights,(a,b,c))),obj['material'],obj['name']))
    return sorted(hits)

class RecessedEntries(unittest.TestCase):
    def test_scene_material_adapter_uses_factory_for_colour_overrides(self):
        import importlib
        o=fixture();frame=object();glass=object();brass=object();calls=[]
        def factory(kind,colour):
            calls.append((kind,colour));return {'kind':kind,'colour':colour}
        def build():
            return importlib.import_module('building_lib.openings').recessed_opening(o,frame,glass,brass,material_factory=factory)
        meshes,_=_capture(build)
        self.assertTrue(meshes)
        self.assertTrue(all(not isinstance(m['material'],str) for m in meshes))
        self.assertIn(('creamrender',o['entranceRecess']['liningColour']),calls)
        self.assertIn(('ivorytimber',o['entranceRecess']['doorTemplate']['doorLeaf']['colour']),calls)

    def test_shared_capture_closed_panels_and_clear_passage(self):
        for scale,depth in ((.9,.4),(1,.78),(1.3,1.3)):
            o=fixture();o['width']*=scale;o['entranceRecess']['depth']=depth;before=copy.deepcopy(o)
            parts=entry_parts(o,o['frameColour'],o['glassColour'],'#9f8851')
            captured,audit=capture_opening(o,o['frameColour'],o['glassColour'],'#9f8851')
            self.assertTrue(audit['entranceRecess']);self.assertEqual(len(captured),len(parts))
            for a,b in zip(parts,captured):
                self.assertEqual(a['name'],b['name']);self.assertEqual(a['material'],b['material'])
                self.assertEqual([list(p) for p in a['vertices']],b['vertices'])
                edges=Counter()
                for face in a['faces']:
                    for x,y in zip(face,face[1:]+face[:1]):edges[tuple(sorted((x,y)))]+=1
                self.assertTrue(all(n==2 for n in edges.values()),a['name'])
            plan=entry_plan(o);door=plan['door'];hits=ray_hits(parts,door['x'],door['z'])
            self.assertTrue(hits)
            self.assertGreater(hits[0][0],depth-.15)
            self.assertFalse(any('rear wall' in name for _,_,name in hits))
            self.assertTrue(any('rear wall' in name for _,_,name in ray_hits(parts,o['x'],plan['top']-.08)))
            step=next(m for m in parts if m['name'].endswith('rear threshold step'))
            self.assertAlmostEqual(min(v[2] for v in step['vertices']),plan['bottom'])
            self.assertAlmostEqual(max(v[2] for v in step['vertices']),door['z']-door['height']/2)
            self.assertEqual(before,o)

    def test_invalid_geometry_and_template_rejected(self):
        o=fixture()
        for patch in ({'depth':0},{'depth':float('nan')},{'depth':'1'},{'doorWidthFraction':.99},{'doorHeightFraction':1},{'liningThickness':.3},{'thresholdRise':-.1},{'doorTemplate':{'x':0}},{'doorTemplate':{'transom':2}}):
            bad=copy.deepcopy(o);bad['entranceRecess'].update(patch)
            with self.assertRaises(ValueError):entry_plan(bad)
        for patch in ({'kind':'window'},{'head':'segmental'},{'storey':'upper_1'},{'width':.6}):
            bad=copy.deepcopy(o);bad.update(patch)
            with self.assertRaises(ValueError):entry_plan(bad)

if __name__=='__main__':unittest.main()
