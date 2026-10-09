"""Blender contracts for reusable signs, fitting and opening-specific glazing."""
import json, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import bpy
from mathutils import Vector
from building_lib.signage import build as signs
from building_lib.archetypes import build
from building_lib.materials.blender import material
from building_lib.openings import recessed_opening


class SignageContracts(unittest.TestCase):
    def setUp(self):
        for obj in list(bpy.context.scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)

    def test_upper_grid_bar_stays_inside_upper_pane_at_authored_height(self):
        with tempfile.TemporaryDirectory() as cache:
            frame=material('ivorytimber',cache,style='simple');glass=material('glass',cache,style='simple')
            spec={'id':'grid','x':2,'z':3,'width':2,'height':2,'transom':.4,'upperLights':[.25,.5,.75],'upperLightBars':[.5]}
            recessed_opening(spec,frame,glass)
            obj=bpy.data.objects['grid upper horizontal light']
            self.assertAlmostEqual(sum(v.co.z for v in obj.data.vertices)/len(obj.data.vertices),3.6,places=6)
            self.assertEqual(len([o for o in bpy.context.scene.objects if o.name.startswith('grid upper light')]),3)
            for change in ({'transom':None},{'transomArch':{'rise':.1}}):
                with self.assertRaises(ValueError):recessed_opening(dict(spec,**change),frame,glass)

    def test_text_only_sign_fits_width_height_and_glazing_depth(self):
        with tempfile.TemporaryDirectory() as cache:
            mat = lambda key, colour=None: material(key, cache, colour, style='simple')
            signs({'signs': [{'id': 'glass', 'x': 2, 'z': 1, 'width': 1.5, 'height': .08,
                             'text': 'A LONG DISPLAY SIGN', 'substrate': False,
                             'letteringColour': '#ffffff', 'letteringDepth': .095}]}, mat, mat('ivorytimber'))
            obj = bpy.data.objects['Storefront / glass lettering']
            bpy.context.view_layer.update()
            points = [obj.matrix_world @ Vector(point) for point in obj.bound_box]
            self.assertLessEqual(max(p.x for p in points)-min(p.x for p in points), 1.5*.93+1e-5)
            self.assertLessEqual(max(p.z for p in points)-min(p.z for p in points), .08*.8+1e-5)
            self.assertLess(max(p.y for p in points), .1)
            self.assertFalse(any('substrate' in o.name for o in bpy.context.scene.objects))

    def test_explicit_font_size_enlarges_short_name_within_fascia(self):
        with tempfile.TemporaryDirectory() as cache:
            mat=lambda key,colour=None:material(key,cache,colour,style='simple')
            signs({'signs':[{'id':'large-name','x':3,'z':4,'width':5.9,'height':.7,
                            'text':'moeders','fontSize':.8}]},mat,mat('ivorytimber'))
            obj=bpy.data.objects['Storefront / large-name lettering']
            bpy.context.view_layer.update()
            points=[obj.matrix_world@Vector(p) for p in obj.bound_box]
            height=max(p.z for p in points)-min(p.z for p in points)
            self.assertGreater(height,.35)
            self.assertLessEqual(height,.7*.8+1e-5)
            self.assertLessEqual(max(p.x for p in points)-min(p.x for p in points),5.9*.93+1e-5)

    def test_opening_glass_override_preserves_other_glazing(self):
        recipe = json.loads((Path(__file__).parent/'building_lib/recipes/rozengracht-158.json').read_text())
        with tempfile.TemporaryDirectory() as cache:
            build(recipe, cache)
        ground = bpy.data.objects['Shop ground:window-1 recessed glazing'].data.materials[0]
        upper = bpy.data.objects['Upper full:window_r1_b1 recessed glazing'].data.materials[0]
        self.assertNotEqual(ground, upper)
        self.assertIn('#405653', ground.name)
        self.assertIn('#91a6a3', upper.name)
        self.assertFalse(any('fascia-1 substrate' in o.name for o in bpy.context.scene.objects))
        self.assertFalse(any('Shop ground:door-1 recessed kick panel' in o.name for o in bpy.context.scene.objects))
        door_panel=bpy.data.objects['Shop ground:door-1 lower display panel']
        self.assertIn('#304440',door_panel.data.materials[0].name)

    def test_rectangular_shop_has_curved_internal_transom_and_lower_panel(self):
        with tempfile.TemporaryDirectory() as cache:
            frame=material('ivorytimber',cache,style='simple')
            glass=material('glass',cache,style='simple')
            blue=material('ivorytimber',cache,'#263d56',style='simple')
            recessed_opening({'id':'shop','x':2,'z':1.5,'width':2,'height':2.6,
                              'kind':'window','head':'rectangular','mullions':[],
                              'transom':.25,'transomArch':{'rise':.2},
                              'upperLights':[.25,.5,.75],'lowerPanel':{'height':.3}},
                             frame,glass,lower_panel=blue)
            bpy.context.view_layer.update()
            arcs=[o for o in bpy.context.scene.objects if 'curved sash division' in o.name]
            self.assertEqual(len(arcs),16)
            arc_z=[(o.matrix_world@v.co).z for o in arcs for v in o.data.vertices]
            # Internal arch remains strictly inside the rectangular aperture head.
            self.assertLess(max(arc_z),2.8)
            self.assertGreater(max(arc_z),2.35)
            panel=bpy.data.objects['shop lower display panel']
            self.assertEqual(panel.data.materials[0],blue)
            panel_z=[v.co.z for v in panel.data.vertices]
            self.assertAlmostEqual(min(panel_z),.2)
            self.assertAlmostEqual(max(panel_z),.5)
            self.assertFalse(any('recessed mullion' in o.name for o in bpy.context.scene.objects))

    def test_storefront_course_can_be_omitted(self):
        recipe=json.loads((Path(__file__).parent/'building_lib/fixtures/synthetic-source-compound.json').read_text())
        recipe['frontages'][0]['storefront']['cornice']=False
        with tempfile.TemporaryDirectory() as cache:build(recipe,cache)
        self.assertFalse(any(o.name.startswith('Storefront / cornice') for o in bpy.context.scene.objects))

    def test_four_leaf_panels_louvres_and_paired_handles(self):
        with tempfile.TemporaryDirectory() as cache:
            frame=material('ivorytimber',cache,style='simple');glass=material('glass',cache,style='simple')
            recessed_opening({'id':'leaves','x':2,'z':1.5,'width':4,'height':2.6,
                              'kind':'door','head':'rectangular','mullions':[.25,.5,.75],
                              'handleFractions':[.225,.275,.725,.775],
                              'lowerPanel':{'height':.6,'divisions':[.25,.5,.75],'louvreCount':8}},frame,glass,brass=frame)
            panels=[o for o in bpy.context.scene.objects if 'lower display panel' in o.name]
            slats=[o for o in bpy.context.scene.objects if 'lower panel louvre' in o.name]
            handles=[o for o in bpy.context.scene.objects if 'door handle' in o.name]
            self.assertEqual((len(panels),len(slats),len(handles)),(4,32,4))
            self.assertFalse(any('kick panel' in o.name for o in bpy.context.scene.objects))
            bpy.context.view_layer.update()
            bounds=lambda o: [o.matrix_world@v.co for v in o.data.vertices]
            for a,b in zip(sorted(panels,key=lambda o:o.location.x),sorted(panels,key=lambda o:o.location.x)[1:]):
                self.assertGreater(min(v.x for v in bounds(b))-max(v.x for v in bounds(a)),.07)
            self.assertTrue(all(min(v.y for v in bounds(o))<.1 for o in slats))

    def test_default_door_panel_clears_lower_mullion(self):
        with tempfile.TemporaryDirectory() as cache:
            frame=material('ivorytimber',cache,style='simple')
            glass=material('glass',cache,style='simple')
            recessed_opening({'id':'door','x':2,'z':1.5,'width':1.2,'height':2.6,
                              'kind':'door','head':'rectangular','mullions':[.5]},frame,glass)
            panel=bpy.data.objects['door recessed kick panel']
            mullion=bpy.data.objects['door recessed mullion']
            panel_face=min(v.co.y for v in panel.data.vertices)
            mullion_face=min(v.co.y for v in mullion.data.vertices)
            self.assertAlmostEqual(mullion_face-panel_face,.012,places=6)


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])
