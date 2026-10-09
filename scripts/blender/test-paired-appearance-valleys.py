"""Real uneven paired roof regression: no internal valley boundary walls."""
import copy,json,sys,unittest
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/blender'))
from building_lib.ir import resolve
from building_lib.appearance_massing import appearance_shell,pitched_covering
from building_lib.polygons import area
from building_lib.source_massing import compile_source_massing

class PairedValleys(unittest.TestCase):
    def test_uneven_roof_reuse_conserves_footprint_and_valley_edges(self):
        base=json.loads((ROOT/'artifacts/building-batch-scale-200/recipes/bag-0363100012173579.recipe.json').read_text())
        for factor in (.8,1,1.25):
            r=copy.deepcopy(base)
            r['frontages'][0]['width']*=factor
            r['footprint']=[[x*factor,y] for x,y in r['footprint']]
            r=resolve(r);before=copy.deepcopy(r)
            roof=pitched_covering(r,r['massing']['appearanceRoof'])
            covered=sum(abs(area([roof.vertices[i][:2] for i in face])) for face in roof.triangles)
            self.assertAlmostEqual(covered,abs(area(r['footprint'])),places=5)
            shell=appearance_shell(r);edges=Counter()
            for s in shell['surfaces']:
                ring=s['rings'][0]
                for a,b in zip(ring,ring[1:]+ring[:1]):
                    edges[tuple(sorted((tuple(round(x,3) for x in a),tuple(round(x,3) for x in b))))]+=1
            self.assertLessEqual(max(edges.values()),2)
            self.assertEqual(before,r)

    def test_scoped_heights_close_above_ground_and_preserve_source(self):
        r=resolve(json.loads((ROOT/'artifacts/building-batch-scale-200/recipes/bag-0363100012173579.recipe.json').read_text()))
        before=copy.deepcopy(r);spec=r['massing']['appearanceRoof'];roof=pitched_covering(r,spec)
        self.assertLessEqual(roof.height(r['frontages'][0]['width']*.23,4),9.1)
        self.assertGreater(roof.height(r['frontages'][0]['width']*.73,4),roof.height(r['frontages'][0]['width']*.23,4)+1)
        edges=Counter();positions={}
        for surface in appearance_shell(r)['surfaces']:
            ring=surface['rings'][0]
            for a,b in zip(ring,ring[1:]+ring[:1]):
                key=tuple(sorted(tuple(round(v,3) for v in p) for p in (a,b)));edges[key]+=1;positions[key]=(a,b)
        self.assertTrue(all(count==2 or all(abs(p[2])<1e-7 for p in positions[key]) for key,count in edges.items()))
        compiled=compile_source_massing(r);self.assertTrue(compiled.audit['sourceClosedAboveGround'])
        self.assertEqual(before,r)
        for changes in ({'eaves':12},{'peak':20},{'fraction':.5},{'eaves':float('nan')}):
            bad=copy.deepcopy(r);bad['massing']['appearanceRoof']['parts'][0].update(changes)
            with self.assertRaises(ValueError):pitched_covering(bad,bad['massing']['appearanceRoof'])

if __name__=='__main__':unittest.main()
