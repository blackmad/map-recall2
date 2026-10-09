"""Raised entrances share closed stairs and preserve basement sightlines."""
import copy,json,sys,unittest
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.entrance_stairs import stair_plan,stair_meshes
from building_lib.ir import resolve
from building_lib.polygons import cross

def fixture():
    r=resolve(json.loads((ROOT/'artifacts/building-batch-pilot/recipes/bag-0363100012168747.recipe.json').read_text()))
    f=r['frontages'][1];return r,f,f['storefront']['entranceSteps'][0]

class EntranceStairs(unittest.TestCase):
    def test_real_open_stair_threshold_closure_and_basement_clearance(self):
        for width,run in ((.8,2),(.94,2.25),(1.1,2.5)):
            r,f,s=fixture();s.update(width=width,run=run);before=copy.deepcopy(r)
            p=stair_plan(s,f,r);parts=stair_meshes(s,f,r)
            treads=[o for o in parts if 'open tread' in o['name']];self.assertEqual(len(treads),p['count'])
            self.assertAlmostEqual(max(v[2] for o in treads for v in o['vertices']),s['rise'])
            self.assertTrue(all(o['material']==s['railColour'] for o in parts if 'rail' in o['name']))
            for obj in parts:
                edges=Counter()
                for face in obj['faces']:
                    for a,b in zip(face,face[1:]+face[:1]):edges[tuple(sorted((a,b)))]+=1
                self.assertTrue(all(n==2 for n in edges.values()),obj['name'])
            # Streetward ray through the basement centre must not meet a
            # fabricated solid stair block below the raised landing.
            basement=next(o for o in f['openings'] if o['id']=='basement-entry');point=(basement['x'],basement['z'])
            for obj in parts:
                for face in obj['faces']:
                    for i in range(1,len(face)-1):
                        tri=[(obj['vertices'][j][0],obj['vertices'][j][2]) for j in (face[0],face[i],face[i+1])];den=cross(*tri)
                        if abs(den)<1e-9:continue
                        weights=[cross(tri[1],tri[2],point)/den,cross(tri[2],tri[0],point)/den,cross(tri[0],tri[1],point)/den]
                        self.assertLess(min(weights),-1e-8,obj['name'])
            self.assertEqual(before,r)

    def test_solid_and_open_reuse_all_approaches(self):
        f={'width':8,'origin':[0,0],'rotation':0,'openings':[{'id':'door','kind':'door','z':1.72,'height':2}]}
        for direction in ('outward','from-left','from-right'):
            for construction in ('solid','open'):
                s={'id':'stair','openingId':'door','x':4,'width':1,'rise':.72,'run':1.2,'landing':.3,'direction':direction,'construction':construction}
                parts=stair_meshes(s,f);self.assertTrue(parts)
                self.assertEqual(len([o for o in parts if 'step ' in o['name'] or 'tread ' in o['name']]),4)

    def test_bad_threshold_scope_dimensions_rejected(self):
        r,f,s=fixture()
        for patch in ({'rise':1},{'rise':0},{'run':6},{'run':.5},{'run':float('nan')},{'width':True},{'scope':'neighbor'},{'direction':'diagonal'},{'railHeight':2}):
            bad=copy.deepcopy(s);bad.update(patch)
            with self.assertRaises(ValueError):stair_plan(bad,f,r)

if __name__=='__main__':unittest.main()
