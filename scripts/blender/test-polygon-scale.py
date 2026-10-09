"""Triangulation must preserve clipped source corners at any metre scale."""
import copy, unittest
from building_lib.polygons import triangulate, area, cross

class PolygonScaleContracts(unittest.TestCase):
    def test_real_anjeliers_clipped_roof_retains_every_corner(self):
        ring=[[.0035909271350576806,.010666911218165957],
              [.003590927072290508,.010667138598618862],
              [8.239936510889834e-16,.013834211464452836],
              [0.,.007248987252448852]]
        before=copy.deepcopy(ring)
        for scale in (.01,1,1000):
            for reverse in (False,True):
                points=[[x*scale,y*scale] for x,y in ring]
                if reverse:points.reverse()
                faces=triangulate(points)
                self.assertEqual(len(faces),2)
                self.assertEqual({i for f in faces for i in f},set(range(4)))
                self.assertTrue(all(cross(*(points[i] for i in f))>0 for f in faces))
                self.assertAlmostEqual(sum(abs(area([points[i] for i in f])) for f in faces),abs(area(points)),places=12)
        self.assertEqual(ring,before)

    def test_concavity_and_translation_are_scale_independent(self):
        ring=[[0,0],[4,0],[4,4],[2,2],[0,4]]
        for scale in (1e-5,1,1e5):
            points=[[x*scale+7*scale,y*scale-9*scale] for x,y in ring]
            faces=triangulate(points)
            self.assertEqual(len(faces),3)
            self.assertAlmostEqual(sum(abs(area([points[i] for i in f])) for f in faces)/(scale*scale),12)

    def test_degenerate_polygons_remain_rejected(self):
        for ring in ([[0,0],[0,0],[0,0]],[[0,0],[1,1],[2,2]],[[0,0],[2,2],[0,2],[2,0]]):
            with self.assertRaises(ValueError):triangulate(ring)

if __name__=='__main__':unittest.main()
