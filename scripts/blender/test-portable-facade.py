"""Independent area, topology and aperture ray checks for portable slabs."""
import unittest
from collections import Counter
from building_lib.facade_mesh import compile_facade
from building_lib.apertures import from_spec
from building_lib.polygons import area


class PortableFacadeTests(unittest.TestCase):
    def test_area_manifold_and_open_rays(self):
        openings=[{'id':'arched','x':1.5,'z':3,'width':1.4,'height':2,'head':'segmental','archRise':.18},
                  {'id':'circle','x':4,'z':4,'width':1.1,'height':1.1,'head':'circular','archSegments':24},
                  {'id':'keyhole','x':6.5,'z':3,'width':1.3,'height':2.7,'head':'keyhole','archSegments':24}]
        profile=[(0,7),(2,7),(4,9),(6,7),(8,7)]
        mesh=compile_facade(8,profile,openings)
        edges=Counter(tuple(sorted((a,b))) for face in mesh.faces for a,b in zip(face,face[1:]+face[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        self.assertEqual(len(mesh.vertices)-len(edges)+len(mesh.faces),2-2*len(openings))
        front_faces=[face for face in mesh.faces if all(abs(mesh.vertices[i][1]+.035)<1e-8 for i in face)]
        actual=sum(abs(area([[mesh.vertices[i][0],mesh.vertices[i][2]] for i in face])) for face in front_faces)
        expected=abs(area([(0,0),(8,0)]+list(reversed(profile))))-sum(abs(area(from_spec(o))) for o in openings)
        self.assertAlmostEqual(actual,expected,places=7)
        def covered(point):
            from building_lib.polygons import cross
            for face in front_faces:
                triangle=[[mesh.vertices[i][0],mesh.vertices[i][2]] for i in face]
                if all(cross(a,b,point)>=-1e-9 for a,b in zip(triangle,triangle[1:]+triangle[:1])):return True
            return False
        for o in openings:self.assertFalse(covered((o['x'],o['z'])))
        self.assertTrue(covered((.3,.5)))
        self.assertTrue(covered((4,8)))

    def test_reject_invalid_geometry(self):
        opening={'id':'a','x':1,'z':2,'width':1,'height':1}
        for front,back in ((0,0),(1,0),(float('nan'),1)):
            with self.assertRaises(ValueError):compile_facade(3,[(0,4),(3,4)],[opening],front,back)
        with self.assertRaises(ValueError):compile_facade(3,[(0,4),(3,4)],[opening,{**opening,'id':'b'}])
        with self.assertRaises(ValueError):compile_facade(3,[(0,4),(3,4)],[{**opening,'x':0}])

    def test_multirow_earcut_and_invalid_callback(self):
        from building_lib.portable_triangulation import earcut_rings
        openings=[{'id':f'{row}-{column}','x':1+column*2,'z':1.5+row*2,'width':1,'height':1.3}
                  for row in range(3) for column in range(5)]
        mesh=compile_facade(10,[(0,8),(10,8)],openings,triangulator=earcut_rings)
        edges=Counter(tuple(sorted((a,b))) for face in mesh.faces for a,b in zip(face,face[1:]+face[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        self.assertEqual(len(mesh.vertices)-len(edges)+len(mesh.faces),2-2*len(openings))
        for invalid in (lambda rings:[(0,1,999)],lambda rings:[(0,2,1)],lambda rings:[(0,1,2)]):
            with self.assertRaises(ValueError):compile_facade(10,[(0,8),(10,8)],openings,triangulator=invalid)


if __name__=='__main__':unittest.main()
