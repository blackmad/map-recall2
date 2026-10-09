"""Shared coping geometry contracts across sizes and curved front families."""
import unittest,sys
from pathlib import Path
from collections import Counter
sys.path.insert(0,str(Path(__file__).resolve().parent))
from building_lib.gables import profile,coping_mesh

class CopingContracts(unittest.TestCase):
    def test_closed_outward_and_height_bounded(self):
        for family in ('neck','bell','stepped','pediment'):
            for width in (2.8,5.2,8.5):
                with self.subTest(family=family,width=width):
                    points=profile(family,width,8,3)
                    vertices,faces=coping_mesh(points,inset_top=True)
                    edges=Counter((a,b) for face in faces for a,b in zip(face,face[1:]+face[:1]))
                    self.assertTrue(all(n==1 and edges[b,a]==1 for (a,b),n in edges.items()))
                    volume=0
                    for face in faces:
                        a=vertices[face[0]]
                        for i in range(1,len(face)-1):
                            b,c=vertices[face[i]],vertices[face[i+1]]
                            volume+=sum(a[j]*(b[(j+1)%3]*c[(j+2)%3]-b[(j+2)%3]*c[(j+1)%3]) for j in range(3))/6
                    self.assertGreater(volume,0)
                    self.assertLess(max(p[2] for p in vertices),max(p[1] for p in points))
    def test_default_vertices_preserve_legacy_coping_position(self):
        vertices,_=coping_mesh([(0,8),(5,8)],.1,.3)
        self.assertAlmostEqual(min(p[2] for p in vertices),7.968)
        self.assertAlmostEqual(max(p[2] for p in vertices),8.068)
    def test_bad_polyline_rejected(self):
        for points in ([(0,8),(0,8)],[(0,8),(1,8),(0,8)]):
            with self.assertRaises(ValueError):coping_mesh(points)

if __name__=='__main__':unittest.main()
